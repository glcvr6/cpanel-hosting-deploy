---
name: cpanel-hosting-settings
description: Configure per-connection Protection and operational safety settings
---
# cPanel Hosting Deploy Settings

Use `cpanel_get_settings` and `cpanel_set_settings`.

## PROTECTION
- **SECURED** — all Protection rules are enabled.
- **CUSTOM** — user-selectable grouped Protection rules.
- **OFF** — only the original v1.10.3 core workflow is active; additional Protection checks are bypassed.

Protection is stored per connection. Default mode is OFF for backward compatibility.

Custom groups: Change Detection, Content Verification, Conflict Protection, Backup Protection, Operation Safety, Destructive Action Protection, Accepted State, and Reporting.

Default large-file threshold: 3 MB; configurable per connection.
