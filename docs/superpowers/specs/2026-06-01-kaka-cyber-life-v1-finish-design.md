# Kaka Cyber Life v1 Finish Design

## Summary

This finish pass closes the last Cyber Life v1 behavior gaps before preparing a GitHub PR. It keeps the scope intentionally small: wire the already-designed presence guards into the real Electron runtime, refresh development documentation, run verification, push the feature branch, and open a PR.

## Goals

1. Make proactive presence respect the user's long-reply reading mode in the actual renderer-to-main loop.
2. Make long-work care reminders depend on a real main-process work-session timer instead of only test inputs.
3. Refresh project documentation so the next development session and PR reviewer understand the final v1 behavior.
4. Prepare the feature branch for review by running tests, building, pushing, and creating a GitHub PR.

## Non-goals

- Do not expand quiet-mode coverage to chat input, settings, or history panels. For this pass, quiet mode means only the long chat reply `readable` bubble mode.
- Do not add a memory-management UI, richer v2 personality stages, or new pet assets.
- Do not merge into `main` automatically. The output is a PR for review.
- Do not change the MCP/Bridge status update architecture.

## Approved Behavior

### Reading quiet mode

- Renderer reports `userIsReading: true` only when a long chat bubble is opened into readable mode.
- Renderer reports `userIsReading: false` when that readable bubble is closed or replaced.
- History panel, settings panel, and normal chat input do not count as reading quiet mode in this pass.
- Main passes the current reading flag into `maybeCreatePresencePulse()`.
- If `userIsReading` is true, proactive presence returns `null` and does not interrupt the reading session.

### Long-work care reminder

- Main tracks a local `workSessionStartedAt` timestamp.
- A work session starts when the latest visible status enters `loading` or `thinking`.
- A work session resets when the latest visible status leaves both `loading` and `thinking`.
- `longWorkSession` becomes true only after the work session has lasted at least 90 minutes.
- Main passes `longWorkSession` into `maybeCreatePresencePulse()`.
- Existing presence cooldown remains in force, so the reminder stays rare even during long sessions.

## Architecture

### Renderer

`src/app/renderer/App.tsx` remains the state coordinator. It already knows the current bubble and controls readable mode through `makeBubbleReadable()`. This pass adds one small bridge call boundary:

```ts
setPresenceActivity({ userIsReading: boolean })
```

The renderer calls it when the current bubble's readable state changes. The call should be best-effort: if preload/main is unavailable, UI behavior must continue without throwing.

### Preload bridge

`src/app/renderer/petBridge.ts` exposes a typed method that invokes a main-process IPC channel:

```ts
setPresenceActivity(input: { userIsReading?: boolean }): Promise<{ ok: true } | { ok: false; message: string }>
```

`src/app/main/preload.ts` continues to expose the bridge through `window.clinePet`.

### Main process

`src/app/main/main.ts` owns two runtime-only values:

- `userIsReading`: updated by the renderer IPC call.
- `workSessionStartedAt`: derived from status updates entering or leaving `loading` / `thinking`.

`notifyRenderer()` is the safest place to update the work-session tracker because every Bridge, chat mood, interaction, and presence status update already flows through it. The presence interval then computes whether the work session has crossed 90 minutes and passes both flags to `maybeCreatePresencePulse()`.

### Presence service

`src/app/main/presenceService.ts` already accepts `userIsReading` and `longWorkSession`. The finish pass should keep this service pure and covered by focused unit tests; main-process runtime tracking should be tested separately where practical through extracted helper functions if needed.

## Error Handling

- Renderer bridge calls are best-effort and swallowed on failure.
- Main validates the IPC payload defensively with boolean coercion.
- A malformed presence activity payload should return `{ ok: false }` rather than throw.
- Presence reminders must never block status rendering, chat replies, or pet interactions.

## Testing Plan

1. Renderer App test: opening a long chat bubble into readable mode calls `setPresenceActivity({ userIsReading: true })`; closing it calls `false`.
2. Bridge test: `setPresenceActivity()` invokes the expected IPC channel and payload.
3. Main/presence runtime test: helper logic marks continuous `loading` / `thinking` over 90 minutes as long work and resets when returning to `idle`.
4. Existing presence tests continue to prove `userIsReading` suppresses pulses and `longWorkSession` enables the water reminder after cooldown.
5. Full verification before PR: `npm test`, `npm run build`, `git status --short --branch`.

## Documentation and PR Closeout

- Update `docs/development/kaka-development-guide.md` with the final v1 presence wiring.
- Update `docs/development/kaka-compact.md` with the latest commits, verification counts, and next Cyber Life v2 suggestions.
- Push `feat/12-state-local-pet-pack`.
- Create a GitHub PR from `feat/12-state-local-pet-pack` into `main` with a summary of Cyber Life v1 and verification evidence.

## Risks and Constraints

- The desktop pet MCP connection may still be stale from Cline's MCP server side; this pass does not fix that connection UX.
- Renderer jsdom tests may print existing React `act(...)` warnings; success is based on Vitest exit code and pass summary.
- Do not commit `.superpowers/`, local app data, logs, PNG assets, API keys, or config files.

## Spec Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Consistency check: behavior, architecture, tests, and docs all target the same small v1 finish scope.
- Scope check: this is a single implementation plan, not a full Cyber Life v2 effort.
- Ambiguity check: quiet mode explicitly covers only long chat reply readable mode; long work is explicitly 90 minutes of continuous `loading` or `thinking`.