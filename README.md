# Cline Desktop Pet

A Windows 11 floating desktop pet for Cline, built with Electron and MCP status updates. Supports pixel pet packs, tray controls, start-on-boot, and one-click diagnostics.

## Features

- Transparent always-on-top Electron desktop pet window
- Six Cline states: `idle`, `thinking`, `working`, `waiting-approval`, `done`, `error`
- MCP tools: `update_pet_status` and `pet_status_check`
- Local HTTP bridge from MCP server to Electron app
- Pixel pet asset packs with local switching support
- Tray menu: show/hide, diagnostics, logs, pet selection, refresh packs, start on boot, quit
- Privacy-safe payloads: status and short task summaries only

## Development

```powershell
npm install
npm test
npm run build
```

To launch the Electron pet window after Electron is available locally:

```powershell
npm run dev:electron
```

If Electron binary download is slow, let `npm install --include=optional electron` finish first, then run `npm run dev:electron` again.

## MCP Server

```powershell
npm run dev:mcp
```

## Simulate states

Run the Electron app first, then:

```powershell
npm run simulate
```

## Pet packs

Local pet packs live under:

```text
%APPDATA%/cline-desktop-pet/pets/<pet-id>/
```

See `docs/pet-pack-format.md`.

## Cline global rule

See `docs/cline-global-rule.md` and optional installer:

```powershell
./scripts/install-global-rule.ps1
```