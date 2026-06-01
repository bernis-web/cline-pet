# Kaka Development Guide

本文件是卡卡桌宠后续开发的主要入口，记录当前 feature 分支的架构、常用命令、状态更新链路、验证方式和最近开发结论。

## 当前分支与仓库

- 仓库：`https://github.com/bernis-web/cline-pet`
- 主开发分支：`feat/12-state-local-pet-pack`
- 本地 worktree：`d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack`
- 注意：根目录 `d:/projects/cline-mcp-workspace` 不是这个项目的 Git 仓库；实际仓库在 `cline-desktop-pet/`，后续卡卡功能主要在 `.worktrees/feat-12-state-local-pet-pack`。

## 技术栈

- Electron main process：透明置顶桌宠窗口、托盘、IPC、Bridge、DeepSeek 配置、长期记忆和心情推导。
- React/Vite renderer：宠物图片、气泡、聊天输入、设置面板、拖拽/摸头交互。
- MCP Server：通过 `update_pet_status` 和 `pet_status_check` 接收 Cline 状态更新。
- Local HTTP Bridge：默认监听 `127.0.0.1:37621`，MCP server 通过 `/status`、`/diagnostics` 与 Electron App 通信。
- Vitest：单元和 jsdom renderer 测试。
- 本地数据目录：`%APPDATA%/cline-desktop-pet/`。

## 核心目录和职责

```text
src/shared/statuses.ts        # 12 状态、旧状态别名、状态层级
src/shared/schemas.ts         # MCP payload 和 pet pack manifest zod schema
src/mcp/server.ts             # MCP 工具 update_pet_status / pet_status_check
src/bridge/bridgeClient.ts    # MCP server -> local HTTP Bridge client
src/bridge/bridgeServer.ts    # Electron App 内本地 HTTP Bridge server
src/assets/petPackManager.ts  # 资源包发现、校验、v1/v2/v3 映射
src/app/main/main.ts          # Electron 主流程、窗口、IPC、Bridge、托盘
src/app/main/chatService.ts   # DeepSeek prompt 和聊天请求编排
src/app/main/chatMood.ts      # 聊天成功后推导桌宠心情状态
src/app/main/moodEngine.ts    # mood -> suggestedStatus
src/app/main/poseResolver.ts  # mood + activity + bond -> PetStatus
src/app/main/presenceService.ts # 低频主动陪伴气泡
src/app/main/interaction/headPatService.ts # 摸头事件记录和短期 warmth
src/app/main/memory/          # profile/relationship/context memory 本地 JSON/JSONL
src/app/renderer/App.tsx      # renderer 状态聚合、气泡 auto-hide、聊天/设置/宠物包
src/app/renderer/PetView.tsx  # 宠物 UI、拖拽、摸头、双击聊天、右键设置
src/app/renderer/bubbleTypes.ts # status/chat/notice/diagnostics 气泡策略
src/app/renderer/petStyles.css # 桌宠、气泡、聊天框、动效样式
scripts/install-kaka-pet-pack.ps1 # 复制本机 PNG 到 APPDATA 资源包
scripts/install-cline-status-integration.ps1 # 写入 Cline MCP 配置和全局规则
```

## 状态模型

标准 12 状态定义在 `src/shared/statuses.ts`：

```text
idle -> happy -> sleepy -> thinking -> angry -> not-found -> message -> sleeping -> head-pat -> dragging -> loading -> signal-weak
```

旧 6 状态兼容映射：

```text
idle -> idle
thinking -> thinking
working -> loading
waiting-approval -> message
done -> happy
error -> not-found
```

`updatePetStatusSchema` 会把旧状态规范化为新状态，并输出：

- `status`
- `visibleStatus`
- `baseStatus`
- `overlayStatus`
- `normalizedFrom`（仅旧别名输入时存在）

## MCP / Bridge 状态更新链路

状态汇报路径：

```text
Cline MCP tool call
  -> src/mcp/server.ts handleUpdatePetStatus()
  -> src/bridge/bridgeClient.ts POST http://127.0.0.1:37621/status
  -> src/bridge/bridgeServer.ts validate + normalize
  -> src/app/main/main.ts notifyRenderer()
  -> renderer pet-status event
  -> src/app/renderer/App.tsx 更新 visibleStatus + 气泡
```

诊断路径：

```text
pet_status_check
  -> GET http://127.0.0.1:37621/diagnostics
  -> src/diagnostics/diagnostics.ts buildDiagnosticsReport()
```

常用排查命令：

```powershell
# 1. 确认 App Bridge 是否在线
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:37621/diagnostics' -TimeoutSec 2

# 2. 直接测试 Bridge 状态更新
$body = @{ status='loading'; task='direct bridge probe'; message='直接测试 Bridge 状态更新'; source='probe' } | ConvertTo-Json
Invoke-WebRequest -UseBasicParsing -Method POST -Uri 'http://127.0.0.1:37621/status' -ContentType 'application/json' -Body $body -TimeoutSec 2

# 3. 测试 MCP handler 到 Bridge
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
npx tsx -e "(async()=>{const m=await import('./src/mcp/server.ts'); const r=await m.handleUpdatePetStatus({status:'happy',task:'probe',message:'MCP handler probe'}); console.log(JSON.stringify(r,null,2));})().catch(e=>{console.error(e);process.exit(1)})"
```

如果以上命令能更新 `/diagnostics.currentState`，但 Cline 不会自动汇报，通常是 Cline MCP server 没重载。运行：

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
./scripts/install-cline-status-integration.ps1
```

然后重载 VS Code/Cline。确认 MCP 配置里存在 `cline-desktop-pet`，且 `args` 指向当前 feature worktree。

## 聊天、气泡和心情

- 聊天气泡在 `src/app/renderer/bubbleTypes.ts` 中由 `bubbleFromChat()` 创建，当前 `autoHideMs = 5000`。
- `src/app/renderer/App.tsx` 根据 `bubble.autoHideMs` 自动清理气泡；`diagnostics` 气泡 `autoHideMs = null` 不自动消失。
- 气泡位置在 `src/app/renderer/petStyles.css` 的 `.speech-bubble`，当前使用 `bottom: 238px`，更接近卡卡头顶。
- DeepSeek prompt 在 `src/app/main/chatService.ts`，要求卡卡“更关心用户”、可爱但不过分卖萌、简短、尊重隐私边界。
- 聊天成功后，`src/app/main/main.ts` 调用 `createChatMoodStatus()`，再 `notifyRenderer()`，让卡卡切到更明显的 mood-driven 姿态（友好聊天当前为 `happy`）。

## Cyber Life v1

- 设计文档：`docs/superpowers/specs/2026-06-01-kaka-cyber-life-v1-design.md`。
- 实现计划：`docs/superpowers/plans/2026-06-01-kaka-cyber-life-v1-implementation.md`。
- 新增本地历史文件：`%APPDATA%/cline-desktop-pet/chat-history.jsonl`。
- 渲染层现在支持：
  - 长回复聊天气泡的阅读模式。
  - 聊天气泡优先于“卡卡正在想...”提示气泡。
  - 对话历史入口和历史覆盖面板。
  - 气泡队列，减少 status/chat/presence 互相覆盖。
- 主进程现在支持：
  - `chatCoordinator` 统一串联记忆检索、聊天回复、历史写入、关系成长和心情更新。
  - `memoryExtractionService` 用 DeepSeek 对聊天做结构化记忆提炼，并写入 `context-memory.jsonl`。
  - `relationshipEvents` 让聊天也能缓慢增长 familiarity/affection/engagement/trust。
  - `presenceService` 避免在用户阅读聊天气泡时插入主动陪伴，并允许低频长工时提醒喝水。
- DeepSeek 记忆提炼只发送聊天文本和紧凑记忆摘要，不自动读取文件、代码、屏幕、终端输出或日志。
- Cyber Life v1 范围：可阅读长回复、历史面板、记忆闭环、关系成长、低频主动陪伴、气泡队列。

## 资源包

资源包根目录：

```text
%APPDATA%/cline-desktop-pet/pets/<pet-id>/
```

当前格式：

- `formatVersion: 1`：旧 6 状态包，自动 fallback 到 12 状态。
- `formatVersion: 2`：完整 12 状态包。
- `formatVersion: 3`：在 v2 基础上支持可选 `variants` 和 `actionSets`。

卡卡 PNG 不提交到 GitHub。安装命令：

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
./scripts/install-kaka-pet-pack.ps1
```

## 本地数据和隐私边界

`%APPDATA%/cline-desktop-pet/` 下当前会保存：

- `config.json`：DeepSeek API key/baseUrl/model。
- `state.json`：用户选择的宠物包 ID。
- `profile.json`：用户档案记忆。
- `relationship.json`：关系/短期 warmth 记忆。
- `context-memory.jsonl`：上下文记忆。
- `chat-history.jsonl`：最近原始聊天轮次。
- `logs/`：App/MCP 日志。

隐私约束：MCP payload 只传状态、短任务摘要、短提示和更新时间；DeepSeek 请求只传当前消息、少量上下文/记忆摘要，不传完整代码、文件内容或终端长输出。

## 常用开发命令

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack

# 安装依赖
npm install

# 运行测试
npm test

# 生产构建
npm run build

# 启动 Electron 桌宠
npm run dev:electron

# 启动 MCP server
npm run dev:mcp

# 模拟 12 状态
npm run simulate
```

## 测试策略

新增功能和 bugfix 遵循 TDD：

1. 写失败测试。
2. 跑定向测试确认 RED。
3. 写最小实现。
4. 跑定向测试确认 GREEN。
5. 跑全量 `npm test` 和 `npm run build`。

最近一次完整验证（2026-06-01）：

```text
Test Files  31 passed (31)
Tests       104 passed (104)
npm run build: renderer/main/preload passed
```

jsdom renderer 测试可能打印 `The current testing environment is not configured to support act(...)`，这是现有测试环境警告；只要 Vitest 最终 exit 0 且汇总通过即可。

## Git 注意事项

- `.worktrees/` 已被 `.gitignore` 忽略。
- `.superpowers/` 是本地设计/过程目录，当前不提交。
- 提交前用路径明确 `git add`，避免误提交本地素材、日志或 `.superpowers/`。
- 当前 feature 分支已经推送到 GitHub；完成后用：

```powershell
git status --short --branch
git add <明确文件列表>
git diff --cached --stat
git commit -m "docs: update kaka development compact"
git push origin feat/12-state-local-pet-pack
```
