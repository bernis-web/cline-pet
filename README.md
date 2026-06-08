# Cline 桌面电子宠物（Cline Desktop Pet）

> 当前版本：`1.1.0`

一个面向 **Windows 11** 的 Cline 桌面悬浮电子宠物。它使用 **Electron** 创建透明置顶桌宠窗口，使用 **MCP Server** 接收 Cline 状态更新，并支持 DeepSeek 聊天、本地长期记忆、统一隐私面板、像素宠物资源包、托盘菜单和 Windows 便携发行版。

## 功能特性

- Windows 11 透明、置顶、无边框桌宠窗口
- 桌宠窗口可拖动，通过系统托盘显示/隐藏，不占用任务栏
- 12 个状态：`idle`、`happy`、`sleepy`、`thinking`、`angry`、`not-found`、`message`、`sleeping`、`head-pat`、`dragging`、`loading`、`signal-weak`
- DeepSeek 聊天输入框与聊天气泡回复
- 统一隐私面板：长期记忆、不要再记规则、聊天历史、导出/清除
- 本地长期记忆：`profile.json`、`relationship.json`、`context-memory.jsonl`、`chat-history.jsonl`
- Playful Presence v1：聊天后开心跟随、摸头后黏人跟随、低频空闲陪伴、夜间收敛、长时间工作提醒
- Relationship Persona v1：`new / familiar / close / trusted` 四阶段会影响聊天 prompt、聊天语气、主动气泡、安慰与提醒文案
- MCP 工具：`update_pet_status`、`pet_status_check`
- 本地 HTTP Bridge：MCP Server 通过本地接口把状态送到 Electron App
- 本地像素宠物资源包切换
- 隐私默认安全：只传状态和短任务摘要，不传代码或文件内容

## 环境要求

- Windows 11
- Node.js 20+
- npm
- Git（可选）

## 一键启动

在项目根目录双击：

```text
start-cline-pet.bat
```

它会自动：

1. 进入当前项目目录
2. 检查是否安装了 npm
3. 如果没有 `node_modules`，自动执行 `npm install`
4. 如果没有 Electron，自动执行 `npm install --include=optional electron`
5. 启动桌宠：`npm run dev:electron`

第一次启动可能会比较慢，因为 Electron 需要下载二进制文件。

## 手动安装

```powershell
git clone https://github.com/bernis-web/cline-pet.git
cd cline-pet
npm install
```

如果 Electron 下载很慢，可以单独安装：

```powershell
npm install --include=optional electron
```

## 手动启动桌宠

```powershell
cd cline-pet
npm run dev:electron
```

## 启动 MCP Server

```powershell
cd cline-pet
npm run dev:mcp
```

推荐直接运行一键接入脚本，把 `cline-desktop-pet` MCP Server 写入 Cline MCP 配置：

```powershell
./scripts/install-cline-status-integration.ps1
```

运行后请重载 VS Code/Cline。

## 项目验证

```powershell
npm test
npm run build
```

当前 `1.1.0` 已完成验证：

- 全量测试：`49` 个测试文件，`219` 个测试全部通过
- 构建：`npm run build` 通过

## 构建 Windows 便携发行版

```powershell
npm run package:win:portable
```

当前 `1.1.0` 构建完成后会生成：

```text
dist-release/cline-desktop-pet-1.1.0-win-portable/
dist-release/cline-desktop-pet-1.1.0-win-portable.zip
```

解压后运行 `Cline Desktop Pet.exe` 即可启动。便携版仍会把本地数据保存到 `%APPDATA%/cline-desktop-pet/`。

## 1.1.0 更新内容

- 新增 Relationship Persona v1：关系阶段会影响聊天 prompt、聊天语气和边界文案
- 新增 Playful Presence v1：聊天、摸头、压力聊天和长时间空闲后，卡卡会更自然地主动陪伴
- 升级关系说明文案：隐私面板中的 `初识 / 熟悉 / 亲近 / 信赖` 描述更贴近当前陪伴人格
- 版本号更新为 `1.1.0`
- 已产出新的 Windows 便携发行版 zip

## 使用方式补充

- 双击卡卡可以打开临时聊天输入框
- 聊天输入框留空一段时间会自动关闭，也可以按 `Esc` 关闭
- 按住卡卡拖动可以移动桌宠位置
- 轻轻按住卡卡约半秒且不大幅移动，可以触发摸头反应
- 右键卡卡可以打开 DeepSeek 设置与常用操作
- Cline 工作状态和 DeepSeek 回复会以气泡方式显示在卡卡附近

## DeepSeek 聊天配置

最简单的配置方式是在桌宠窗口里 **右键卡卡** 打开 DeepSeek 设置：

1. 输入 DeepSeek API key
2. 保持默认 Base URL：`https://api.deepseek.com`
3. 模型默认是 `deepseek-chat`
4. 保存后即可聊天

也可以直接写本地配置文件：

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

## 本地数据与隐私

当前会保存到 `%APPDATA%/cline-desktop-pet/` 的主要文件：

- `config.json`
- `state.json`
- `profile.json`
- `relationship.json`
- `context-memory.jsonl`
- `memory-blocklist.json`
- `chat-history.jsonl`
- `logs/`

隐私约束：

- MCP payload 只传状态、短任务摘要、短提示和更新时间
- DeepSeek 请求只传当前消息、少量上下文/记忆摘要，不传完整代码、文件内容或终端长输出
- 统一隐私面板只读取卡卡自己本地保存的数据

## 更换像素宠物形象

本地宠物资源包目录：

```text
%APPDATA%/cline-desktop-pet/pets/<pet-id>/
```

放入资源包后，可在托盘菜单中点击：

```text
Refresh Pet Packs
Select Pet
```

资源包格式详见：`docs/pet-pack-format.md`

## 后续开发入口

- 开发指南：`docs/development/kaka-development-guide.md`
- 交接 compact：`docs/development/kaka-compact.md`

## 当前仓库

https://github.com/bernis-web/cline-pet