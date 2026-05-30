# Cline 桌宠对话气泡与 DeepSeek 聊天设计

日期：2026-05-28

## 目标

第一期把桌宠从“底部固定状态面板 + 静态贴图”升级为更像赛博生命 C 的交互入口：

1. 去掉常驻底部黑色方框。
2. 在需要表达时显示轻量对话气泡，用于 Cline 工作状态、提醒和聊天回复。
3. 接入用户自有 DeepSeek API，实现基础聊天。
4. 为后续长期记忆和动画系统保留清晰接口，但第一期不实现完整长期记忆和复杂动画。

## 非目标

第一期暂不做：

- 完整长期记忆检索、总结、向量化或人格演化系统。
- 复杂骨骼动画、帧动画编辑器或 Live2D 类系统。
- 云同步、多用户账户、远程服务器。
- 将 API key 写入仓库、MCP payload 或日志。

## 用户体验设计

### 默认形态

平时窗口只展示卡卡本体，不显示底部固定信息面板。

```text
        [卡卡]
```

### 需要表达时

当 Cline 状态变化、DeepSeek 回复、错误提醒或用户主动聊天时，卡卡上方或侧上方出现气泡。

```text
   ┌──────────────────────┐
   │ 我正在思考这个任务... │
   └──────────▲───────────┘
            [卡卡]
```

气泡自动淡入，默认显示数秒后淡出；用户悬停或聊天输入时保持展开。

### 气泡类型

- `status`：Cline 工作状态，例如“正在思考”“正在修改文件”“等待你的确认”。
- `chat`：DeepSeek 聊天回复。
- `notice`：错误、网络失败、配置缺失、API key 未设置。
- `diagnostics`：诊断结果，只在用户点击诊断时显示。

### 聊天入口

第一期推荐两个入口：

1. 点击卡卡或气泡中的小按钮打开输入框。
2. 托盘菜单增加“和卡卡说话”。

输入框是临时浮层，不常驻，不替代主桌宠窗口。

## 架构设计

### 组件边界

#### Renderer

负责：

- 展示卡卡图片。
- 展示对话气泡。
- 展示临时聊天输入框。
- 接收主进程推送的 pet status、pet pack、chat response。
- 不接触 DeepSeek API key。

新增/调整模块建议：

- `SpeechBubble.tsx`：气泡 UI。
- `ChatInput.tsx`：轻量聊天输入。
- `bubbleTypes.ts`：`BubbleMessage` 类型与气泡策略。
- `petMotion.ts` 或 CSS class 映射：轻量动效状态。

#### Main Process

负责：

- 读取本地配置。
- 调用 DeepSeek API。
- 通过 IPC 接收 renderer 的聊天请求。
- 通过 IPC 返回聊天回复或错误。
- 保持 API key 不进入 renderer、日志和 MCP。

新增/调整模块建议：

- `src/app/main/config.ts`：读取 `%APPDATA%/cline-desktop-pet/config.json` 和环境变量。
- `src/app/main/deepseekClient.ts`：封装 DeepSeek 请求。
- `src/app/main/chatService.ts`：构造 prompt、处理响应、预留记忆接口。

#### MCP / Bridge

MCP 和 HTTP Bridge 继续只负责状态更新：

- `update_pet_status` 不直接触发 DeepSeek。
- Cline 状态通过 `message` / `task` 进入气泡显示。
- 不把代码、文件内容或 API key 传入桌宠。

## DeepSeek 配置

### 配置来源优先级

1. 环境变量：
   - `CLINE_PET_DEEPSEEK_API_KEY`
   - `CLINE_PET_DEEPSEEK_BASE_URL`
   - `CLINE_PET_DEEPSEEK_MODEL`
2. 本地配置文件：
   - `%APPDATA%/cline-desktop-pet/config.json`
3. 默认值：
   - `baseUrl: https://api.deepseek.com`
   - `model: deepseek-chat`

### 配置文件示例

```json
{
  "deepseekApiKey": "你的 key",
  "deepseekBaseUrl": "https://api.deepseek.com",
  "deepseekModel": "deepseek-chat"
}
```

该文件不纳入 Git，不在 README 中要求明文提交。

## 数据流

### Cline 状态气泡

```text
Cline MCP tool
  -> MCP server update_pet_status
  -> HTTP Bridge POST /status
  -> Electron main latestStatus
  -> IPC pet-status
  -> Renderer BubbleMessage(status)
  -> SpeechBubble 显示
```

### 用户聊天

```text
用户点击卡卡
  -> Renderer ChatInput
  -> IPC chat:send(message)
  -> Main chatService
  -> deepseekClient
  -> DeepSeek API
  -> IPC chat:response
  -> Renderer BubbleMessage(chat)
  -> SpeechBubble 显示
```

## DeepSeek 请求策略

第一期只做短上下文聊天：

- system prompt：定义卡卡身份为本地桌宠、温和、简短、有边界。
- user prompt：用户输入。
- 可附带最近少量对话上下文，但不做长期记忆。
- 请求超时建议 20-30 秒。
- 出错时显示 notice 气泡，例如“我现在连不上 DeepSeek”。

## 长期记忆预留

第一期只定义接口，不实现复杂逻辑：

```ts
export type MemoryItem = {
  id: string;
  kind: "fact" | "preference" | "conversation-summary";
  text: string;
  createdAt: string;
  updatedAt: string;
  weight: number;
};

export type MemoryStore = {
  add(item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): Promise<MemoryItem>;
  search(query: string, limit: number): Promise<MemoryItem[]>;
};
```

后续可实现 JSONL、SQLite 或向量检索。

## 轻量动画预留

第一期不做复杂动画包，但可以把状态映射到 CSS 动效：

- `idle`：轻微上下浮动。
- `thinking`：轻微呼吸/发光。
- `happy`：弹跳。
- `message`：气泡弹出时轻点头。
- `loading`：小幅左右晃动。
- `not-found` / `signal-weak`：轻微抖动。

后续资源包可以扩展为 animated pet pack，例如 GIF/APNG/WebP 或帧序列。

## 错误处理

- 未配置 API key：显示 notice 气泡，引导用户设置本地配置。
- DeepSeek 网络错误/超时：显示 notice 气泡，不崩溃。
- API 返回格式异常：显示简短错误，并写入 app log。
- Renderer 发送空消息：忽略或提示“你还没说话”。
- MCP 状态没有 message/task：只改变状态和动画，不弹出打扰气泡。

## 安全和隐私

- API key 只在 main process 读取。
- 不通过 renderer、MCP payload、HTTP Bridge 暴露 API key。
- 日志中不得记录 API key、完整请求 headers。
- 默认不把 Cline 的代码或文件内容发给 DeepSeek。
- 聊天内容只来自用户主动输入，除非后续用户明确开启上下文共享。

## 测试计划

### 单元测试

- 配置读取：环境变量优先，本地配置 fallback，缺失 key 返回明确错误。
- DeepSeek client：mock fetch，覆盖成功、超时、HTTP error、异常 JSON。
- chatService：空输入、正常回复、错误映射。
- bubble reducer/策略：状态消息进入气泡、无消息状态不打扰、chat 回复优先显示。

### Renderer 测试

- 收到 `pet-status` 时显示 status 气泡。
- 收到 chat response 时显示 chat 气泡。
- 气泡可自动隐藏。
- 诊断仍可打开，但不再常驻底部面板。

### 集成测试

- HTTP Bridge 状态更新能驱动气泡显示。
- IPC chat send 能收到 DeepSeek mock 回复。
- `npm test`、`npm run build` 通过。

## 第一阶段交付物

- 去掉常驻底部方框，替换为按需气泡。
- 增加聊天输入入口。
- 增加 DeepSeek API 配置读取和 main-process client。
- 增加基础 chat IPC。
- Cline 状态通过气泡提醒。
- 添加测试覆盖。
- README 增加 DeepSeek 配置说明。

## 后续阶段

1. 长期记忆：从 JSONL/SQLite 开始，支持用户偏好和对话摘要。
2. 动画资源包：支持 animated state assets。
3. C（赛博生命）人格：状态、记忆、日常主动提醒和行为策略。
