# 偃师工坊重设计 · 设计文档

- 日期:2026-06-16
- 状态:已通过设计评审,待用户复核后进入实施计划
- 范围:重设计 `偃师工坊`(Workshop)——从 4-tab 弹窗改为全屏「造物台」,统一偃师与工作室编辑,强化「偃师造物」隐喻与现代极简交互。

---

## 1. 背景与问题

现有工坊是一个 4-tab 居中弹窗(`apps/desktop/src/features/workshop.tsx`):Installed / Agent Editor / Office Editor / Create-Export。已知问题:

- 🔴 **作用域断裂**:`agentProfiles` 是全局的(`runtimeApi.agentProfiles()`),`officeState` 是按项目的(`loadOfficeState(projectId)`),但工坊永远 `loadOfficeState(null)` 只编辑全局工作室。在某项目内打开工坊,改的并不是该项目的 atelier,与 README「每个项目拥有自己的团队与工作室」相矛盾。
- 🟠 **信息架构重叠**:Installed 与 Create/Export 都在管 pack;Agent Editor(谁)与 Office Editor(站哪)是同一支团队的两个视角却被拆开。
- 🟠 **造物体验薄弱**:性格是单行 input、prompt 是无说明 textarea、优先级是裸 1–10 滑块;模型与工具散落在 Settings 且全局;**编辑时没有预览**,看不到偃师长什么样/站哪/会做什么。
- 🟠 **所见非所得**:编辑用 2D 俯视 SVG,运行时是 2.5D/3D Atelier 场景。
- 🟡 **隐喻与质感缺位**:核心叙事场所却呈现为普通表单弹窗。

## 2. 目标 / 非目标

**目标**
- 把工坊重做成全屏「造物台」,统一编辑偃师身份与工作室布局,带实时预览。
- 兑现「每个项目一队完全独立的偃师 + 工作室」。
- 一处定义一个偃师的完整存在:身份 / 性情 / 心智(模型) / 本事(工具) / 咒文(prompt)。
- 古法机关坊视觉,但**色值跟随主题**(亮/暗 + accent),不写死。
- 现代极简交互:图标优先、同类收纳、渐进展开、少而丰富。

**非目标**
- 不做 3D 重建/寻路/Lottie(沿用 `packages/live-office` 现有渲染能力,保持诚实)。
- 不实现 pack 的 runtime enable/disable(现状不支持,保持诚实,不放假开关)。
- 不在本次引入新的 provider/鉴权机制;沿用现有 SecretStore / 模型设置。

## 3. 术语

- **偃师(yanshi worker)**:一个 agent 工人(原 6 工种:管理 / 浏览 / 计算机 / 文件 / 审阅 / 终端)。UI 文案统一称「X 偃师」。
- **造物台(crafting bench)**:全屏工坊主界面。
- **铸造(forge)**:新建一个偃师的动作。
- **工作室(atelier / office)**:偃师所处的可视化场景与布局。
- **咒文(incantation)**:偃师的系统 prompt。

> 代码标识符、注释、i18n key 仍用英文(`workshop.*`、`agent`、`station` 等);仅展示文案改为「偃师」。

## 4. 已定决策(设计评审结论)

| # | 决策 | 选择 |
|---|---|---|
| 1 | 形态 | **全屏造物台**(取代弹窗) |
| 2 | 工人命名 | **偃师** |
| 3 | 团队作用域 | **每个项目完全独立的一队**;全局 = 无项目/独立对话默认 |
| 4 | 偃师定义深度 | 身份 + 性情 + **心智(每偃师模型)** + **本事(每偃师工具集)** + 咒文 |
| 5 | 视觉 | **古法机关坊**,经主题 token 驱动(跟随主题色) |
| 6 | 交互 | 现代极简:图标优先、同类收纳、渐进展开 |

## 5. 架构与布局

### 5.1 形态
现状:工坊是弹窗(`App.tsx` 的 `workshopOpen` → `<WorkshopModal>`)。目标:把它改成**主内容区视图**,与现有 `library` / `developer` 视图同级(`view === "workshop" && <WorkshopWorkspace/>`),占据 nav 侧栏之外的整个内容区——即本 app 语境下的「全屏」。导航项已存在(`App.tsx:416`),只需从 `setWorkshopOpen(true)` 改为 `navigate("workshop")`;`open-workshop` 快捷命令同改。退出 = 切到别的视图(无需独立关闭态)。

> 复用现有 `features/live-office.tsx` 的 `AtelierWindow`(它已包裹 `packages/live-office` 渲染)作为中栏预览;`AtelierModal` 维持不变,造物台与它共享同一份按项目的 office state。

### 5.2 三栏布局
```
┌ 顶栏: 偃师工坊 · ⌂工作室作用域▾            ⤓分享  ✕ ┐
├─────────┬──────────────────────────┬───────────────┤
│ 偃师栏   │      实时工作室预览          │   偃师检视      │
│(图标头像)│  (灯下场景, 拖动调工位)       │ (身份常驻+分段) │
│ ＋铸造   │  [家具 相机 吸附 重置 图标条]  │               │
└─────────┴──────────────────────────┴───────────────┘
```

- **左·偃师栏(WorkerRail)**:窄列,每个偃师为圆形头像图标(工种 lucide 图标 + accent 描边);选中态高亮 + accent 辉光;运行中显示状态圆点;名字靠 `title`/选中标签显示。底部 `＋ 铸造新偃师`。
- **中·实时工作室预览(AtelierPreview)**:复用 `packages/live-office` 渲染;灯下场景;选中偃师高亮;**可直接拖动偃师工位与家具**(替代旧独立 2D Office Editor);底部浮动**图标工具条**(家具 / 相机视角 / 网格吸附 / 重置)。
- **右·偃师检视(WorkerInspector)**:身份常驻顶部;性情 / 心智 / 本事 / 咒文 折进一条**图标分段条**,一次只展开一段。

### 5.3 组件分解(每个单一职责,可独立理解与测试)
- `WorkshopWorkspace` — 全屏容器、作用域状态、选中偃师状态、布局编排。
- `WorkerRail` — 偃师图标列表 + 铸造入口。
- `AtelierPreview` — 以 `AtelierWindow`(运行时同款渲染)为底,叠加可编辑层:拖动偃师工位/家具并提交,加图标工具条。取代旧的、与运行时渲染分叉的 2D `OfficeLayoutCanvas`(其拖拽/吸附/坐标逻辑抽到 `lib/atelier.ts` 复用)。
- `WorkerInspector` — 身份头 + 分段条 + 当前段面板。
- `inspector/` 子面板:`IdentitySection` / `TemperamentSection` / `MindSection` / `AbilitiesSection` / `IncantationSection`。
- `SharePanel` — pack 导入/导出(从 `WorkshopInstalled` + `WorkshopExport` 合并)。
- `ForgeWorkerFlow` — 铸造引导。

旧 `workshop.tsx`(509 行,职责过多)拆成上述受界面约束的小文件;纯函数(`worldToSvg`、`STATION_DEFAULTS` 等)抽到 `lib/atelier.ts` 复用与单测。

## 6. 数据模型与作用域 🔧后端改动

### 6.1 偃师 profile 项目化
现状:agent profile 全局。目标:**按项目独立**(与 office state 同模式)。

- Storage:agent profile 增加 `project_id`(可空,`NULL` = 全局默认队)。迁移走现有 `PRAGMA user_version` runner(事务化、每步独立),`_SCHEMA_VERSION` +1。迁移时把现有全局 profile 作为 `project_id IS NULL` 的默认队保留。
- API:`GET/PUT /agents` 增加 `projectId` 维度(沿用 office 端点风格)。新项目首次进入造物台时,从全局默认队**克隆**出本项目队(惰性物化)。
- 前端:`runtimeApi.agentProfiles(projectId)`;store 的 `agentProfiles` 随 `activeProjectId` 加载;造物台顶栏「工作室 ▾」切换全局/各项目。

### 6.2 偃师新增字段
profile 增加:
- `model`(心智):模型 id;空 = 继承全局当前模型。
- `reasoning`(心智):推理强度;空 = 继承。
- `tools`(本事):该偃师可用工具集合(白名单)。

> 这些字段**写入 SQLite 不涉密**(模型 id / 工具名,非密钥);provider 密钥仍只存 SecretStore,绝不入库/日志。

## 7. 偃师检视 · 五段

| 段 | 图标(lucide) | 内容 | 新增? |
|---|---|---|---|
| 身份(常驻) | 头像 + `Pencil` | 名字(行内编辑)/ 工种 / 配色(默认「主题色」,可覆盖) | 否 |
| 性情 | `SlidersHorizontal` | 性格(短语)/ 行为模式(分段控件)/ 优先级(带语义档位的滑块) | 改良 |
| 心智 | `BrainCircuit` | 模型(chip→下拉)/ 推理强度(图标档位) | **是** |
| 本事 | `Wrench` | 工具图标开关网格(文件/浏览/终端/计算机…) | **是** |
| 咒文 | `ScrollText` | 系统 prompt,羊皮卷质感、带占位说明 | 改良 |

**本事约束(诚实)**:工具开关受**全局工具开关 + 权限上限**约束——不能为偃师勾出未安装/未授权/全局关闭的能力;此类项灰显并在 `title` 说明原因(复用现有 `missingRequirement` 文案体系)。

## 8. 视觉系统:主题驱动的古法机关坊

在 `src/styles.css` 现有 token 之上,新增一小撮 `--workshop-*`,**全部 `color-mix` 自现有变量派生**,随 `:root` / `:root[data-theme="dark"]` 自动切换:

- 结构材质(木/面板/边)← `--surface` / `--background` / `--border` 阶,暖向微调。
- 黄铜配件 / 灯火辉光 / 选中态 / 点亮的偃师 ← `--accent` / `--accent-glow` / `--accent-soft`。
- 咒文区羊皮色 ← `--surface-elevated` 暖向 token。
- 衬线 ← 现成 `--font-display`(含 CJK 宋体)。

示意 token(具体值实现期定):
```css
:root {
  --workshop-wood: color-mix(in srgb, var(--surface) 88%, #6b4f2e);
  --workshop-panel: color-mix(in srgb, var(--surface-elevated) 90%, #5a4326);
  --workshop-brass: var(--accent);
  --workshop-lamp: var(--accent-glow);
  --workshop-parchment: color-mix(in srgb, var(--surface-elevated) 80%, #d8c79e);
}
```
换主题时木纹冷暖与铜光颜色一起变,不写死。遵守现有 `prefers-reduced-motion` 处理。

## 9. 现代极简交互细则

- **图标优先**:角色、分段、工具、家具/相机/吸附/重置、分享/关闭均用 lucide 图标;每个图标控件**必须**带 `aria-label` + `title`(可访问性 + 悬停说明),满足「图标代替文字但仍可懂」。
- **同类收纳 + 渐进展开**:检视一次只展开一段;左栏名字靠悬停/选中;深度选项藏在 chip/下拉/分段后。
- **图标精确定位**(收尾要求):统一 `1em` 图标盒、flex/grid 居中、光学对齐(stroke 图标视觉中心校正);预览内的工种图标经 `worldToSvg` 定位,与运行时一致。

## 10. 窗口尺寸自适应(收尾要求)

造物台用 CSS 容器/媒体查询分档(全屏 feature,优先 container query):

- **≥1100px**:完整三栏。
- **760–1100px**:左栏保持图标列(更窄),检视收窄,分段条图标可换行;预览自适应缩放(SVG `preserveAspectRatio` 已支持)。
- **<760px(小窗)**:预览为主 + 检视转为**右侧滑出层**(选中偃师时滑出),左栏保留 48px 细图标条;预览设 `min-height`。
- **极小**:预览在上、检视在下纵向堆叠;设合理 `min-width`,避免控件挤压。

## 11. 分享(pack)

右上「分享」图标入口(`Share2`),弹出轻面板:导入 pack(沿用现有 `WorkshopPackValidator` 安全校验:大小/数量/路径穿越/符号链接/可执行后缀/允许根目录)、导出当前项目的团队+工作室为 zip(沿用 scoped ticket 的 `exportPackUrl()`)。**不展示 enable/disable / remove 假开关**(现状不支持)。

## 12. 铸造新偃师

轻引导 `ForgeWorkerFlow`:选工种 → 命名 → 落到一个空工位(默认 `STATION_DEFAULTS`)→ 进入检视微调。取代现在直接塞 `New Agent` 默认值。

## 13. 诚实边界(沿用既定约束)

- 不引入 mock;不放假成功态。
- **心智 / 本事**在 runtime 支持落地前:UI 只读展示**当前真实生效值**,或明确标注「待运行时支持」;**绝不显示能改但不生效的假开关**。
- 模型 id / 工具名可入 SQLite;**provider 密钥仅 SecretStore**,不入库/API/日志。
- pack 的 enable/disable/remove 维持诚实缺省。
- Apple Developer ID 签名/公证不在本设计范围,公开发布前另行完成。

## 14. 工程拆分(各自 spec→plan→实施)

- **子项目 I · 造物台 UI**:前端重构(组件分解 + 三栏 + 检视 + 分享 + 铸造)、agent profile 项目化(storage 迁移 + API + store)、预览整合、主题 token、响应式。心智/本事段先呈现真实生效值(只读或标注)。
- **子项目 II · runtime 按偃师配置模型/工具**:LangGraph 执行按偃师读取 `model`/`reasoning`/`tools`,工具门控从全局收敛到「全局 ∩ 偃师白名单 ∩ 权限上限」。完成后造物台的心智/本事段转为可写。

先做 I,II 紧随。两者之间 UI 保持诚实(不可写处不假装可写)。

## 15. 测试

- Python:storage 迁移测试(全局→项目克隆、默认队保留)、agent API 项目维度、(II)按偃师模型/工具门控的图执行测试,沿用 `pytest -p no:cacheprovider`。
- 前端:`lib/atelier.ts` 纯函数单测(world↔svg、默认工位、克隆逻辑);组件渲染/响应式断点测试;i18n en/zh 平价编译测试;`tsc` + `vitest` + lint。
- 视觉:亮/暗主题 + 改 accent 时 token 派生正确;reduced-motion 生效。

## 16. 待澄清 / 残留

- 心智段的「模型」候选从何而来(全局可用模型列表的来源与 ACP/provider 关系)——实施 II 时确认。
- 极小窗口下的纵向堆叠是否值得做,或设最小窗口尺寸即可——实施 I 时按真实窗口范围定。
- 偃师配色「跟随主题色」与「自定义色」并存时,运行时工作室渲染的取色优先级——实施 I 时定。
