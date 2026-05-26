# Cline 桌面电子宠物（Cline Desktop Pet）

一个面向 **Windows 11** 的 Cline 桌面悬浮电子宠物。它使用 **Electron** 做透明置顶桌宠窗口，使用 **MCP Server** 接收 Cline 状态更新，并支持像素宠物资源包、托盘菜单、开机自启和一键诊断。

> 当前是 MVP 原型：核心代码、测试、构建、MCP 工具、资源包结构都已具备；Electron 首次启动需要下载 Electron 二进制，国内网络可能较慢。

## 功能特性

- Windows 11 透明、置顶、无边框桌宠窗口
- 宠物优先布局：像素宠物在上，底部气泡面板显示状态
- 6 个状态：idle、	hinking、working、waiting-approval、done、error
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

`	ext
start-cline-pet.bat
`

这个脚本会自动：

1. 进入当前项目目录
2. 检查是否安装了 npm
3. 如果没有 
ode_modules，自动执行 
pm install
4. 如果没有 Electron，自动执行 
pm install --include=optional electron
5. 启动桌宠：
pm run dev:electron

> 第一次启动可能会比较慢，因为 Electron 需要下载二进制文件；下载完成后，后续双击启动会快很多。

## 手动安装

`powershell
git clone https://github.com/bernis-web/cline-pet.git
cd cline-pet
npm install
`

如果 Electron 下载很慢，可以单独等它下载完成：

`powershell
npm install --include=optional electron
`

## 手动启动桌宠

`powershell
cd cline-pet
npm run dev:electron
`

首次运行会构建主进程并启动 Electron。如果看到 Electron 下载进度，请等待下载完成后再运行一次。

## 启动 MCP Server

`powershell
cd cline-pet
npm run dev:mcp
`

这个命令用于让 Cline 通过 MCP 工具调用桌宠。实际使用时，还需要把该 MCP Server 配到你的 Cline MCP 配置里。

## 验证项目是否正常

`powershell
npm test
npm run build
`

## 模拟状态变化

先启动桌宠：

`powershell
npm run dev:electron
`

再开另一个终端运行：

`powershell
npm run simulate
`

它会依次发送 6 个状态给桌宠，方便检查动画/面板变化。

## MCP 使用思路

Cline 侧应该在任务关键阶段调用：

- 开始分析/规划：	hinking
- 正在读写文件/执行命令：working
- 等待用户批准：waiting-approval
- 完成：done
- 出错：error
- 空闲：idle

规则文本见：docs/cline-global-rule.md

可选安装脚本：

`powershell
./scripts/install-global-rule.ps1
`

## 更换像素宠物形象

本地宠物资源包目录：

`	ext
%APPDATA%/cline-desktop-pet/pets/<pet-id>/
`

每个资源包至少包含：

`	ext
manifest.json
idle.gif 或 idle.svg
thinking.gif 或 thinking.svg
working.gif 或 working.svg
waiting-approval.gif 或 waiting-approval.svg
done.gif 或 done.svg
error.gif 或 error.svg
`

资源包格式详见：docs/pet-pack-format.md

放入资源包后，在托盘菜单里点击：

`	ext
Refresh Pet Packs（刷新宠物资源包）
Select Pet（选择宠物）
`

## 常见问题

### Electron 下载特别慢怎么办？

这是 Electron 首次安装需要下载二进制导致的。可以：

`powershell
npm install --include=optional electron
`

等下载完成后再运行：

`powershell
npm run dev:electron
`

### MCP 报 PET_APP_UNREACHABLE 怎么办？

通常表示桌宠 App 没启动或本地 Bridge 端口不可达。

排查顺序：

1. 先运行 
pm run dev:electron
2. 再让 Cline 调用 pet_status_check
3. 查看日志目录：%APPDATA%/cline-desktop-pet/logs/

### 会上传代码内容给桌宠吗？

默认不会。MCP payload 只设计为状态、任务短摘要、短提示和更新时间。

## 当前仓库

https://github.com/bernis-web/cline-pet
