# Iterative Agent Loop (bounded ReAct) · Design

- 日期:2026-06-20
- 状态:设计已通过,待用户复核后进入实施计划
- 范围:把核心执行从「先规划一次 → 执行整批 → 综合」改成**有界 ReAct 循环**:`decide → act → decide … → finalizer`。每个 `decide` 是一次结构化 provider 调用,基于累积的观察结果决定**下一个动作**(一个 agent/工具指派)或**直接给出最终答案**;步数预算封顶。**只改控制流**——所有 agent 执行器、工具门控、权限门、取消、流式、项目/偃师人格与模型、finalizer 写入全部复用。

---

## 1. 背景

`runtime_graph.py` 现在是线性图:`manager → permission_gate → execute → finalizer`。`_manager_node` 通过 `_build_agent_plan`/`_provider_agent_plan` **一次性**产出整批 `assignments`,`_execute_node` 跑完这一批,`_finalizer_node` 综合。工具结果**不**回流到规划——manager 看不到执行结果再调整。复杂任务(结果需要反过来改计划、多轮探索)因此受限。

这次把它改成有界 ReAct 循环。这是仓库里**最高风险**的改动(核心执行路径,所有 run 依赖),所以策略是:**复用一切已验证的机器,只替换 manager 的「规划一次」为「迭代决定下一步」**,把风险面限制在控制流。

## 2. 目标 / 非目标

**目标**
- 循环式执行:每步 manager 看累积观察 → 决定下一个动作(指派一个 agent/工具)或最终作答;步数预算(默认 8)封顶。
- 工具结果回流:第 N+1 步的决策能看到前面步骤的观察。
- 复用:per-agent 执行器、工具门控(global ∩ 偃师白名单 ∩ policy)、权限门(每个有风险动作仍过门)、取消、partial 流式、项目人格/模型、finalizer 写入——全部保留。
- 向后兼容 + 省钱:无工具任务(知识问答)第 1 步即作答 = **1 次 provider 调用**(与今天相同)。
- 诚实:失败由 status 判定;预算耗尽时综合一个尽力答案并**如实说明触顶**;绝不伪造完成。

**非目标(后续层)**
- 单步并行多动作。
- 循环内的 MCP/ACP 工具反向调用(layer 2,以后接进 `act`)。
- 自适应/学习式步数预算。

## 3. 决策(brainstorm 结论)

| # | 决策 | 选择 |
|---|---|---|
| 1 | 控制模型 | **有界 ReAct 循环**(每步一个动作或作答,步数封顶) |
| 2 | 复用 vs 重写 | **只重写控制流**;执行器/门控/权限/取消/finalizer 全复用 |
| 3 | 简单任务 | 第 1 步直接作答 → 1 次 provider 调用(向后兼容) |

## 4. 架构

### 4.1 图结构(`_build_graph`,LangGraph 支持环)
```
START → decide
decide ─(route)→ permission_gate → act → decide        # 指派了一个有风险动作
       ─(route)→ act → decide                          # 指派了一个低风险动作
       ─(route)→ finalizer → END                       # 作答 或 预算耗尽 或 被取消
```
`decide` 与 `act` 之间成环(`act → decide`);`decide → finalizer` 退出。权限门复用现有节点,夹在 `decide` 与 `act` 之间(仅当该动作需要审批)。

### 4.2 `GraphState` 增量
- `observations: list[dict]` —— 每步执行结果的累积(agentId/summary/ok/structured 摘要),喂给下一步 `decide`。
- `step: int` —— 已执行的 act 步数。
- `max_steps: int` —— 预算(默认 8,从 settings 取;`AppSettings` 加一个 `maxAgentSteps`,默认 8)。
- `next_action: dict | None` —— `decide` 写下、`act`/路由读的下一个动作。
- 现有字段(risk_level/approval_*/blocked/missing_model/provider_failed/tool_failed/result_summary 等)保留语义不变。

### 4.3 `decide` 节点(替换 `_manager_node` 的规划)
- 一次结构化 provider 调用(沿用 `_provider_agent_plan` 的 JSON 模式 + 项目人格/模型 via `_agent_persona(..., project_id)` / `_worker_model`),输入:task + 累积 observations + **可用 agent/工具集合**(经门控过滤后的诚实清单)+ reasoning 指令。输出二选一:
  - `{"action": "answer", "text": "..."}` —— 结束 → finalizer。
  - `{"action": "assign", "agentId": "agent_file|browser|computer|terminal", "task": "..."}` —— 下一步动作。
- 解析失败/空 → 与现有 manager 失败路径一致(`provider_failed`,写 ErrorObservation,转 finalizer)。
- 第 1 步无工具需求 → 直接 `answer`(1 次 provider 调用,简单任务不变贵)。
- 风险等级:沿用 `policy.decide` 对该动作判级,决定是否进权限门。

### 4.4 路由 `_route_after_decide`
- `step >= max_steps` 或被取消 → `finalizer`(预算/取消)。
- `next_action.action == "answer"` → `finalizer`。
- `next_action.action == "assign"`:该动作需审批 → `permission_gate`,否则 → `act`。
- 未知/无动作 → `finalizer`(防御)。

### 4.5 `act` 节点(复用现有执行器)
- 用现有 `_execute_tool_assignment(state, next_action)` 跑**一个**指派——它已经做:工具门控(`_tool_disabled_result` + `_worker_tool_allowed`)、调用 `_execute_{file,browser,computer,terminal}_assignment`、写 action/observation、更新 actor、取消检查。
- 把结果摘要 append 进 `state["observations"]`;`step += 1`;回到 `decide`。
- 取消:每个 act 前后查 `_is_cancelled`(现有);取消则 finalizer 收尾留 cancelled。

### 4.6 `finalizer`(基本复用)
- 循环以 `answer` 结束:把 `next_action.text`(或基于 observations 的综合)写为最终答案。
- 预算耗尽结束:基于 observations 综合一个**尽力答案**,并如实标注「达到步数上限,以下是已获取的信息」——不假装完成。
- 失败/blocked/missing_model/provider_failed/cancelled:沿用现有 `_finalizer_node` 的 status 判定与写入(`update_run` + `run.completed`/`run.failed` + partial 清理)。

### 4.7 复用清单(不动)
per-agent 执行器、`_tool_disabled_result`/`_worker_tool_allowed`、`permission_gate` 节点、`request_cancel`/`_is_cancelled`、partial 缓冲、`_agent_persona`/`_worker_model`/项目作用域、storage 写入与事件、provider 抽象。**只**重写 `_build_graph` 的拓扑 + `_manager_node`/`_execute_node` → `decide`/`act`/`_route_after_decide`。

## 5. 向后兼容 & 诚实

- 无工具任务:`decide` 第 1 步即 `answer` → 1 次 provider 调用(与今天等价)。
- 工具任务:有界迭代(≤ max_steps)。
- 失败语义全程由 status / state flag 决定,**不**关键词猜。
- 预算触顶的答案如实标注不完整;取消在步间停;不伪造完成。
- 现有 run 测试因执行器/门控/finalizer 复用而应保持通过(可能需按新拓扑调整少量断言)。

## 6. 单元边界

- `decide`(决策:一次结构化 provider 调用 → 下一动作/答案,纯到「给定输入产出动作」可注入 provider 单测)。
- `_route_after_decide`(纯路由:看 step/budget/action → 下一节点,可单测)。
- `act`(编排:复用 `_execute_tool_assignment` + 累积观察 + 计步)。
- `finalizer`(收尾:复用)。
各自单一职责;`decide`/路由可独立测,`act` 靠现有执行器测试覆盖。

## 7. 测试(注入假 provider,沿用现有模式)

- **无工具任务**:fake provider 第 1 步返回 `{"action":"answer","text":"4"}` → run completed,answer "4",**没有** act 步(断言只 1 次 provider 调用、无工具 action)。
- **工具任务 + 结果回流**:fake provider 第 1 步 `{"action":"assign","agentId":"agent_file",...}`,第 2 步看到 observation 后 `{"action":"answer",...}` → 断言:循环迭代了、file 执行器跑了、**第 2 次决策的输入里包含第 1 步的 observation**(回流的核心证明)。
- **预算耗尽**:fake provider 永远 `assign` → 到 max_steps 停 → finalizer 综合 + 如实「达到步数上限」标注;status completed(尽力)或按设计定。
- **取消**:循环中 `request_cancel` → 下一步前停,run 留 cancelled(现有语义)。
- **权限门**:高风险 assign → 过 permission_gate(现有审批路径不变)。
- **回归**:现有 run-execution / 工具门控 / 人格 / per-偃师 model 测试保持通过(必要时按新拓扑微调断言,不弱化)。
- 门禁:`uv run pytest`;CI。

## 8. 文件结构

- 改:`runtime/python/yanshi_runtime/graph/runtime_graph.py`(`_build_graph` 拓扑;新增 `_decide_node`/`_route_after_decide`/`_act_node`;`GraphState` 增量;`_manager_node`/`_execute_node` 退役或改造为 decide/act;`_provider_agent_plan` 改造为 `_provider_next_action`)。
- 改:`runtime/python/yanshi_runtime/models.py`(`AppSettings.maxAgentSteps: int = 8`;`GraphState` 字段)。
- 改:`runtime/python/tests/test_runtime.py`(新循环测试 + 调整受影响的现有断言)。
- 可能改:前端 `AppSettings`(maxAgentSteps 暴露为开发者设置——可选,本轮倾向只后端默认,不加 UI 以缩小范围)。

## 9. 风险与回滚

- 最高风险改动(核心执行路径)。缓解:**只改控制流,复用一切执行器**;重 TDD;改完用**已修好的 eval 基线**做真实前后对比(net_guard 修复后 run 能真跑)。
- LangGraph 环:`act → decide` 用条件边;`max_steps` 是硬上限,杜绝 runaway;每步取消检查;provider/run 超时仍在。
- 若新拓扑导致大量现有测试以非预期方式失败(不只是断言微调)→ 停下,与人对齐,不强推。
- 提交按任务粒度(图增量 → decide → 路由/act → 预算/finalizer → 测试),每步可回滚。

## 10. 待澄清 / 残留(实施期定,均有默认)

- 预算耗尽答案的 status:本轮定为 `completed`(尽力答案 + 如实标注触顶),避免把「答了但没全做完」误报为 failed;若更想要 `failed` 实施期可调。
- `decide` 的可用 agent 清单是否含 manager/reviewer:本轮 `assign` 只针对工具执行 agent(file/browser/computer/terminal);综合/审阅是 finalizer 的事,不作为可指派动作(缩小动作空间、降复杂度)。
- `max_steps` 是否暴露 UI:本轮只 settings 默认 8,不加 UI(缩小范围)。
- observations 喂给 decide 的体量:截断/摘要策略(防 prompt 膨胀)——本轮取每步 summary + 关键 structured 字段,实施期定上限。
