# ACP Task Routing (Layer 1) · Design

- 日期:2026-06-19
- 状态:设计已通过,待用户复核后进入实施计划
- 范围:让一个 run 可以**整体路由给一个已连接的外部 ACP agent**(绕过内部 LangGraph):`session/new` → `session/prompt` → 收集 agent 的文本回复 → 作为该 run 的答案。把现有「只 initialize 握手」的外部 agent 变成「能真正接活并回话」。**不含**工具/权限反向路由(agent 反过来请求调用工具)——那是 layer 2。

---

## 1. 背景

`acp.py` 现在只做 `initialize` 握手(`AcpConnection.request("initialize", ...)`),`AcpManager` 管 connect/disconnect/live_state。`request()` 丢弃所有非匹配-id 的通知(notifications)。外部 agent 配置 `ExternalAgentConfig`(protocol `acp`/`custom`,command/args/env/endpoint)已就绪,UI 能 connect/disconnect 并显示 capabilities,但注释明说「prompts/tools are not routed yet」。

要让外部 agent 真正干活,需要补 ACP 的会话与提示:`session/new`(建会话)+ `session/prompt`(发任务)。ACP 的 prompt 是**流式**的:agent 在处理时通过 `session/update` 通知发 `agent_message_chunk`(文本片段),最后 `session/prompt` 请求才带 `stopReason` resolve。所以拿到 agent 的文本必须**收集 prompt 期间的 session/update 通知**——这是本设计唯一的真协议新增。

## 2. 目标 / 非目标

**目标**
- `AcpConnection` 能 `new_session()` + `prompt(session_id, text)`,后者收集 `agent_message_chunk` 文本并返回。
- 一个 run 可带 `externalAgentId` 创建;带了就**整体路由给该外部 agent**,把回复写成 run 的答案 + 状态流转,绕过内部图。
- 诚实:只路由到 `connected` 的 agent;连接/prompt 失败 → run 如实失败,不假装成功。
- UI:每个已连接外部 agent 提供一个「派个任务」入口 → 弹一个小输入 → 以 `externalAgentId` 建 run,结果以普通对话呈现。

**非目标(明确推迟到 layer 2)**
- 工具/权限**反向**路由(agent 通过 session/update 请求调用工具或要权限)——layer 1 收到这类 update 时不服务、不假装服务,如实标注局限。
- 多轮 ACP 会话(本轮一问一答即可)。
- `custom`(非 ACP)协议的外部 agent。

## 3. 决策(brainstorm 结论)

| # | 决策 | 选择 |
|---|---|---|
| 1 | 第一刀边界 | **整个任务路由给外部 agent**(run 级,绕过内部图) |
| 2 | 协议新增 | `session/new` + `session/prompt`,收集 `agent_message_chunk` |
| 3 | 工具反向路由 | **layer 2**,本轮不做、不伪造 |

## 4. 架构

### 4.1 ACP 协议(`acp.py` 的 `AcpConnection`)
- `new_session(self, timeout: float) -> str`:`request("session/new", {...})` → 取返回的 `sessionId`(字段名以 ACP 为准,实施期确认;取不到则抛 ConnectionError)。ACP `session/new` 的 params 通常含 `cwd`/`mcpServers` 等;本轮传最小必要(如 `{"cwd": <run workspace>}`),实施期对照协议。
- `prompt(self, session_id: str, text: str, timeout: float) -> str`:发 `session/prompt`(`{"sessionId": session_id, "prompt": [{"type": "text", "text": text}]}`),然后进入一个**收集型读循环**:逐行读,
  - 若是通知(无 `id`)且 `method == "session/update"` 且 `params.update.sessionUpdate == "agent_message_chunk"`:把 `params.update.content.text` 累加;
  - 若是 prompt 请求的响应(`id` 匹配):结束,返回累加文本(空则抛 ConnectionError「empty response」);
  - 其他通知忽略(含 tool_call/permission 类——layer 1 不服务);
  - 超时/进程关闭 → 抛(与现有 `request` 的失败语义一致)。
  这复用现有 reader-thread + 超时思路,但**不丢弃 session/update 通知**。把累加文本逻辑做成可单测的小函数。
- 现有 `request`/`close` 不变。

### 4.2 Run 路由(`server/app.py`)
- `CreateRunRequest` 增加 `externalAgentId: str | None = None`。
- `start_run`(run 执行入口,经 worker pool):若该 run 有 `externalAgentId`,走新路径 `_run_via_external_agent(run_id, task, agent_id)` 而非 `self.graph...`;否则照旧走图。
- `_run_via_external_agent`:
  1. 取该 agent 的 live 连接(`self.acp.live_state(agent_id)`);未连接 → 尝试连接(`get_ai_integrations_resolved()` 取解析配置 + `self.acp.connect`),仍失败 → run 失败(写错误观察/状态),return。
  2. `session_id = conn.new_session(...)`;`answer = conn.prompt(session_id, task, ...)`。
  3. 把 `answer` 写成 run 的**最终答案**(复用图 finalizer 写最终 assistant 消息/结果的同一 storage 方法),状态 running→completed;期间可把文本写进 partial 缓冲(复用 `graph` 的 partial 机制或一个等价写入)以便 UI 流式看到。
  4. 任何步骤抛错 → 写错误观察 + 状态 failed,`missingRequirement`/error 如实(如 `external_agent_failed`)。
  - 该路径不调用内部 agents/工具,不进权限门——它就是把任务交给外部 agent。run 的 project_id 决定 workspace(给 `session/new` 的 cwd)。

> 单元边界:`AcpConnection.new_session`/`prompt`(协议)、文本累加纯函数(可单测)、`_run_via_external_agent`(编排,写 run 工件)各自单一职责。

### 4.3 创建 run 的入口
`create_run` 端点把 `request.externalAgentId` 透传到 run 记录/执行。run 记录可在 metadata 里标记「executor: external_agent:<id>」以便 UI/历史显示是外部 agent 跑的(诚实标注)。

## 5. 前端

- store/client 的 `createRun` 增加可选 `externalAgentId`(透传到 `POST /runs` body)。
- AI Integrations 的 External Agents 区:每个 **connected** agent 加一个「派个任务/Run a task」按钮 → 一个小输入(任务文本)→ `createRun({ task, externalAgentId })` → 跳到对话视图看结果。未连接的 agent 不显示该按钮(诚实:只有连上的能接活)。
- 新文案进 en+zh(i18n 平价)。
- 不动 composer(本轮最小 UI)。

## 6. 诚实 / 安全

- 只路由到 `connected` agent;失败如实(run failed + 错误),绝不假装成功或伪造回复。
- 外部 agent 是用户自己配置的本地命令(与现有 ACP launch 同信任模型);env 密钥仍 SecretStore,connect 时解析进子进程,不回明文/不入日志。
- agent 若发 tool_call/permission 类 session/update:layer 1 **忽略**(不服务、不伪造结果),并在文档/UI 注明「工具反向路由属 layer 2」。这可能导致「需要工具回调才能完成」的 agent 卡住/给不出完整答案——如实呈现(超时→失败),不掩盖。
- ACP 子进程生命周期沿用 `AcpManager`(connect spawn / disconnect kill / shutdown)。

## 7. 测试

- **pytest**:扩展现有的假 ACP agent 测试脚本(测 ACP 连接用的那个 fixture),让它也应答 `session/new`(回 `{"sessionId":"s1"}`)和 `session/prompt`(先发一条 `session/update` 的 `agent_message_chunk` 文本,再 resolve prompt 请求带 `stopReason`)。测:
  - `AcpConnection.prompt`:连上假 agent → `new_session` → `prompt("q")` 返回累加文本(断言等于 chunk 文本);空回复 → 抛。
  - 文本累加纯函数:喂 `session/update` 列表 → 正确拼接;忽略 tool_call 类 update。
  - `_run_via_external_agent` / `POST /runs`(带 externalAgentId):产出 run 的答案 + 状态 completed;agent 未连接/prompt 失败 → run failed,错误如实(用一个会拒/退出的假 agent)。
- **vitest**:已连接 agent 显示「派个任务」按钮;点了走 createRun(带 externalAgentId);未连接 agent 不显示。
- 门禁:`uv run pytest`;`pnpm -r lint && pnpm -r test`;CI 在 PR 上跑。

## 8. 文件结构

- 改:`runtime/python/yanshi_runtime/acp.py`(`new_session`、`prompt`、累加纯函数)。
- 改:`runtime/python/yanshi_runtime/models.py`(`CreateRunRequest.externalAgentId`)。
- 改:`runtime/python/yanshi_runtime/server/app.py`(`start_run` 分流;`_run_via_external_agent`;`create_run` 透传)。
- 改:`runtime/python/tests/test_runtime.py`(假 ACP agent 扩展 + 测试)。
- 改:`apps/desktop/src/api/client.ts` + `stores/runtimeStore.ts`(`createRun` 带 `externalAgentId`)、`features/ai-integrations.tsx`(connected agent 的「派个任务」)、i18n en/zh、可能 `packages/shared`(CreateRun 相关类型)。

## 9. 待澄清 / 残留(实施期定,均有默认)

- `session/new` 的确切 params 与 `session/prompt`/`session/update` 的确切字段名(`sessionUpdate`/`agent_message_chunk`/`content.text`/`sessionId`)以 ACP 规范为准——实施期对照(本设计用社区 ACP 常见形态);取不到字段时如实失败,不猜。
- run「executor」标注怎么进 metadata/历史显示——实施期按现有 run metadata 形态定;最小可只在结果里注明。
- partial 流式:若复用图的 partial 缓冲不方便,本轮可**非流式**(prompt 完成后一次性写答案)——仍诚实,只是不逐字。实施期二选一。
