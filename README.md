# Cline 桌面电子宠物（Cline Desktop Pet）

一个面向 **Windows 11** 的 Cline 桌面悬浮电子宠物。它使用 **Electron** 做透明置顶桌宠窗口，使用 **MCP Server** 接收 Cline 状态更新，并支持像素宠物资源包、托盘菜单、开机自启和一键诊断。

> 当前是 MVP 原型：核心代码、测试、构建、MCP 工具、资源包结构都已具备；Electron 首次启动需要下载 Electron 二进制，国内网络可能较慢。

## 功能特性

- Windows 11 透明、置顶、无边框桌宠窗口
- 桌宠窗口可在桌面显示和拖动，但不占用 Windows 任务栏；通过系统托盘驻留
- 宠物优先布局：像素宠物在中央，需要时通过对话气泡显示状态和提醒
- 支持临时聊天输入框与 DeepSeek 聊天回复气泡
- 轻量状态动效：idle 浮动、thinking 呼吸、happy 弹跳、loading 摇摆、error/signal 抖动
- 12 个状态：idle、happy、sleepy、thinking、angry、not-found、message、sleeping、head-pat、dragging、loading、signal-weak
- MCP 工具：update_pet_status、pet_status_check
- 本地 HTTP Bridge：MCP Server 通过本地接口把状态送到 Electron App
- 托盘菜单：显示/隐藏、运行诊断、打开日志、选择宠物、刷新宠物资源包、开机自启、退出
- 本地像素宠物资源包切换
- 隐私默认安全：只传状态和短任务摘要，不传代码/文件内容

## 环境要求

- Windows 11
- Node.js 20+（建议新版 LTS 或更高）
- npm
- Git（可选，用于拉取仓库）

## 一键启动（推荐）

下载或 clone 仓库后，在项目根目录双击：

```text
start-cline-pet.bat
```

这个脚本会自动：

1. 进入当前项目目录
2. 检查是否安装了 npm
3. 如果没有 `node_modules`，自动执行 `npm install`
4. 如果没有 Electron，自动执行 `npm install --include=optional electron`
5. 启动桌宠：`npm run dev:electron`

> 第一次启动可能会比较慢，因为 Electron 需要下载二进制文件；下载完成后，后续双击启动会快很多。

## 手动安装

```powershell
git clone https://github.com/bernis-web/cline-pet.git
cd cline-pet
npm install
```

如果 Electron 下载很慢，可以单独等它下载完成：

```powershell
npm install --include=optional electron
```

## 手动启动桌宠

```powershell
cd cline-pet
npm run dev:electron
```

首次运行会构建主进程并启动 Electron。如果看到 Electron 下载进度，请等待下载完成后再运行一次。

## 启动 MCP Server

```powershell
cd cline-pet
npm run dev:mcp
```

这个命令用于让 Cline 通过 MCP 工具调用桌宠。实际使用时，还需要把该 MCP Server 配到你的 Cline MCP 配置里。

推荐直接运行一键接入脚本，它会安装全局状态规则，并把 `cline-desktop-pet` MCP Server 写入 Cline MCP 配置：

```powershell
./scripts/install-cline-status-integration.ps1
```

运行后请重载 VS Code/Cline，让新的 MCP Server 和全局规则生效。

## 验证项目是否正常

```powershell
npm test
npm run build
```

## 模拟状态变化

先启动桌宠：

```powershell
npm run dev:electron
```

再开另一个终端运行：

```powershell
npm run simulate
```

它会依次发送 12 个状态给桌宠，方便检查动画/气泡变化。

## MCP 使用思路

Cline 侧应该在任务关键阶段调用：

- 开始分析/规划：thinking
- 正在读写文件/执行命令：loading
- 等待用户批准：message
- 完成：happy
- 出错：not-found
- Bridge 或 App 状态异常：signal-weak
- 空闲：idle

旧状态别名仍兼容：working -> loading、waiting-approval -> message、done -> happy、error -> not-found。

规则文本见：docs/cline-global-rule.md

可选安装脚本：

```powershell
./scripts/install-global-rule.ps1
```

## DeepSeek 聊天配置

桌宠支持通过你自己的 DeepSeek API key 和卡卡聊天。API key 只保存在本机，不会提交到仓库，也不会通过 MCP/Bridge 发送。

最简单的配置方式是在桌宠窗口里 **右键卡卡** 打开 DeepSeek 设置：

1. 输入 DeepSeek API key。
2. 保持默认 Base URL：`https://api.deepseek.com`。
3. 模型默认是 `deepseek-chat`；如果你使用 DeepSeek V4 Pro，也可以直接把模型名填成你的账号/API 文档对应的模型标识，保存后会回填显示。
4. 点击保存；保存成功后，双击卡卡打开聊天输入框即可直接使用。

如果第一次聊天时还没有配置 API key，桌宠会自动打开 DeepSeek 设置面板。

推荐创建本地配置文件：

```text
%APPDATA%/cline-desktop-pet/config.json
```

示例：

```json
{
  "deepseekApiKey": "你的 DeepSeek API key",
  "deepseekBaseUrl": "https://api.deepseek.com",
  "deepseekModel": "deepseek-chat"
}
```

也可以使用环境变量作为兜底配置：

```powershell
setx CLINE_PET_DEEPSEEK_API_KEY "你的 DeepSeek API key"
setx CLINE_PET_DEEPSEEK_BASE_URL "https://api.deepseek.com"
setx CLINE_PET_DEEPSEEK_MODEL "deepseek-chat"
```

配置优先级是：应用内保存的本地配置文件优先，环境变量作为兜底。环境变量变更需要重启桌宠后生效；应用内设置保存后会立即用于下一次聊天。

## 长期记忆、心情与主动陪伴

- 用户档案、关系记忆、上下文记忆默认全部保存在本地 `%APPDATA%/cline-desktop-pet/`，当前文件布局为 `profile.json`、`relationship.json`、`context-memory.jsonl`。
- DeepSeek 仍然只是回复生成器：每次请求只会收到当前消息、少量最近上下文、少量相关长期记忆，以及关系/心情摘要，不会无边界上传全部历史。
- 卡卡会根据 **心情（mood）+ 活动（activity）+ 关系阶段（bond）** 切换 12 状态姿态；未来扩展资源时，可通过 formatVersion 3 的 `variants` 与 `actionSets` 提供更多替代姿态与动作序列。
- 轻主动陪伴默认低频且克制：当前实现有冷却时间，且在 `loading` / `thinking` 等忙碌状态下不会主动打扰。

## 使用方式补充

- 双击卡卡可以打开临时聊天输入框。
- 聊天输入框留空一段时间会自动关闭，也可以按 Esc 或再次双击卡卡关闭。
- 按住卡卡拖动可以移动桌宠位置。
- 轻轻按住卡卡约半秒且不大幅移动，可以触发摸头反应；摸头不会显示分数或奖励，只会作为本地的短期陪伴感信号。
- 右键卡卡可以直接输入/更新 DeepSeek API key、Base URL 和模型。
- Cline 工作状态会以气泡方式提醒，不再常驻底部面板。
- DeepSeek 回复也会通过气泡显示在卡卡附近。

## 更换像素宠物形象

本地宠物资源包目录：

```text
%APPDATA%/cline-desktop-pet/pets/<pet-id>/
```

formatVersion 2 资源包应包含 `manifest.json` 和 12 个状态图片；旧 formatVersion 1 六状态资源包也会被映射为兼容 fallback。资源包格式详见：docs/pet-pack-format.md

如果本机已经安装 `kaka-desktop-pet`，且还没有保存过其他宠物选择，应用会默认使用卡卡形象；如果你在托盘里手动选择了其他宠物，手动选择会继续优先。

放入资源包后，在托盘菜单里点击：

```text
Refresh Pet Packs（刷新宠物资源包）
Select Pet（选择宠物）
```

## 安装卡卡 12 状态本地 PNG 宠物包

用户 PNG 素材不会提交到 GitHub。运行安装脚本会把素材复制到：

```text
%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/
```

运行：

```powershell
./scripts/install-kaka-pet-pack.ps1
```

如果素材目录不在默认位置，可以传入源目录：

```powershell
./scripts/install-kaka-pet-pack.ps1 -SourceDir "E:\path\to\桌宠小人"
```

安装完成后，在托盘菜单点击：

```text
Refresh Pet Packs（刷新宠物资源包）
Select Pet（选择宠物） -> 卡卡桌宠小人
```

## 常见问题

### Electron 下载特别慢怎么办？

这是 Electron 首次安装需要下载二进制导致的。可以：

```powershell
npm install --include=optional electron
```

等下载完成后再运行：

```powershell
npm run dev:electron
```

### MCP 报 PET_APP_UNREACHABLE 怎么办？

通常表示桌宠 App 没启动或本地 Bridge 端口不可达。

排查顺序：

1. 先运行 `npm run dev:electron`
2. 再让 Cline 调用 pet_status_check
3. 查看日志目录：`%APPDATA%/cline-desktop-pet/logs/`

### 会上传代码内容给桌宠吗？

默认不会。MCP payload 只设计为状态、任务短摘要、短提示和更新时间。

## 当前仓库

https://github.com/bernis-web/cline-pet


