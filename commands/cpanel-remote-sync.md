---
name: cpanel-remote-sync
description: Explicitly synchronize selected remote changes into the local workspace
---
# cPanel Remote Sync

IMPORTANT: This command MUST use the MCP tool `cpanel_remote_sync`. Do not inspect files manually and do not infer remote status from the workspace.

Workflow:
1. Call `cpanel_remote_sync` for the selected connection with `confirm=false` and no actions.
2. Show the tool's current REMOTE NEW, REMOTE CHANGED, REMOTE DELETED and CONFLICT results.
3. Ask the user what to do for each candidate file. Do not change local files yet.
4. After the user chooses actions, call `cpanel_remote_sync` again with `confirm=true` and explicit per-file actions.

Rules:
- REMOTE NEW -> `sync` downloads the remote file to its mapped local path.
- REMOTE CHANGED -> `sync` requires confirmation `OVERWRITE_LOCAL`.
- REMOTE DELETED -> `sync` requires confirmation `DELETE_LOCAL`.
- `keep` leaves the local file untouched.
- CONFLICT is never overwritten automatically.
- Never use shell commands or edit the plugin source.
- The MCP tool refreshes the remote state immediately before every sync decision.
- The local SHA-256 manifest is updated only after a successful sync operation.
