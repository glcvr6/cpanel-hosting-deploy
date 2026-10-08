---
name: cpanel-remote-sync
description: Explicitly synchronize selected remote changes into the local workspace.
---
# cPanel Remote Sync Skill

You MUST invoke the MCP tool `cpanel_remote_sync` before asking the user to choose a sync action. Do not derive remote changes by reading local files or by guessing.

First call with `confirm=false` and no actions. The tool performs a fresh remote comparison and returns the current candidates. Present those results to the user.

Only after the user chooses actions, call the tool with `confirm=true` and explicit `{path, action, confirmation}` values where required.

Safety:
- REMOTE CHANGED requires `OVERWRITE_LOCAL`.
- REMOTE DELETED requires `DELETE_LOCAL`.
- `keep` performs no local change.
- CONFLICT is never overwritten automatically.
- Never run shell commands, PowerShell, or modify plugin source.
