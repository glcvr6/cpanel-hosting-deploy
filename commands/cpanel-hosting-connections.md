---
name: cpanel-hosting-connections
description: Onboard a workspace and configure cPanel local-to-remote mappings
---
# cPanel Hosting Connections

First determine workspace state with `cpanel_workspace_state`:
1. empty/new local workspace
2. existing local project
3. change existing configuration

Never infer the desired workflow from saved connections alone.

For empty workspaces, let the user choose remote folders and local destinations before downloading.
For existing projects, map local folders to remote folders without overwriting local files.
For configuration changes, show existing mappings and let the user add, remove, rename, enable, or disable them.

Never assume `public_html` or any other remote folder. Never expose API tokens.
