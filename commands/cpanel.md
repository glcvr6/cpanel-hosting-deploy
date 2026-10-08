---
name: cpanel
description: Open the cPanel Hosting Deploy command menu
---
# cPanel Hosting Deploy — Main Menu

When the user invokes `/cpanel`, present this menu and let them choose exactly one operation:

1. **/cpanel-hosting-help** — show what every command does.
2. **/cpanel-hosting-config** — configure connections, rename the Default connection, and manage local↔remote mappings.
3. **/cpanel-local-status** — read-only comparison of local files vs hosting.
4. **/cpanel-local-deploy** — preview and deploy NEW/CHANGED files and explicitly resolve DELETED local files.
5. **/cpanel-local-upload** — full local-to-hosting upload with explicit overwrite confirmation.
6. **/cpanel-remote-status** — read-only remote change detection.
7. **/cpanel-remote-sync** — explicitly sync selected remote changes to local.
8. **/cpanel-remote-download** — explicitly download selected/configured hosting files.
9. **/cpanel-hosting-connections** — run the workspace onboarding flow.

Do not deploy, delete, restore, or download merely by opening `/cpanel`. This command is only a menu/dispatcher.
