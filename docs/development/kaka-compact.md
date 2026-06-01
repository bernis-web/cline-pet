# Kaka Project Compact

## One-line summary

Kaka is a Windows 11 Electron + React desktop pet for Cline. It renders a local 12-state PNG pet, receives Cline status via MCP/localhost Bridge, supports DeepSeek chat, local memory/mood, proactive bubbles, dragging and head-pat interactions.

## Current branch

- Repo: `https://github.com/bernis-web/cline-pet`
- Branch: `feat/12-state-local-pet-pack`
- Worktree: `d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack`
- Do not work from workspace root; it is not the repo.

## Latest important commit

- `3b917a6 feat: tune kaka chat bubbles and mood`
  - Chat bubbles auto-hide around 5 seconds.
  - Bubble moved near Kaka's head.
  - Successful chat pushes a happy mood status.
  - Kaka prompt is warmer, cuter, concise, privacy-safe.

## What is already built

- 12 statuses: `idle`, `happy`, `sleepy`, `thinking`, `angry`, `not-found`, `message`, `sleeping`, `head-pat`, `dragging`, `loading`, `signal-weak`.
- Legacy aliases: `working -> loading`, `waiting-approval -> message`, `done -> happy`, `error -> not-found`.
- MCP tools: `update_pet_status`, `pet_status_check`.
- Local Bridge: `127.0.0.1:37621/status` and `/diagnostics`.
- Kaka local PNG installer: `scripts/install-kaka-pet-pack.ps1` copies assets to `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/`.
- DeepSeek chat settings via right-click; config stored locally in `%APPDATA%/cline-desktop-pet/config.json`.
- Local memory files: `profile.json`, `relationship.json`, `context-memory.jsonl`.
- Mood/pose/presence/head-pat modules exist.
- Renderer supports bubbles, auto-hide, drag, double-click chat, right-click settings, long-press head-pat.

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
src/app/renderer/App.tsx
src/app/renderer/PetView.tsx
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
Test Files 31 passed
Tests 104 passed
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

1. Merge feature branch to `main` after user approves.
2. Improve MCP connection UX: clearer README troubleshooting and maybe a tray diagnostic action showing MCP settings path.
3. Add richer mood transitions after chat sentiment detection instead of treating all successful chats as positive.
4. Add bubble queue so status/chat/presence messages do not overwrite each other.
5. Add more `variants` for Kaka pack if new local assets are available.
