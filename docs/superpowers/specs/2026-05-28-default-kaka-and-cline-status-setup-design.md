# Default Kaka Pet and Cline Status Setup Design

## 1. Summary

This supplemental design fixes two post-implementation usability gaps in the 12-state Cline Desktop Pet branch:

1. If the local `kaka-desktop-pet` pack is installed and no previous pet selection exists, the app should default to Kaka instead of the bundled robot fallback.
2. The desktop pet should provide a one-command setup path that installs both the Cline global status rule and the `cline-desktop-pet` MCP server configuration, so Cline can call `update_pet_status` during task transitions.

The app still does not read code, prompts, files, or Cline internals. Status updates remain explicit MCP tool calls with short status/task/message payloads.

## 2. Root Cause Findings

### 2.1 Kaka is installed but not selected

- `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/manifest.json` exists.
- The manifest is `formatVersion: 2` and contains all 12 state mappings.
- `%APPDATA%/cline-desktop-pet/state.json` does not exist.
- Current `loadSelectedId()` returns `default-pixel-dev` when there is no saved selection, so the bundled robot fallback wins even when Kaka is installed.

### 2.2 Cline status detection is not automatic

- The desktop pet receives real-time status only when something calls the MCP tool `update_pet_status`.
- The Cline global rule file `C:\Users\28417\Documents\Cline\Rules\cline-desktop-pet.md` is not installed.
- The Cline MCP settings file exists at `C:\Users\28417\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`, but it does not contain a `cline-desktop-pet` server entry.
- Therefore Cline has no instruction and no tool server registration for updating the pet.

## 3. Goals

1. Prefer `kaka-desktop-pet` automatically when it is installed and the user has not saved a different pet selection.
2. Preserve manual tray selection: once the user chooses a pet, that saved choice should continue to win.
3. Add a safe setup script that installs:
   - `docs/cline-global-rule.md` to `C:\Users\28417\Documents\Cline\Rules\cline-desktop-pet.md`.
   - a `cline-desktop-pet` entry into Cline MCP settings.
4. Keep setup idempotent: running the setup script more than once should update the same MCP entry, not duplicate it.
5. Keep privacy boundaries unchanged: only short status metadata is sent through MCP/Bridge.

## 4. Non-Goals

- Do not implement direct Cline internal state scraping.
- Do not monitor editor files or terminal output.
- Do not push to GitHub automatically.
- Do not commit user PNG assets.
- Do not remove the bundled default fallback pet.

## 5. Design

### 5.1 Default Kaka selection

Introduce a pure helper in `src/app/main/main.ts` or a small adjacent module:

```ts
function chooseInitialPetPackId(savedId: string | null, availablePackIds: string[]) {
  if (savedId && availablePackIds.includes(savedId)) return savedId;
  if (!savedId && availablePackIds.includes("kaka-desktop-pet")) return "kaka-desktop-pet";
  return "default-pixel-dev";
}
```

Behavior:

- Missing `state.json` means `savedId = null`.
- Existing valid saved selection wins over Kaka.
- Existing invalid saved selection falls back to `default-pixel-dev` rather than silently overriding to Kaka, because an invalid saved choice indicates stale state that diagnostics should make visible.
- If no saved selection exists and Kaka is present, choose Kaka.
- If Kaka is absent, choose `default-pixel-dev`.

### 5.2 Cline status setup script

Add a new script:

```text
scripts/install-cline-status-integration.ps1
```

Responsibilities:

1. Locate the project root from `$PSScriptRoot`.
2. Copy `docs/cline-global-rule.md` to `C:\Users\28417\Documents\Cline\Rules\cline-desktop-pet.md`.
3. Create or update Cline MCP settings at:

   ```text
   C:\Users\28417\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
   ```

4. Add/update this server entry:

   ```json
   {
     "mcpServers": {
       "cline-desktop-pet": {
         "command": "cmd",
         "args": ["/c", "npm", "--prefix", "<project-root>", "run", "dev:mcp"],
         "disabled": false,
         "autoApprove": ["update_pet_status", "pet_status_check"]
       }
     }
   }
   ```

5. Preserve all existing MCP server entries.
6. Print a clear restart instruction: Cline/VS Code should be reloaded after settings change.

The script should not require network access.

### 5.3 Existing install-global-rule script

Keep `scripts/install-global-rule.ps1` for users who only want the rule. The new integration script is the recommended one-step setup path.

### 5.4 Documentation

Update `README.md` to explain:

- Kaka becomes the default if installed and no other selection exists.
- Run `./scripts/install-cline-status-integration.ps1` to make Cline actually drive the pet.
- Restart/reload Cline after installing MCP settings.

## 6. Tests

Automated tests should cover:

1. Initial pet selection helper:
   - no saved selection + Kaka available -> Kaka
   - no saved selection + Kaka missing -> default
   - valid saved selection -> saved selection
   - invalid saved selection -> default
2. Setup script parser validation via PowerShell parser.
3. If practical, a script smoke test using temporary target paths to verify MCP JSON is created/updated without touching the real user settings.

## 7. Acceptance Criteria

1. Starting the app after installing Kaka and with no `state.json` selects `kaka-desktop-pet` automatically.
2. Cline MCP settings contain `cline-desktop-pet` after running the integration script.
3. `C:\Users\28417\Documents\Cline\Rules\cline-desktop-pet.md` exists after running the integration script.
4. Existing MCP server entries are preserved.
5. `npm test` passes.
6. `npm run build` passes.
7. `git status --short` is clean after commits.

## 8. Self-Review

- Scope is limited to default Kaka selection and explicit Cline/MCP setup.
- No requirement depends on reading Cline internals or code contents.
- The design keeps existing tray selection and default fallback behavior.
- The setup script is idempotent and preserves existing MCP configuration.
- No user PNG assets are added to the repository.