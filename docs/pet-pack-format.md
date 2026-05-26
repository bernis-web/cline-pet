# Pet Pack Format（宠物资源包格式）

Put local pixel pet packs under `%APPDATA%/cline-desktop-pet/pets/<pet-id>/`.

Each pack needs a `manifest.json` and six state images:

- `idle`
- `thinking`
- `working`
- `waiting-approval`
- `done`
- `error`

Example manifest:

```json
{
  "id": "test-human",
  "name": "Test Human",
  "version": "1.0.0",
  "states": {
    "idle": "idle.gif",
    "thinking": "thinking.gif",
    "working": "working.gif",
    "waiting-approval": "waiting-approval.gif",
    "done": "done.gif",
    "error": "error.gif"
  }
}
```

If a pack is invalid, the app reports `INVALID_PET_PACK（宠物资源包无效）` and falls back to the bundled default pet.