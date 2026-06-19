# MCP Client — Discovery (Layer A) · Design

- 日期:2026-06-19
- 状态:设计已通过,待用户复核后进入实施计划
- 范围:为 Yanshi runtime 实现一个真正的 **MCP 客户端**的第一层——**发现**(连接 / `initialize` 握手 / `tools/list`),把现有「只能存配置、连不上」的诚实桩变成「已连接、发现了 N 个工具」的真实状态。**不含**工具调用(layer B,与迭代 agent 循环一起做)。

---

## 1. 背景

`McpServerConfig`(`models.py:432`)的 schema 已完整:`transport: stdio|http|sse`、`command`/`args`/`env`、`url`、`enabled`、`status`、`tools`。`AiIntegrationsConfig.mcpServers` 持久化也已就绪。**缺的只有客户端**:目前 MCP 条目即使配置完整也只是 `not_implemented`(`storage.py` 的 `_with_honest_integration_statuses`,~L106/L120),`tools` 永远为空——发现的工具从不伪造。

仓库里有现成范式:`acp.py` 是一个**手写的同步 stdio JSON-RPC** 客户端(`AcpConnection` 做 request/response + 读超时,`AcpManager` 管 connect/disconnect/live_state/shutdown)。runtime 是同步的(sqlite + LangGraph 图),所以 MCP 客户端也走同步手写 JSON-RPC,与 `acp.py` 对齐,**不引入 asyncio 桥接、零新依赖**。

## 2. 目标 / 非目标

**目标**
- stdio 传输的真实 MCP 发现:connect → `initialize` → `notifications/initialized` → `tools/list`。
- 用户按服务器手动 connect/disconnect(镜像现有 External Agents 的交互)。
- 连接成功后:持久化真实 `status` + 发现的 `tools`(名字/描述);失败 → `status="error"`;诚实,绝不伪造工具。
- AI Integrations UI 的 MCP 区显示连接按钮 + 实时状态 + 发现的工具。

**非目标(明确推迟到 layer B,与迭代循环一起)**
- `tools/call`(真正调用 MCP 工具)。
- http / sse 传输(本轮只 stdio)。
- agent 在 run 中使用 MCP 工具。

## 3. 决策(brainstorm 结论)

| # | 决策 | 选择 |
|---|---|---|
| 1 | 第一刀范围 | **发现(A)先做**;调用(B)随迭代循环 |
| 2 | 协议实现 | **手写同步 JSON-RPC**,沿用 `acp.py` |
| 3 | 传输 | 本轮仅 **stdio**;http/sse 后续 |
| 4 | 交互 | 按服务器手动 connect/disconnect,镜像 External Agents |

## 4. 架构

### 4.1 新模块 `runtime/python/yanshi_runtime/mcp_client.py`(镜像 `acp.py`)

- **`McpConnection`** — 单一职责:一条已连接 MCP 服务器的生命周期。
  - `__init__`/工厂:用 `subprocess.Popen` 启动 `command`+`args`,`env` 注入(已解析的明文,仅在子进程环境内;见 §6),`start_new_session=True`(便于整组 kill)。stdin/stdout 管道,行分隔 JSON-RPC。
  - `request(method, params, timeout) -> dict` — 写一行 JSON-RPC 请求,读响应(带超时,复用 `acp.py` 的读循环思路);`notify(method, params)` 发通知(无 id、不等响应)。
  - 握手序列封装为 `initialize()`:发 `initialize`(`protocolVersion`、`clientInfo={name:"yanshi", version}`、`capabilities={}`)→ 收 server `initialize` 结果(记录 serverInfo/capabilities)→ 发 `notifications/initialized`。
  - `list_tools() -> list[McpToolInfo]` — 发 `tools/list`,解析 `result.tools[]` 的 `name`/`description`(忽略未知字段);分页 `nextCursor` 至少处理一页,有 cursor 时循环取完。
  - `close()` — 关 stdin、`terminate()`、超时后 `kill()`(进程组),回收。
- **`McpManager`** — 多连接编排,与 `AcpManager` 同形:`connect(config) -> McpConnection`、`disconnect(id)`、`live_state(id) -> McpConnection | None`、`shutdown()`。`dict[str, McpConnection]`,按 server id 键。由 `RuntimeService` 持有。

> 单元边界:`McpConnection` 只懂「一条连接的协议」;`McpManager` 只懂「多条连接的增删与生命周期」;两者都可独立测试(用一个会说 JSON-RPC 的假 stdio 服务器脚本)。

### 4.2 数据类型
- `McpToolInfo`(轻量 dataclass 或 Pydantic):`name: str`、`description: str | None`。发现结果。`McpServerConfig.tools` 持久化为工具名字符串列表(与现有 `tools: list[str]` 一致);描述可进结构化输出或暂不持久化(本轮持久化名字即可)。

## 5. 服务层 + 端点(镜像 external-agent connect/disconnect)

现有参照:`POST /settings/integrations/agents/{agent_id}/connect` + `/disconnect`(`app.py:842/846`),走 `RuntimeService.connect/disconnect_external_agent` + `AcpManager`。

- `RuntimeService.connect_mcp_server(server_id) -> AiIntegrationsConfig`
  1. 取 `get_ai_integrations_resolved()` 里该 server 的解析配置(env 明文来自 SecretStore)。
  2. `self.mcp_manager.connect(resolved)`;
  3. 成功:`tools = conn.list_tools()`;持久化该 server `status` 基线为 `"configured"`、`tools=[t.name]`(发现结果不涉密,可入库);
  4. 失败(spawn/握手/list 抛错):`status="error"`,清空 live;不抛到 HTTP(返回带 error 状态的配置)。
  5. 返回 `get_ai_integrations()`(**掩码后**,env 不回明文)。
- `RuntimeService.disconnect_mcp_server(server_id)`:`mcp_manager.disconnect(id)`;持久化 `status` 回 `"configured"`,清空 live 工具(持久化的 `tools` 是否保留:保留上次发现结果作为「上次已知」,与 office/instance 的「持久化基线 + live 覆盖」一致)。
- 端点:`POST /settings/integrations/mcp/{server_id}/connect`、`/disconnect`,`response_model=AiIntegrationsConfig`,紧挨现有 agents 的两个端点。

### 5.1 诚实状态
- 改 `_with_honest_integration_statuses`(`storage.py`):MCP server **带 launch command** 的完整配置在「静止态」从 `"not_implemented"` 改为 **`"configured"`**(可连接);**仅 url/无 command** 的条目(http/sse)**仍 `"not_implemented"`**(传输 B 之前没有客户端)。
- live 的 `"connected"`/`"ready"` 由服务在读取时**覆盖**(不持久化),与 ACP 一致;发现的 `tools` **持久化**(非密)。

## 6. 安全

- stdio 启动的是**用户自己配置的命令**——与 ACP launch 同一信任模型(用户在本机、自己的配置里授权的本地进程)。不引入额外沙箱(超出本轮)。
- `env` 是 secrets:已存 SecretStore(`storage.py` 的 `_reconcile_env("mcp", ...)`),connect 时解析为明文**仅注入子进程环境**,绝不写日志、绝不由 API 回明文(`get_ai_integrations` 始终掩码)。
- 连接生命周期:connect 时 spawn,disconnect/shutdown 时 kill(进程组),不泄漏子进程。
- stdio 无网络出站,SSRF N/A;http 传输落地时(B)对 `url` 走 `net_guard.validate_outbound_url`。

## 7. 前端(`apps/desktop/src/features/ai-integrations.tsx` 的 MCP 区)

镜像 External Agents 区:每个 MCP server 一个 **Connect/Disconnect** 按钮(复用 store 的 connect/disconnect 模式,新增 `connectMcpServer`/`disconnectMcpServer` 或泛化现有 `connectExternalAgent`)、显示实时 `status`、把发现的 `tools` 渲染为 chips。**绝不伪造工具**——只展示 server 报告的。状态文案复用现有 `integrations.status.*` i18n(en/zh 平价)。

## 8. 测试

- **pytest**(`runtime/python/tests/`):新增一个**最小真实假 MCP 服务器脚本**(`tests/fixtures/fake_mcp_server.py` 之类):读 stdin 的 JSON-RPC,对 `initialize` 回协议版本+serverInfo,对 `notifications/initialized` 不回,对 `tools/list` 回两个工具。测试:
  - `McpConnection`:连接该脚本 → 握手成功 → `list_tools()` 返回那两个工具(名字/描述)。
  - `McpConnection`:服务器立即退出/回错误 → 抛错被捕获(connect 失败路径)。
  - `McpManager`:connect → live_state 非空 → disconnect → live_state None;shutdown 清干净。
  - 服务层:`connect_mcp_server` 成功后持久化 `status` + `tools`,API 返回**掩码**;失败 → `status="error"`;端点 `POST .../connect` 200。
  - `_with_honest_integration_statuses`:带 command 的 MCP → `"configured"`;仅 url → `"not_implemented"`。
- **vitest**(jsdom):MCP 区渲染 connect 按钮;给定一个 `status="connected"` + `tools=[...]` 的 server,渲染出工具 chips;断言没有伪造工具(空 tools → 不渲染 chip)。
- 门禁:`uv run pytest`;`pnpm -r lint && pnpm -r test`;CI(已就绪)会在 PR 上跑。

## 9. 文件结构

- 新建:`runtime/python/yanshi_runtime/mcp_client.py`(`McpConnection`、`McpManager`、`McpToolInfo`)。
- 新建:`runtime/python/tests/fixtures/fake_mcp_server.py`(测试用最小服务器)。
- 改:`server/app.py`(`RuntimeService.connect/disconnect_mcp_server` + 两个端点;`RuntimeService` 持有 `McpManager`,`shutdown` 时 `mcp_manager.shutdown()`)。
- 改:`storage.py`(`_with_honest_integration_statuses` 的 MCP 分支)。
- 改:`apps/desktop/src/features/ai-integrations.tsx`(MCP 区 connect/disconnect + tool chips);`stores/runtimeStore.ts` + `api/client.ts`(connect/disconnect MCP)。
- 可能改:`packages/shared/src/index.ts`(若 McpServerConfig TS 需补字段——目前 transport/tools 已有)。

## 10. 诚实边界(总)

不伪造工具(只 server 报告的);env 密钥仅 SecretStore、不回明文/不入日志;http/sse 与 tools/call 在 B 之前保持 `not_implemented` / 不暴露可点但无效的控件;stdio 启动用户自授权的本地进程。

## 11. 待澄清 / 残留

- 工具**描述**是否持久化:本轮只持久化工具**名字**(`tools: list[str]`);描述在 live 连接的结构化输出里可带,持久化与否实施期定(倾向不持久化,描述属于 live 发现)。
- 分页:`tools/list` 的 `nextCursor` 本轮处理「取完所有页」即可。
- 协议版本:`initialize` 用一个固定的 `protocolVersion` 常量(实施期取一个当前稳定值),对 server 返回的版本不做严格协商(记录即可),不匹配也不假装失败——能 `tools/list` 成功就算连上。
