# Cline Desktop Pet 12-State Local Pet Pack Design

## 1. 摘要

本规格定义 Cline 桌面宠物下一阶段升级方案：在现有 Windows 11 Electron + React + MCP 桌宠 MVP 基础上，将桌宠从原来的 6 个工作状态扩展为 12 个动作状态，并导入用户本机已经制作好的透明 PNG 桌宠素材。

本阶段采用“方案 B”：

- 桌宠状态扩展到 12 个动作。
- MCP 工具和本地模拟器都支持 12 状态。
- 引入 `baseStatus + overlayStatus` 二层状态模型，为未来更完整的陪伴体能力预留接口。
- 用户 PNG 素材不提交到 GitHub 仓库，只通过安装脚本复制到本机 `%APPDATA%` 下的宠物资源包目录。
- 继续保持当前 Electron 透明置顶窗口、托盘、本地 MCP Server、本地 Bridge、宠物资源包机制。

本规格聚焦 B 阶段，不直接照搬 Alife 的完整 Live2D、长期记忆、主动事件、语音、浏览器与插件体系；但状态模型、资源包格式和交互边界会保持可自然演进到 C 阶段的结构。

## 2. 背景与设计目标

### 2.1 当前基础

当前项目已经具备：

- Windows 11 Electron 透明置顶桌宠窗口。
- React/Vite/TypeScript 渲染层。
- 本地 MCP Server，提供 `update_pet_status` 和 `pet_status_check`。
- 本地 Bridge，用于 MCP Server 与 Electron App 通信。
- 托盘菜单、日志、诊断、宠物资源包发现与选择。
- 6 个旧状态：`idle`、`thinking`、`working`、`waiting-approval`、`done`、`error`。
- 生产环境可见性与 `file://` 资源路径问题已经修复。

### 2.2 新需求

用户提供了本地素材目录：

```text
E:\xwechat_files\wxid_2gvkgptwgs8b22_6b72\msg\file\2026-05\桌宠小人(1)\桌宠小人
```

其中正式导入的 12 个透明 PNG 文件为：

| 序号 | 原始文件名 | 状态 slug | 中文状态 |
| --- | --- | --- | --- |
| 01 | `01_待机_1024透明PNG_v2.png` | `idle` | 待机 |
| 02 | `02_开心_1024透明PNG_v1.png` | `happy` | 开心 |
| 03 | `03_困困_1024透明PNG_v1.png` | `sleepy` | 困困 |
| 04 | `04_思考_1024透明PNG_v3.png` | `thinking` | 思考 |
| 05 | `05_炸毛_1024透明PNG_v1.png` | `angry` | 炸毛 |
| 06 | `06_装死404_1024透明PNG_v1.png` | `not-found` | 装死 404 |
| 07 | `07_收到消息_1024透明PNG_v1.png` | `message` | 收到消息 |
| 08 | `08_睡觉_1024透明PNG_v1.png` | `sleeping` | 睡觉 |
| 09 | `09_摸头反应_1024透明PNG_v1.png` | `head-pat` | 摸头反应 |
| 10 | `10_拖拽反应_1024透明PNG_v1.png` | `dragging` | 拖拽反应 |
| 11 | `11_加载中_1024透明PNG_v1.png` | `loading` | 加载中 |
| 12 | `12_信号弱_1024透明PNG_v1.png` | `signal-weak` | 信号弱 |

同目录中的 `*_green_raw*.png`、`*_透明效果预览*.png`、设定板和总览图不作为本阶段运行时状态资源导入。

### 2.3 参考 Alife 的取舍

参考项目 `BDFFZI/Alife` 的价值重点是：桌宠作为陪伴体/赛博生命、模块化扩展、主动活动、桌宠交互、长期可扩展能力。

本项目当前不直接复刻 Alife 的完整能力，而是吸收其方向感：

- 当前阶段先让宠物“动作更丰富、状态更像陪伴体”。
- 通过二层状态模型支持后续主动事件、交互反应、动作队列和更完整 AI 桌宠能力。
- 保持 Electron + MCP 的轻量本地结构，避免过早引入复杂运行时。

## 3. 目标

1. 将桌宠状态系统扩展为 12 个标准动作状态。
2. 让 MCP `update_pet_status` 接受并校验 12 状态。
3. 让本地状态模拟器循环展示 12 状态，便于手动验收。
4. 新增本地素材安装流程，将用户 PNG 安装为 `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/` 宠物包。
5. 宠物包 manifest 支持 12 状态资源映射。
6. 保留旧 6 状态别名兼容，避免历史规则或旧 MCP 调用立即失效。
7. 引入 `baseStatus + overlayStatus` 的设计边界，为 C 阶段交互和主动陪伴能力做结构准备。
8. 明确素材隐私约束：用户 PNG 不提交到 GitHub，不进入 npm 包，不进入默认仓库资源。

## 4. 非目标

- 不在本阶段实现 Live2D。
- 不在本阶段实现长期记忆、语音、视觉识别、浏览器自动化或插件市场。
- 不在本阶段把用户素材提交到 GitHub。
- 不在本阶段重写现有 Electron/MCP/Bridge 架构。
- 不在本阶段要求接入 Cline 内部私有 API。
- 不在本阶段实现复杂 AI 自主决策；只预留 C 阶段可接入的状态与事件结构。

## 5. 状态系统

### 5.1 12 个标准状态

| 状态 slug | 中文标签 | 类型 | 含义 | 建议触发场景 |
| --- | --- | --- | --- | --- |
| `idle` | 待机 | base | 默认空闲状态 | 无任务、任务结束后回落 |
| `happy` | 开心 | base | 成功、鼓励、正向反馈 | 步骤完成、任务成功 |
| `sleepy` | 困困 | base | 轻微疲惫或低活跃 | 长时间空闲、等待较久 |
| `thinking` | 思考 | base | 正在分析、计划、推理 | 阅读需求、规划方案、排查问题 |
| `angry` | 炸毛 | overlay-first | 强烈提醒或小情绪 | 连续失败、用户打断、异常但非致命 |
| `not-found` | 装死 404 | base | 错误、失败、不可达 | 命令失败、资源缺失、Bridge 不可达 |
| `message` | 收到消息 | overlay-first | 有新消息或等待用户输入 | 等待用户审批、询问澄清 |
| `sleeping` | 睡觉 | base | 深度空闲 | 长时间无更新、用户隐藏工作流 |
| `head-pat` | 摸头反应 | overlay | 用户摸头/点击互动 | 未来 C1 点击或摸头交互 |
| `dragging` | 拖拽反应 | overlay | 用户拖拽窗口 | 拖动桌宠窗口时 |
| `loading` | 加载中 | base | 正在执行具体工作 | 读文件、改代码、跑命令、构建测试 |
| `signal-weak` | 信号弱 | base | 状态过期或通信异常 | 长时间无 MCP 更新、网络/Bridge 状态弱 |

说明：

- `base` 表示可以长期停留的基础状态。
- `overlay` 表示短时覆盖状态，结束后应回到先前的 `baseStatus`。
- `overlay-first` 表示当前阶段可以当作普通状态使用，未来 C 阶段优先升级为短时覆盖动作。

### 5.2 旧 6 状态兼容映射

为兼容既有 `.clinerules`、MCP 调用、测试和用户习惯，旧状态输入仍应被接受，并规范化为新状态：

| 旧状态 | 新状态 | 理由 |
| --- | --- | --- |
| `idle` | `idle` | 原义保留 |
| `thinking` | `thinking` | 原义保留 |
| `working` | `loading` | 新素材中“加载中”更贴近工作执行 |
| `waiting-approval` | `message` | 等待审批/输入本质是收到消息或提醒用户 |
| `done` | `happy` | 完成后展示开心反馈 |
| `error` | `not-found` | 错误态由 404 装死图表达 |

实现要求：

- `PetStatus` 对外文档以 12 状态为标准集合。
- MCP 输入允许旧状态别名。
- Bridge 与 Renderer 收到的状态应尽量是规范化后的新状态。
- 诊断信息可以显示 `normalizedFrom` 字段，用于说明旧状态被映射到了哪个新状态。

## 6. 二层状态模型

### 6.1 模型定义

下一阶段应采用如下概念模型：

```ts
type PetBaseStatus =
  | "idle"
  | "happy"
  | "sleepy"
  | "thinking"
  | "not-found"
  | "message"
  | "sleeping"
  | "loading"
  | "signal-weak";

type PetOverlayStatus =
  | "angry"
  | "head-pat"
  | "dragging";

type PetVisibleStatus = PetBaseStatus | PetOverlayStatus;

interface PetStateModel {
  baseStatus: PetBaseStatus;
  overlayStatus: PetOverlayStatus | null;
  visibleStatus: PetVisibleStatus;
  task?: string;
  message?: string;
  updatedAt: string;
  overlayExpiresAt?: string;
  normalizedFrom?: string;
}
```

### 6.2 渲染优先级

Renderer 展示时使用：

```text
visibleStatus = overlayStatus ?? baseStatus
```

示例：

- Cline 正在执行任务：`baseStatus = loading`。
- 用户拖拽桌宠窗口：`overlayStatus = dragging`。
- 拖拽结束后：`overlayStatus = null`，恢复显示 `loading`。

### 6.3 本阶段实现边界

本阶段的实现可以先以单字段 `status` 对外暴露，但内部模块应避免把状态处理写死成“只有一个永久状态”。推荐演进路径：

1. 共享层先定义 12 状态、旧状态别名和状态分类。
2. MCP 继续接受 `status` 字段，并可选接受 `layer` 字段。
3. Renderer 当前使用 `visibleStatus` 选择图片。
4. 未来 C1 交互上线时，再让拖拽、摸头等事件写入短时 `overlayStatus`。

## 7. MCP 与 Bridge 设计

### 7.1 `update_pet_status` 输入

MCP 工具继续使用 `update_pet_status`，但状态枚举扩展到 12 状态，并接受旧状态别名。

推荐输入：

```json
{
  "status": "loading",
  "task": "扩展桌宠状态系统",
  "message": "我正在更新 12 状态资源包设计。",
  "source": "cline",
  "updatedAt": "2026-05-27T04:20:00.000Z"
}
```

可选扩展字段：

```json
{
  "status": "head-pat",
  "layer": "overlay",
  "durationMs": 1200,
  "message": "摸摸头～"
}
```

字段约束：

- `status`：12 标准状态之一，或旧 6 状态别名之一。
- `layer`：可选，取值为 `base` 或 `overlay`；省略时由状态分类推断。
- `durationMs`：可选，仅对 overlay 状态有意义。
- `task`：短任务摘要，不包含代码或完整提示词。
- `message`：短提示，不包含敏感文件内容。
- `source`：默认 `cline`。
- `updatedAt`：可省略，由 MCP Server 补当前时间。

### 7.2 `update_pet_status` 输出

推荐输出：

```json
{
  "ok": true,
  "status": "loading",
  "visibleStatus": "loading",
  "baseStatus": "loading",
  "overlayStatus": null,
  "delivered": true,
  "updatedAt": "2026-05-27T04:20:00.000Z"
}
```

当输入为旧状态时：

```json
{
  "ok": true,
  "status": "loading",
  "normalizedFrom": "working",
  "visibleStatus": "loading",
  "baseStatus": "loading",
  "overlayStatus": null,
  "delivered": true,
  "updatedAt": "2026-05-27T04:20:00.000Z"
}
```

### 7.3 `pet_status_check`

诊断输出应扩展显示：

- 当前 `baseStatus`。
- 当前 `overlayStatus`。
- 当前 `visibleStatus`。
- 上一次输入是否经过旧状态别名映射。
- 当前选中的宠物包 ID。
- 当前宠物包是否包含全部 12 状态资源。
- 本地素材安装路径是否存在。

## 8. 本地宠物资源包安装方案

### 8.1 安装目标路径

用户素材安装到：

```text
%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/
```

目标目录示例：

```text
%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/
  manifest.json
  idle.png
  happy.png
  sleepy.png
  thinking.png
  angry.png
  not-found.png
  message.png
  sleeping.png
  head-pat.png
  dragging.png
  loading.png
  signal-weak.png
```

### 8.2 安装脚本职责

应新增一个本地安装脚本，例如：

```text
scripts/install-kaka-pet-pack.ps1
```

脚本职责：

1. 接收或内置源素材目录路径。
2. 校验 12 个正式透明 PNG 源文件存在。
3. 创建 `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/`。
4. 将源文件复制并重命名为标准 slug 文件名。
5. 生成 `manifest.json`。
6. 输出安装结果、目标路径和缺失文件提示。
7. 不删除用户源素材目录。
8. 不把 PNG 写入仓库目录。

### 8.3 manifest 格式

`kaka-desktop-pet` 的 manifest 推荐为：

```json
{
  "id": "kaka-desktop-pet",
  "name": "卡卡桌宠小人",
  "version": "1.0.0",
  "author": "local",
  "description": "用户本机安装的 12 状态透明 PNG 桌宠小人。",
  "formatVersion": 2,
  "states": {
    "idle": "idle.png",
    "happy": "happy.png",
    "sleepy": "sleepy.png",
    "thinking": "thinking.png",
    "angry": "angry.png",
    "not-found": "not-found.png",
    "message": "message.png",
    "sleeping": "sleeping.png",
    "head-pat": "head-pat.png",
    "dragging": "dragging.png",
    "loading": "loading.png",
    "signal-weak": "signal-weak.png"
  },
  "metadata": {
    "source": "local-user-assets",
    "assetType": "transparent-png",
    "recommendedSize": 1024
  }
}
```

### 8.4 资源包校验规则

资源包管理器应校验：

- `id` 是目录安全字符串。
- `name` 非空。
- `formatVersion` 缺省时按旧 6 状态包处理；值为 `2` 时按 12 状态包处理。
- `states` 包含 12 个标准状态键。
- 每个状态引用的 PNG 文件存在于资源包目录内。
- 引用路径不能逃逸资源包目录。
- 未知额外字段允许存在，以支持未来扩展。

### 8.5 默认资源包兼容

现有默认资源包可以继续作为兜底资源存在。升级策略：

- 如果默认包仍只有 6 状态，应用应通过旧状态映射或 fallback 图片保证不崩溃。
- 如果当前选中的 `kaka-desktop-pet` 包完整，优先使用 12 状态资源。
- 若用户未安装本地包，应用仍能启动并显示默认宠物。
- 若本地包缺失某个状态资源，诊断应报告无效包并回退到默认包。

## 9. Renderer 交互与显示

### 9.1 状态图片选择

Renderer 使用 `visibleStatus` 从当前资源包 `states` 中取图片：

```text
image = selectedPetPack.states[visibleStatus]
```

如果当前资源包缺少 `visibleStatus`：

1. 先尝试使用状态别名或同类 fallback。
2. 再尝试 `idle`。
3. 最后回退到内置默认 SVG 或默认包图片。

### 9.2 UI 文案

底部面板应显示中文标签，例如：

- `loading` -> `加载中`
- `message` -> `收到消息`
- `signal-weak` -> `信号弱`

若输入是旧状态，面板可只显示新状态中文标签，诊断面板再展示映射信息。

### 9.3 窗口交互预留

本阶段可以只完成状态渲染，不强制完成真实摸头/拖拽事件。但代码结构应为 C1 预留：

- `PetView` 可在点击或 hover 区域触发 `head-pat`。
- 主进程拖拽窗口时可触发 `dragging`。
- overlay 状态结束后恢复原 `baseStatus`。

## 10. 模拟器策略

`src/simulator/cycleStates.ts` 应从旧 6 状态循环升级为 12 状态循环。

循环顺序建议与素材编号一致：

```text
idle -> happy -> sleepy -> thinking -> angry -> not-found -> message -> sleeping -> head-pat -> dragging -> loading -> signal-weak
```

模拟器目的：

- 快速验证 12 张图是否都能显示。
- 验证 MCP/Bridge/Renderer 对 12 状态一致处理。
- 验证旧状态别名不影响新状态循环。

## 11. 文档更新要求

实现阶段应同步更新：

- `README.md`：说明如何安装本地素材包、如何启动、如何验证 12 状态。
- `docs/pet-pack-format.md`：说明 `formatVersion: 2` 与 12 状态 manifest。
- `docs/cline-global-rule.md`：将旧状态调用建议更新为 12 状态，保留旧状态兼容说明。

## 12. 测试与验收标准

### 12.1 自动化测试

应新增或更新测试覆盖：

1. `src/shared/statuses.ts`
   - 12 标准状态全部有效。
   - 旧 6 状态别名可规范化。
   - 未知状态被拒绝。
   - base/overlay 分类正确。

2. `src/shared/schemas.ts`
   - `updatePetStatusSchema` 接受 12 状态。
   - `updatePetStatusSchema` 接受旧状态别名。
   - manifest schema 支持 `formatVersion: 2` 与 12 状态。

3. `src/assets/petPackManager.ts`
   - 完整 12 状态包校验通过。
   - 缺失状态文件时校验失败并给出明确原因。
   - 旧 6 状态默认包仍可作为 fallback。

4. `src/mcp/server.ts`
   - `update_pet_status` 可处理 12 状态。
   - 旧状态输入返回 `normalizedFrom`。
   - 非法状态返回结构化错误。

5. `src/simulator/cycleStates.ts`
   - 循环状态数量为 12。
   - 循环顺序与规格一致。

### 12.2 手动验收

验收通过条件：

1. 运行安装脚本后，`%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/` 存在 manifest 和 12 个标准 PNG。
2. 桌宠应用启动后可以选择或自动使用 `kaka-desktop-pet`。
3. 模拟器可以依次展示 12 个动作状态。
4. MCP `update_pet_status` 可以将桌宠切换到任意一个新状态。
5. 旧状态 `working`、`waiting-approval`、`done`、`error` 仍可调用并被映射。
6. PNG 文件没有出现在 Git 提交中。
7. `npm test` 通过。
8. `npm run build` 通过。

## 13. B 到 C 的演进路线

### C1：真实桌宠交互

- 点击/摸头触发 `head-pat`。
- 拖拽窗口触发 `dragging`。
- 长时间空闲从 `idle` 进入 `sleepy` 或 `sleeping`。
- Bridge 支持短时 overlay 状态过期恢复。

### C2：动作队列与气泡队列

- 引入动作队列，避免多个状态更新互相覆盖。
- 引入气泡消息队列，短消息逐条显示。
- 支持状态优先级，例如错误高于普通 loading。

### C3：主动事件与轻量陪伴行为

- 定时问候、久坐提醒、状态过期提醒。
- 根据最近工作状态触发轻量陪伴反馈。
- 仍保持隐私边界，不读取代码内容。

### C4：更完整 AI 桌宠能力

- 在用户明确授权后接入更复杂的记忆、插件、语音或浏览器能力。
- 借鉴 Alife 的模块化架构，但保留本项目 Electron + MCP 的轻量本地核心。
- 将“状态显示工具”逐步升级为“有个性、有记忆边界、有主动性的陪伴体”。

## 14. 实现边界与文件影响

预计实现阶段会修改：

- `src/shared/statuses.ts`：12 状态、中文标签、别名映射、状态分类。
- `src/shared/schemas.ts`：MCP payload 和 manifest schema。
- `src/assets/petPackManager.ts`：12 状态包发现与校验。
- `src/mcp/server.ts`：MCP 工具输入输出兼容。
- `src/bridge/bridgeTypes.ts`：状态模型类型扩展。
- `src/app/renderer/App.tsx`：使用规范化状态与资源包图片。
- `src/app/renderer/PetView.tsx`：为 overlay 交互预留事件入口。
- `src/simulator/cycleStates.ts`：12 状态循环。
- `scripts/install-kaka-pet-pack.ps1`：本地素材安装脚本。
- `docs/pet-pack-format.md`、`docs/cline-global-rule.md`、`README.md`：使用说明更新。
- 相关测试文件：覆盖状态、schema、资源包、MCP、模拟器。

实现阶段不应修改：

- 不应提交用户 PNG 素材。
- 不应引入远程服务依赖。
- 不应把 Bridge 绑定到非 localhost 地址。
- 不应移除旧状态兼容。

## 15. 隐私与仓库约束

- 用户素材属于本地素材，不进入 GitHub 仓库。
- 安装脚本只复制到 `%APPDATA%`，不复制到 `src/assets`。
- README 可以记录源目录示例，但不应要求其他机器必须存在相同路径。
- 日志和诊断只记录资源包 ID、目标安装路径和缺失文件名，不记录图片内容。
- MCP 状态更新继续只传短任务摘要和短消息，不传代码、文件内容、完整提示词或终端长输出。

## 16. 规格自检

- 范围检查：本规格聚焦 12 状态、本地素材安装、MCP/模拟器扩展和 B 到 C 的兼容地基。
- 一致性检查：状态 slug、中文标签、素材文件、manifest 示例和模拟器顺序保持一致。
- 兼容性检查：旧 6 状态有明确映射，默认资源包有 fallback 策略。
- 隐私检查：用户 PNG 不进入仓库，只安装到 `%APPDATA%`。
- 可演进性检查：`baseStatus + overlayStatus` 支持未来 C1/C2/C3/C4，不要求本阶段一次性完成全部陪伴体能力。
- 占位检查：本文档不包含未决占位项；所有关键设计选择均已给出明确结论。