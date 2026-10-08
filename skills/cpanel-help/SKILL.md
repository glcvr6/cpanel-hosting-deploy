---
name: cpanel-help
description: Explain all cPanel Hosting Deploy commands, workflows, safety rules, and available actions.
---
# cPanel Help

Use this skill for `/cpanel-hosting-help`.

Available commands:
- `/cpanel` — open the main cPanel command menu.
- `/cpanel-hosting-help` — show the complete command reference.
- `/cpanel-hosting-config` — configure connections and mappings, including renaming Default.
- `/cpanel-hosting-connections` — workspace onboarding and mapping setup.
- `/cpanel-local-status` — read-only local deployment status: NEW, CHANGED, UNCHANGED, DELETED.
- `/cpanel-local-deploy` — deploy NEW/CHANGED and resolve DELETED with Restore, Delete-to-trash, or Keep.
- `/cpanel-local-upload` — explicit full local-to-hosting upload with overwrite/add confirmation.
- `/cpanel-remote-status` — read-only remote change detection: REMOTE NEW, REMOTE CHANGED, REMOTE DELETED, and conflicts.
- `/cpanel-remote-sync` — explicitly synchronize selected remote changes into local.
- `/cpanel-remote-download` — explicit hosting-to-local download.

Never expose credentials or API tokens.
