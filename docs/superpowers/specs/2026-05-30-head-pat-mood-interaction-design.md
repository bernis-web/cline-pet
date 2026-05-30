# 摸头互动与心情素材变化设计

## 背景

当前桌宠已经具备以下基础能力：

- renderer 显示桌宠、气泡、临时聊天输入和 DeepSeek 设置面板。
- 左键拖动桌宠移动无边框窗口。
- 双击桌宠打开 / 关闭聊天输入。
- 右键桌宠打开 DeepSeek 设置。
- main 进程维护本地关系记忆、心情推导和 mood → pose 映射。
- pet pack `formatVersion: 3` 已支持基础状态、可选 `variants` 和 `actionSets`。
- 现有 12 张 PNG 素材中，`09_摸头反应_1024透明PNG_v1.png` 已作为通用 `head-pat` 第一阶段素材。

本设计新增“摸头”作为自然陪伴互动：用户按住桌宠一小段时间并轻微移动时，卡卡立即表现出被摸头的反应；该互动不做成游戏化亲密度系统，不显示分数、等级或奖励，只作为本地、轻量的“最近被关心过”信号温和影响心情和素材表现。

## 目标

1. 提供低打扰、自然的摸头互动。
2. 摸头中立即显示 `head-pat` 素材，形成明确反馈。
3. 保留现有拖动、双击聊天、右键设置交互，不互相冲突。
4. 将摸头记录为轻量关系温度信号，而不是可刷的亲密度数值。
5. 让心情系统可以温和参考最近摸头互动，让卡卡的状态更像被陪伴过。
6. 继续兼容当前 12 状态 PNG 素材，并为未来更多心情变体素材留出扩展空间。

## 非目标

- 不显示亲密度、经验条、等级、成就或任何游戏化奖励。
- 不通过重复摸头快速改变长期关系分数。
- 不要求第一阶段制作新素材；先使用现有 `head-pat` 状态图。
- 不在第一阶段实现复杂帧动画、Live2D 或骨骼动画。

## 交互设计

### 手势判定

桌宠主交互区域继续承载拖动、双击和右键行为。摸头使用左键长按的小位移手势：

1. 用户在桌宠区域按下左键。
2. renderer 进入 `pending` 候选状态并记录起点坐标和时间。
3. 如果约 `400ms` 内鼠标移动距离低于摸头阈值，则进入 `patting` 状态。
4. `patting` 状态下立即显示 `head-pat` 素材。
5. 小幅来回移动继续保持摸头反馈。
6. 如果在候选或摸头中出现明显大位移，则切换为 `dragging`，走现有窗口移动逻辑，不记录摸头。
7. 松开鼠标后：
   - 若处于 `patting` 且持续时间达到有效门槛，则上报一次摸头事件。
   - renderer 清除临时摸头覆盖状态，回到 main 推送的 mood-driven pose。

建议初始阈值：

- 长按时间：`400ms`。
- 拖动判定距离：约 `8px` 到 `12px`，以实际体验再微调。
- 有效摸头最短时长：约 `600ms`，避免误触记录。

### 与现有交互的关系

- 左键大幅移动：仍然拖动窗口。
- 双击：仍然打开 / 关闭聊天输入。
- 右键：仍然打开 DeepSeek 设置。
- 摸头不会弹出奖励提示，也不会在 UI 上显示“+1”之类反馈。

## 状态与数据流

### Renderer

renderer 负责即时手势识别和视觉反馈：

- 在 `PetView` 内维护指针交互状态，例如 `idle | pending | patting | dragging`。
- 当进入 `patting` 时，通过回调通知 `App` 临时覆盖显示状态为 `head-pat`。
- 当摸头有效结束时，通过 preload bridge 调用 main IPC，例如 `interaction:head-pat`。
- 传给 main 的事件只包含必要元数据：开始时间、结束时间、持续毫秒数。

### Main

main 负责长期本地状态更新和后续状态推导：

- 校验摸头事件输入，忽略无效或明显异常的持续时间。
- 更新本地 `RelationshipMemory` 中的轻量互动字段。
- 重新推导 mood / pose，并通过现有 pet-status 通道推送。

### Pose 优先级

姿态解析需要将“当前活动”放在 mood 之前处理：

1. `dragging`、`loading`、`thinking`、`message` 等即时活动保持优先。
2. 新增 `patting` 活动时显示 `head-pat`。
3. 没有即时活动时，继续使用 mood → pose：
   - `calm` → `idle`
   - `happy` → `happy`
   - `attached` → `head-pat` 或 `happy`，按当前规则和关系阶段决定
   - `sleepy` → `sleepy`
   - `upset` → `angry`
   - `curious` → `thinking`

## 关系记忆策略

摸头不作为游戏化分数系统。它只记录“最近被关心过”的轻量上下文。

建议在 `RelationshipMemory` 中增加可选字段：

```ts
type RelationshipMemory = {
  lastHeadPatAt?: string;
  recentWarmth?: {
    source: "head-pat" | "chat" | "presence";
    intensity: "soft" | "normal";
    updatedAt: string;
    expiresAt: string;
  };
  // existing fields remain
};
```

设计原则：

- `lastHeadPatAt` 用于知道最近是否发生过摸头。
- `recentWarmth` 是短期温度信号，会自然过期。
- 不在 UI 显示这些字段。
- 不直接用摸头线性增加 `affection`。
- 可选择在 `recentEvents` 中保留一条温和文字，例如“今天被轻轻摸了摸头”，但应限制频率，避免日志被摸头刷屏。

## 心情影响策略

mood engine 可以温和参考 `lastHeadPatAt` / `recentWarmth`：

- 如果最近刚被摸头，且没有更高优先级的工作状态、错误状态或负面情绪，卡卡可以更容易保持 `calm`、`happy` 或 `attached`。
- 如果处于 `upset` 或 `lonely`，最近摸头可以作为缓和因素，但不应立即强行变成高兴。
- 如果处于 `sleepy` 或 `sleeping`，摸头结束后仍应尊重夜间困倦状态，避免突兀清醒。
- 重复摸头不会叠加成快速升级，只会刷新短期温度时间。

## 素材策略

第一阶段使用已有 12 状态素材：

- 摸头中显示 `head-pat`，对应当前 `09_摸头反应`。
- 其他心情继续显示现有 mood-driven pose。
- 如果 pet pack 缺少 `head-pat`，沿用现有 fallback：老格式可退回到 `happy`，新格式应要求标准 12 状态齐全。

未来扩展：

- 使用 `variants.head-pat` 支持多张摸头反应随机或轮播。
- 使用 `actionSets.headPat` 描述摸头动作序列。
- 如新增更多素材，可扩展为按心情细分的摸头变体，例如 `calm/head-pat`、`sleepy/head-pat`、`upset/head-pat`，但第一阶段不要求。

## 错误处理与边界

- IPC 不可用时，renderer 仍可显示临时 `head-pat`，但不记录长期信号。
- main 收到异常持续时间，例如负数、过长时，应忽略或截断。
- 窗口拖动优先避免误触：超过拖动阈值立即转为拖动。
- 摸头不应阻止聊天输入、设置面板等覆盖 UI 的正常操作。
- 本地记忆写入失败时不影响即时互动，只记录日志或静默失败。

## 测试计划

### Renderer 测试

- 左键按下后短时间松开：不触发摸头、不上报事件。
- 左键按下后移动超过阈值：触发拖动窗口，不触发摸头。
- 左键按住超过 `400ms` 且小幅移动：显示 `head-pat`。
- 有效摸头松手：调用 bridge 上报摸头事件。
- 双击聊天和右键设置仍可用。

### Main / Memory 测试

- `recordHeadPatInteraction` 或等价服务写入 `lastHeadPatAt`。
- `recentWarmth` 被设置为短期信号并带有过期时间。
- 频繁摸头不会刷屏 `recentEvents`。
- 无效事件输入不会破坏关系记忆。

### Mood / Pose 测试

- `activity: "patting"` 优先解析为 `head-pat`。
- 摸头结束后恢复 mood-driven pose。
- 最近温度信号可以温和影响 `calm/happy/attached`，但不覆盖 loading/thinking/dragging 等即时活动。

## 成功标准

- 用户可以通过左键长按小幅移动自然摸头。
- 摸头中素材立即切换到 `head-pat`。
- 大幅移动仍然拖动窗口，双击聊天和右键设置不回归。
- 摸头不会表现为游戏化分数系统。
- 本地只记录轻量“最近互动温度”，用于温和影响心情。
- 相关定向测试、全量 `npm test` 和 `npm run build` 通过。