# Eval / Golden-set Harness (deterministic) · Design

- 日期:2026-06-20
- 状态:设计已通过,待用户复核后进入实施计划
- 范围:一个 agent 质量回归基线——固定 golden-set 任务 + 通过真实 runtime(同步模式、对**已配置的** provider)执行的 runner + **确定性**评分器(完成 + 答案子串/正则 + 可选 agent/工具是否跑过)。eval **运行**是手动/可选(消耗 provider token);**评分器**是纯函数、在 CI 单测。LLM-judge 留待后续。

---

## 1. 背景与动机

Yanshi 现在完全没有 agent 行为的回归基线。换 prompt、换模型、改图后,任务成功率会不会悄悄下降——没法量化。单测覆盖的是代码,不是 **agent 在真实任务上的表现**。一个固定任务集 + 评分脚本能廉价地建立这个基线。

确定性评分是第一刀:免费、可复现、评分逻辑可在 CI 单测;不需要每次评测都烧钱或引入不可复现性。

## 2. 目标 / 非目标

**目标**
- `runtime/python/evals/`:golden-set(`cases.jsonl`)+ 纯函数评分器(`scorer.py`)+ runner(`run_evals.py`)+ README。
- runner 通过真实 runtime(同步模式)跑每个 case,拿到 `status`/`resultSummary` + 该 run 实际跑过的 agents/工具(从 storage 的 actions),交给评分器。
- 评分器**纯函数、确定性**,在 CI 单测(不需要 provider)。
- 诚实:未配置 provider → runner 明说并退出,不伪造结果;失败由 `status` 判定,不靠关键词猜。

**非目标(后续层)**
- LLM-judge 评分。
- 在 CI 里**运行** eval(没有 provider/token)。
- 多 provider 评测矩阵、并发、CI 门禁阈值。

## 3. 决策(brainstorm 结论)

| # | 决策 | 选择 |
|---|---|---|
| 1 | 评分方式 | **确定性检查**(completed + contains/regex + agentUsed/toolUsed) |
| 2 | 运行 | **手动/可选**(需配置 provider,烧 token);不进 CI |
| 3 | CI 覆盖 | 只跑**评分器**单测(纯函数) |

## 4. 架构

### 4.1 Golden-set `runtime/python/evals/cases.jsonl`
每行一个 case(JSON):
```json
{"id": "math_basic", "task": "What is 2+2? Reply with just the number.", "expect": {"completed": true, "contains": ["4"]}}
```
`expect` 字段(全部可选,提供了才检查):
- `completed: bool` —— run 状态须为 `completed`(给 true);或 `false` 表示期望失败。
- `contains: [str]` —— `resultSummary` 须(不区分大小写)包含每个子串。
- `regex: str` —— `resultSummary` 须匹配。
- `agentUsed: str` —— 该 run 的 actions 里出现过这个 agent id(如 `agent_file`)。
- `toolUsed: str` —— 该 run 跑过这个工具(从 actions/observation 推断)。
`projectId` 可选(默认 standalone)。

### 4.2 评分器 `runtime/python/evals/scorer.py`(纯函数,CI 单测)
```
@dataclass
class RunResult:
    status: str
    result_summary: str
    agents_used: list[str]
    tools_used: list[str]

@dataclass
class CaseResult:
    case_id: str
    passed: bool
    reasons: list[str]   # 每条未通过的检查的人读原因(通过则空)

def score_case(case_id: str, expect: dict, result: RunResult) -> CaseResult
```
逐项检查 `expect`,任一不满足 → `passed=False` 且把原因加进 `reasons`(如 "status was 'failed', expected 'completed'"、"missing substring '4'"、"agent 'agent_file' not used")。`contains` 不区分大小写;`regex` 用 `re.search`;`completed` 比对 `status=="completed"`。**不**做任何关键词猜失败——`status` 权威。纯函数,无 IO,完全可单测。

### 4.3 Runner `runtime/python/evals/run_evals.py`(手动,需 provider)
- 用真实 runtime 的同步模式跑(镜像测试里 `create_app(RuntimeSettings(..., synchronous_runs=True))` / `make_client` 的搭法),但用**真实 data_dir**(默认 `~/.yanshi` 或 `YANSHI_DATA_DIR`),这样会读到用户已配置的 provider。
- 启动时检查 provider:`service.provider.configured` 为 False → 打印「provider 未配置,无法运行 eval」并以非零退出(诚实,不跑、不伪造)。
- 对每个 case:POST/`create_run`(同步)→ 跑完 → 从 storage 取该 run 的 `RunSummary`(`status`/`resultSummary`)+ 该 run 的 actions(得到 `agents_used`/`tools_used`)→ 组 `RunResult` → `score_case`。
- 汇总:逐 case 打印 PASS/FAIL + 原因,末尾打印通过率(`k/n`),把结构化结果写 `evals/last_report.json`(gitignored)。退出码:有失败时非零(便于手动 CI/脚本判断),可用 `--no-fail` 关。
- CLI:`uv run --project runtime/python python -m evals.run_evals [--cases evals/cases.jsonl]`(确认 evals 作为可导入模块/或脚本路径,实施期定)。

### 4.4 CI
评分器单测(`tests/` 或 `evals/test_scorer.py`)进现有 pytest,CI 跑(纯函数,无 provider)。`run_evals` **不**进 CI。

> 单元边界:`scorer`(纯、确定、可单测)、`cases`(数据)、`run_evals`(IO 编排:驱动 runtime + 取结果 + 汇总报告)各自单一职责。runner 依赖 scorer,不反过来。

## 5. 诚实 / 安全

- provider 未配置 → 明说 + 非零退出,绝不伪造分数。
- 失败由 `status` 判定,不关键词猜。
- runner 用真实 data_dir 读用户配置(含 provider key,经 SecretStore);不打印 key。
- eval 报告写 gitignored 文件;不入库。
- 不在 CI 跑 eval(避免无 provider 时假绿/或意外烧 token)。

## 6. 测试

- **pytest(CI)**:`score_case` 的纯函数单测——completed 通过/失败;contains 命中/缺失(大小写);regex;agentUsed/toolUsed 命中/缺失;多条 reasons 累积;空 expect → 通过。
- **手动冒烟(非 CI)**:配置一个 provider 后 `python -m evals.run_evals` 在 seed cases 上产出报告(实施期人工跑一次确认,不进自动门禁)。
- 门禁:`uv run pytest`(含 scorer 单测);`pnpm -r lint && pnpm -r test`(本功能无前端改动,门禁照跑);CI。

## 7. 文件结构

- 新建:`runtime/python/evals/__init__.py`、`evals/cases.jsonl`(~4 个 seed)、`evals/scorer.py`、`evals/run_evals.py`、`evals/README.md`。
- 新建:`runtime/python/tests/test_eval_scorer.py`(或并入 test_runtime.py)——scorer 单测。
- 改:`.gitignore`(忽略 `runtime/python/evals/last_report.json`)。
- runner 复用现有 `create_app`/`RuntimeSettings`/`Storage`/run-actions 查询(实施期对照真实方法名:取某 run 的 actions/agents)。

## 8. Seed golden-set(~4,用户可扩展)

- `math_basic`:"What is 2+2? Reply with just the number." → completed + contains ["4"]。
- `knowledge_capital`:"What is the capital of France? One word." → completed + regex `(?i)paris`。
- `refusal_safe`(可选):一个明显该正常回答的问题 → completed(防止误失败)。
- `file_list`(可选,需 file 工具):"List the files in the workspace." → completed + agentUsed `agent_file`(实施期确认该任务确会派 file agent;不确定就先不放,避免脆弱)。

(seed 故意小且稳;`contains`/`regex` 选宽松、答案稳定的,避免 flaky。)

## 9. 待澄清 / 残留(实施期定,均有默认)

- runner 取「某 run 的 agents/tools used」的确切 storage 查询(list actions by run_id 等)——实施期对照真实方法;取不到就 `agents_used=[]`(只是 agentUsed 类断言会失败,诚实)。
- `evals` 作为可导入包 vs 脚本路径:倾向包(`python -m evals.run_evals`),实施期按 runtime/python 的包布局定。
- 退出码阈值:本轮「有任一失败即非零」;可配阈值留后续。
