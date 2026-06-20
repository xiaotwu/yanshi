# Native Anthropic Provider · Design

- 日期:2026-06-19
- 状态:设计已通过,待用户复核后进入实施计划
- 范围:在现有「单 provider」架构上抽出一个 `Provider` 接口,新增一个**原生 Anthropic provider**(Messages API,手写 httpx),通过 provider 设置里的 `providerType` 选择。文本对话 + 流式 + 健康检查 + 模型列表;不含原生 tool-use(图自己编排工具)、prompt caching、Gemini。

---

## 1. 背景

runtime 目前只注入一个 `OpenAICompatibleProvider`(`server/app.py:102`),图与服务依赖它的 8 个方法:`configured`(property)、`public_base_url`、`model`、`update_config(config)`、`list_models() -> list[str]`、`healthcheck() -> ProviderHealth`、`chat_completion(messages, model=None) -> str`、`stream_chat_completion(messages, model=None) -> Iterator[str]`。图自己编排工具(plan→execute),所以一个 provider 只需要**文本进出 + 流式 + 健康 + 模型列表**,不需要原生 tool-use。这把 Anthropic provider 的范围限定得很干净。

Anthropic Messages API ≠ OpenAI 兼容:端点 `POST {base}/v1/messages`,鉴权 `x-api-key` + `anthropic-version` 头,`system` 与 `messages` 分离,响应是 `content[]` 块,流式是 SSE(`content_block_delta`/`text_delta`)。所以需要一个独立的 provider 实现,而不是改 base_url。

## 2. 决策

| # | 决策 | 选择 |
|---|---|---|
| 1 | 抽象方式 | **Provider Protocol + 工厂按 providerType 选**(OpenAICompatible / Anthropic 都实现) |
| 2 | 实现风格 | **手写 httpx**(与现有 OpenAI provider 一致,零新依赖,无 asyncio) |
| 3 | 范围 | 文本对话 + 流式 + healthcheck + list_models;**无原生 tool-use** |

## 3. 架构

### 3.1 `Provider` 接口(`providers/base.py`)
用 `typing.Protocol` 定义图/服务依赖的 8 方法面(见 §1)。`OpenAICompatibleProvider` 已天然满足(无需改它的行为,仅在类型上 conform)。`AnthropicProvider` 实现同一接口。这样图持有的 `self.provider` 是 `Provider` 类型,实现可热替换。

### 3.2 `providerType` 设置
- `ProviderConfig`(`providers/openai_compatible.py` 的 dataclass)增加 `provider_type: Literal["openai","anthropic"] = "openai"`(从 secret settings 解析时带上)。
- `ProviderSettingsUpdate` / `ProviderSettingsPublic`(`models.py`)增加 `providerType: Literal["openai","anthropic"] = "openai"`。默认 `"openai"`——**向后兼容**,现有配置不受影响。
- Anthropic 的默认 `baseUrl = "https://api.anthropic.com"`。

### 3.3 `AnthropicProvider`(`providers/anthropic.py`,手写 httpx)
实现 `Provider`:
- `configured`:有 base_url **且**有 api_key(Anthropic 不像本地 OpenAI 兼容那样可无 key)。
- `public_base_url` / `model`:取自 config。
- `chat_completion(messages, model=None) -> str`:`POST {base}/v1/messages`,头 `x-api-key`、`anthropic-version: 2023-06-01`、`content-type: application/json`。请求体:把 `ChatMessage[]` 翻译为 Anthropic 形态——`role=="system"` 的消息合并进顶层 `system` 字符串;其余按 `user`/`assistant` 映射为 `messages:[{role, content}]`;`max_tokens`(必填,默认 4096);`model = model or config.model`。响应解析:取 `content[]` 里 `type=="text"` 的块,拼成答案;空答案抛 `ProviderCallError`(与 OpenAI provider 一致)。重试/退避复用现有 `_backoff_seconds`/`_sleep_before_retry` 思路(可抽到 base 或各自保留)。
- `stream_chat_completion(messages, model=None) -> Iterator[str]`:同样的请求体加 `stream: true`,按 SSE 解析,遇 `content_block_delta` 且 `delta.type=="text_delta"` 时 `yield delta.text`;`message_stop`/流结束时停止。生成器被 close 时关闭 httpx 流(图用关闭生成器来实现 Stop)。
- `list_models() -> list[str]`:`GET {base}/v1/models`(带鉴权头),解析 `data[].id`,排序返回;未配置或任何错误返回 `[]`(诚实,不伪造,与 OpenAI provider 同)。
- `healthcheck() -> ProviderHealth`:未配置 → `not_configured`;否则用 `GET /v1/models` 探活,成功 `healthy` 否则 `failed`,带 `baseUrl`/`model`。
- `update_config(config)`:替换内部 config(同 OpenAI provider)。
- 端点校验:复用 `net_guard`(同 OpenAI provider 的 `_ensure_endpoint_allowed(block_private=False)`,只挡 metadata),对 `{base}/v1/...` 校验。

### 3.4 工厂 + 运行时热替换
- `providers/__init__.py`(或 base)加 `build_provider(config: ProviderConfig | None) -> Provider`:`config.provider_type == "anthropic"` → `AnthropicProvider(config)`,否则 `OpenAICompatibleProvider(config)`;`config is None` → 默认 OpenAI(未配置态)。
- `RuntimeService.__init__`:`self.provider = build_provider(ProviderConfig.from_secret_settings(...))`,注入图。
- `update_provider_settings`(`app.py:433` 现在调 `self.provider.update_config(...)`):改为**重建** provider 并把新实例同时赋给 `self.provider` 和 `self.graph.provider`——因为切换 `providerType` 不是改 config 能完成的(换了类)。重建后图下次取 `self.provider` 即新实现。

> 单元边界:`Provider`(接口)、`OpenAICompatibleProvider`、`AnthropicProvider`、`build_provider`(工厂)各自单一职责,可独立测试。图/服务只依赖接口,不依赖具体实现。

## 4. 前端

provider 设置区(`ai-integrations.tsx` 的 `ProvidersSection` / `PROVIDER_CATALOG`,line ~564/580):
- 加一个 **provider 类型选择**(OpenAI-compatible | Anthropic)。选 Anthropic 时 `baseUrl` 默认 `https://api.anthropic.com`、apiKey 必填提示。
- `providerType` 进 `saveProviderSettings` 的 body(client + store)。
- 可把 Anthropic 作为 `PROVIDER_CATALOG` 的一个预设条目(name/baseUrl/需要 key)。
- 新增文案进 en+zh(i18n 平价)。

## 5. 安全

- api key 仍存 SecretStore(现有 `provider_api_key` secret),永不回明文/不入日志(`ProviderSettingsPublic` 无 key 字段,保持)。
- 端点经 `net_guard` 校验(挡 metadata),与 OpenAI provider 一致。
- `anthropic-version` 头固定一个稳定值(`2023-06-01`)。

## 6. 测试

- **pytest**:`AnthropicProvider` 注入一个假 httpx 传输(monkeypatch httpx.Client/post 或注入 transport):
  - `chat_completion`:断言请求体把 system 提出、role 映射正确、带 `max_tokens`/`anthropic-version`;响应 `content:[{type:text,text:...}]` → 正确答案;空 content → `ProviderCallError`。
  - `stream_chat_completion`:喂一串 SSE `content_block_delta`/`text_delta` → yield 出拼接文本;`message_stop` 结束。
  - `list_models`:`/v1/models` 返回 `data:[{id:..}]` → 排序;错误/未配置 → `[]`(不伪造)。
  - `healthcheck`:未配置 → `not_configured`;200 → `healthy`;错误 → `failed`。
  - `configured`:有 base+key → True;缺 key → False。
  - `build_provider`:`provider_type="anthropic"` → AnthropicProvider 实例;否则 OpenAICompatibleProvider;切换设置后服务重建并替换 `graph.provider`(端点/服务测试)。
- **vitest**:provider 类型选择渲染;切到 Anthropic 时 baseUrl 默认值正确;`providerType` 进 saveProviderSettings。
- 门禁:`uv run pytest`;`pnpm -r lint && pnpm -r test`;CI 在 PR 上跑。

## 7. 文件结构

- 新建:`runtime/python/yanshi_runtime/providers/base.py`(`Provider` Protocol;可含共享 backoff 工具)。
- 新建:`runtime/python/yanshi_runtime/providers/anthropic.py`(`AnthropicProvider`)。
- 改:`runtime/python/yanshi_runtime/providers/__init__.py`(导出 `Provider`、`AnthropicProvider`、`build_provider`)。
- 改:`providers/openai_compatible.py`(`ProviderConfig` 加 `provider_type`;`from_secret_settings` 带上;类在类型上 conform `Provider`)。
- 改:`models.py`(`ProviderSettingsUpdate`/`ProviderSettingsPublic` 加 `providerType`)。
- 改:`server/app.py`(`build_provider` 注入;`update_provider_settings` 重建并替换 `graph.provider`)。
- 改:`apps/desktop/src/features/ai-integrations.tsx`(provider 类型选择)、`stores/runtimeStore.ts` + `api/client.ts`(`providerType` 进 saveProviderSettings)、`packages/shared/src/index.ts`(ProviderSettings TS 加 `providerType`)、i18n en/zh。

## 8. 诚实边界

- 模型列表只来自 `/v1/models`,绝不伪造;未配置/错误 → 空。
- api key 仅 SecretStore,不回明文/不入日志。
- 无原生 tool-use(图编排);Anthropic 的 tool-use/caching/thinking 不在本轮,不放可点但无效的控件。
- 切到 Anthropic 但没配 key → `configured=False`,运行时如实报 `model_not_configured`(复用现有缺模型路径),不假装能跑。

## 9. 待澄清 / 残留(实施期定,均有默认)

- `max_tokens` 默认值:本轮固定 4096;是否做成可配置——暂不(YAGNI)。
- 实施时应查 `claude-api` 参考确认当前 `anthropic-version` 头与 `/v1/messages`、`/v1/models` 的字段细节(本设计用稳定的 `2023-06-01` + 标准字段)。
- 共享 backoff:OpenAI provider 的退避逻辑是否抽到 `base.py` 共享——倾向抽,但若耦合多则各自保留;实施期按代码实际定。
