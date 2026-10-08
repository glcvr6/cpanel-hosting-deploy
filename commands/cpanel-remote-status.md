---
name: cpanel-remote-status
description: Detect remote-only, remote-changed, and remote-deleted files without modifying the local project
---
# cPanel Remote Status

Read-only remote-to-local comparison. Detect:
- REMOTE NEW — exists on hosting but is not tracked locally
- REMOTE CHANGED — tracked remote file changed since the saved remote metadata baseline
- REMOTE DELETED — tracked local file no longer exists on hosting
- CONFLICT — local and remote both appear changed; never overwrite automatically

The command never writes project files. It stores only `.hosting/remote-meta.json` as the remote observation baseline.

After showing changes, ask whether the user wants to synchronize them. Use `/cpanel-remote-sync` for explicit per-file sync/keep choices.
