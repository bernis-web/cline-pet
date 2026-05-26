# Cline Desktop Pet Status Rule

When the `cline-desktop-pet` MCP tools are available, update the desktop pet at major task transitions:

- Use `update_pet_status` with `thinking（思考中）` when planning or analyzing.
- Use `update_pet_status` with `working（工作中）` while reading, editing, or running commands.
- Use `update_pet_status` with `waiting-approval（等待批准）` before waiting for user approval/input.
- Use `update_pet_status` with `done（完成）` after successful completion.
- Use `update_pet_status` with `error（错误）` when an unexpected failure occurs.
- Use concise task summaries only. Do not send source code or file contents.