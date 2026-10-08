# Commands and MCP Operations

## Cursor commands

| Command | Purpose |
|---|---|
| `/cpanel` | Main menu and entry point |
| `/cpanel-hosting-help` | Command/workflow help |
| `/cpanel-hosting-config` | Configure connections and mappings |
| `/cpanel-hosting-settings` | Configure per-connection Protection/settings |
| `/cpanel-hosting-connections` | Workspace onboarding and connection mapping |
| `/cpanel-local-status` | Read-only local status |
| `/cpanel-local-deploy` | Deploy local changes with explicit reconciliation |
| `/cpanel-local-upload` | Upload selected local content |
| `/cpanel-remote-status` | Inspect remote-side changes |
| `/cpanel-remote-sync` | Reconcile remote changes into local state |
| `/cpanel-remote-download` | Explicit remote-to-local download |

## High-level status categories

Local-oriented workflows use `UNCHANGED`, `CHANGED`, `NEW`, and `DELETED`.

Remote-oriented workflows use `REMOTE NEW`, `REMOTE CHANGED`, `REMOTE DELETED`, `REMOTE UNTRACKED`, and `CONFLICT`.

## MCP tools

The server exposes the plugin's connection/configuration, planning, deployment, upload/download, remote status, remote synchronization, and Protection settings operations through MCP. The exact registered tools are defined in `server/cpanel-mcp.js` and `mcp.json`.

For implementation details, see `docs/ARCHITECTURE.md` and the command-specific Markdown files under `commands/`.
