# Pet Pack Format（宠物资源包格式）

Put local pet packs under `%APPDATA%/cline-desktop-pet/pets/<pet-id>/`.

## formatVersion 2（12 状态资源包）

`formatVersion: 2` packs provide all 12 standard states:

- `idle`（待机）
- `happy`（开心）
- `sleepy`（困困）
- `thinking`（思考）
- `angry`（炸毛）
- `not-found`（装死 404）
- `message`（收到消息）
- `sleeping`（睡觉）
- `head-pat`（摸头反应）
- `dragging`（拖拽反应）
- `loading`（加载中）
- `signal-weak`（信号弱）

Example manifest:

```json
{
  "id": "kaka-desktop-pet",
  "name": "卡卡桌宠小人",
  "version": "1.0.0",
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
  }
}
```

## Legacy formatVersion 1（旧 6 状态资源包）

Existing packs without `formatVersion` are treated as legacy six-state packs:

- `idle`
- `thinking`
- `working`
- `waiting-approval`
- `done`
- `error`

The app maps legacy states to the new 12-state model so old packs can still be used as fallback resources.

If a pack is invalid, the app reports `INVALID_PET_PACK（宠物资源包无效）` and falls back to the bundled default pet.
