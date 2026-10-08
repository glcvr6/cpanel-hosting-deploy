---
name: cpanel-local-status
description: Show local project changes relative to the saved hosting manifest
---
# cPanel Local Status

Use `cpanel_deploy_plan` for the selected connection.

Report NEW, CHANGED, UNCHANGED, and DELETED local files. This is read-only and never uploads, downloads, restores, or deletes.

This command intentionally does not scan remote-only changes. Use `/cpanel-remote-status` for that.
