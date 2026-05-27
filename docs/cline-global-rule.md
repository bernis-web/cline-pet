# Cline Desktop Pet Status Rule

When the `cline-desktop-pet` MCP tools are available, update the desktop pet at major task transitions:

- Use `update_pet_status` with `thinking（思考）` when planning or analyzing.
- Use `update_pet_status` with `loading（加载中）` while reading, editing, running commands, building, or testing.
- Use `update_pet_status` with `message（收到消息）` before waiting for user approval/input.
- Use `update_pet_status` with `happy（开心）` after successful completion.
- Use `update_pet_status` with `not-found（装死 404）` when an unexpected failure occurs.
- Use `update_pet_status` with `signal-weak（信号弱）` when the app or bridge appears stale/unreachable.
- Use concise task summaries only. Do not send source code, file contents, full prompts, or long terminal output.

Legacy aliases remain accepted for compatibility:

- `working` -> `loading`
- `waiting-approval` -> `message`
- `done` -> `happy`
- `error` -> `not-found`
