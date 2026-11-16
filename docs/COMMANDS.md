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

Command Markdown under `commands/` is the agent-facing procedure for each slash command. Prefer those files when changing operator wording.

## High-level status categories

Local-oriented workflows use `UNCHANGED`, `CHANGED`, `NEW`, and `DELETED`.

Remote-oriented workflows use `REMOTE NEW`, `REMOTE CHANGED`, `REMOTE DELETED`, `REMOTE UNTRACKED`, and `CONFLICT`.

Status tools only evaluate currently enabled mappings. See `docs/CONFIGURATION.md`.

## MCP tools

Registered tools in `server/cpanel-mcp.js` (summarized; schemas are authoritative):

| Tool | Purpose |
|---|---|
| `cpanel_get_settings` | Read per-connection Protection/settings without secrets |
| `cpanel_set_settings` | Update Protection mode and related settings |
| `cpanel_help` | Return the command/help catalog |
| `cpanel_list_connections` | List connections without exposing tokens |
| `cpanel_add_connection` | Add a connection (token encrypted; Windows DPAPI in v1) |
| `cpanel_edit_connection` | Edit a connection; omit `apiToken` to keep the stored secret |
| `cpanel_remove_connection` | Remove a stored connection |
| `cpanel_list_remote_folders` | Read-only remote folder listing for mapping selection |
| `cpanel_test_connection` | Test credentials and remote-root access |
| `cpanel_workspace_setup` | Initialize empty local folders from selected remote folders |
| `cpanel_workspace_state` | Read-only local workspace/onboarding diagnostics |
| `cpanel_deploy_plan` | Build a local deployment plan; never modifies hosting |
| `cpanel_deploy` | Deploy `NEW`/`CHANGED`; explicit per-file actions for local `DELETED` |
| `cpanel_local_upload` | Explicit full local-to-remote upload after confirmation |
| `cpanel_remote_status` | Read-only remote comparison against the remote baseline |
| `cpanel_remote_sync` | Apply selected remote sync actions with required keywords |
| `cpanel_download` | Preview then confirm remote-to-local download |

### Download confirmation flow

1. Call `cpanel_download` without `confirm=true` (optional absolute `workspace` if needed).
2. Present every previewed `remotePath` and `localMappedPath`.
3. After explicit user approval, call again with `confirm: true` and the exact `confirmationToken`.
4. If the workspace or mappings changed, treat the new preview as authoritative and ask again.

Details: `commands/cpanel-remote-download.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`.

## Related docs

- `docs/ARCHITECTURE.md` — runtime layout and download transport
- `docs/CONFIGURATION.md` — connections, mappings, excludes
- `docs/SAFETY.md` — confirmation and fail-closed rules
