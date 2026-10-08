---
name: cpanel-local-upload
description: Explicitly upload the local project to cPanel and overwrite matching remote files
---
# cPanel Local Upload

This is an intentional full local-to-remote upload. Before execution, show exactly what will happen: existing remote files at matching paths will be overwritten, new local files will be added, and remote-only files will not be deleted. Require explicit confirmation.
