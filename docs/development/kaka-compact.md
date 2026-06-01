# Kaka Project Compact

## One-line summary

Kaka is a Windows 11 Electron + React desktop pet for Cline. It renders a local 12-state PNG pet, receives Cline status via MCP/localhost Bridge, supports DeepSeek chat, local memory/mood, proactive bubbles, dragging and head-pat interactions.

## Current branch

- Repo: `https://github.com/bernis-web/cline-pet`
- Branch: `feat/12-state-local-pet-pack`
- Worktree: `d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack`
- Do not work from workspace root; it is not the repo.

## Latest important commit

- `e73c8c1 feat: integrate Kaka memory controls`
- `25c2f14 feat: add Kaka memory panel`
- `04ac00e feat: expose memory management bridge`
- `0ee8e5e feat: add memory management service`
- `f31b8b1 docs: add Kaka Cyber Life v2 memory plan`
- `01f8909 feat: wire Kaka presence runtime`
- `ae6515b feat: report Kaka readable chat activity`
- `016433e feat: add presence activity bridge`

## What is already built

- 12 statuses: `idle`, `happy`, `sleepy`, `thinking`, `angry`, `not-found`, `message`, `sleeping`, `head-pat`, `dragging`, `loading`, `signal-weak`.
- Legacy aliases: `working -> loading`, `waiting-approval -> message`, `done -> happy`, `error -> not-found`.
- MCP tools: `update_pet_status`, `pet_status_check`.
- Local Bridge: `127.0.0.1:37621/status` and `/diagnostics`.
- Kaka local PNG installer: `scripts/install-kaka-pet-pack.ps1` copies assets to `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/`.
- DeepSeek chat settings via right-click; config stored locally in `%APPDATA%/cline-desktop-pet/config.json`.
- Local memory files: `profile.json`, `relationship.json`, `context-memory.jsonl`.
- Local chat history file: `chat-history.jsonl`.
- Mood/pose/presence/head-pat modules exist.
- Renderer supports bubbles, auto-hide, readable long chat bubbles, chat history panel, drag, double-click chat, right-click settings, long-press head-pat.
- Cyber Life v2.1 memory controls: `记忆` panel for viewing/searching/filtering/deleting/clearing/exporting long-term memories from `context-memory.jsonl`.
- Relationship overview: `初识` / `熟悉` / `亲近` / `信赖` derived from familiarity, affection, engagement, and trust scores in `relationship.json`.
- Presence runtime now receives readable long-chat activity from the renderer and treats continuous `loading` / `thinking` over 90 minutes as a long-work care opportunity.

## Main files to know

```text
src/shared/statuses.ts
src/shared/schemas.ts
src/mcp/server.ts
src/bridge/bridgeClient.ts
src/bridge/bridgeServer.ts
src/assets/petPackManager.ts
src/app/main/main.ts
src/app/main/chatService.ts
src/app/main/chatMood.ts
src/app/main/moodEngine.ts
src/app/main/poseResolver.ts
src/app/main/presenceService.ts
src/app/main/interaction/headPatService.ts
src/app/main/memory/*
src/app/main/memory/memoryManagementService.ts
src/app/renderer/App.tsx
src/app/renderer/PetView.tsx
src/app/renderer/MemoryPanel.tsx
src/app/renderer/bubbleTypes.ts
src/app/renderer/petStyles.css
```

## Run / verify

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
npm test
npm run build
npm run dev:electron
npm run dev:mcp
npm run simulate
```

Expected verification as of 2026-06-01:

```text
Test Files 38 passed
Tests 135 passed
Build renderer/main/preload passed
```

## MCP status update debug

If Kaka is not reporting Cline work:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:37621/diagnostics' -TimeoutSec 2
```

Direct Bridge probe:

```powershell
$body = @{ status='loading'; task='direct bridge probe'; message='直接测试 Bridge 状态更新'; source='probe' } | ConvertTo-Json
Invoke-WebRequest -UseBasicParsing -Method POST -Uri 'http://127.0.0.1:37621/status' -ContentType 'application/json' -Body $body -TimeoutSec 2
```

MCP handler probe:

```powershell
npx tsx -e "(async()=>{const m=await import('./src/mcp/server.ts'); const r=await m.handleUpdatePetStatus({status:'happy',task:'probe',message:'MCP handler probe'}); console.log(JSON.stringify(r,null,2));})().catch(e=>{console.error(e);process.exit(1)})"
```

If these work but Cline tool calls do not, rerun integration and reload VS Code/Cline:

```powershell
./scripts/install-cline-status-integration.ps1
```

## Privacy / don't commit

- Do not commit user PNG assets.
- Do not commit `.superpowers/`.
- Do not commit `%APPDATA%` data, logs, API keys, or `config.json`.
- Do not send code/file contents to DeepSeek unless user explicitly provides them.

## Likely next tasks

1. Review and merge the Cyber Life v1/v2.1 PR after GitHub checks/review.
2. Add memory editing or “不要再记” controls from chat/history UI.
3. Improve MCP connection UX: clearer diagnostics, setup guidance, and stale-connection recovery hints.
4. Consider richer relationship/profile UI with recent positive events.
5. Explore richer proactive rhythms after memory controls prove stable.
