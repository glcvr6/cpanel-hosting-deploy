---
name: cpanel-hosting-config
description: Configure cPanel connections, rename Default, and manage local-to-remote mappings
---
# cPanel Hosting Deploy Configuration

Use the cPanel connection tools to manage configuration.

## Connection name

The initial connection is named **Default** when no custom name is configured.

The user may rename it:
- directly in Cursor's plugin **Configure** menu by changing **Default connection name**, or
- here by asking to rename the connection and using `cpanel_edit_connection` with `newName`.

Never expose or print API tokens.

## What can be configured

- connection name
- cPanel host
- cPanel username
- API token (accept it only as a secret input; never echo it)
- remote root/home directory
- any user-selected remote folder mappings
- local folder names
- mapping enabled/disabled state
- excluded names

Do not assume `public_html`, `nodevenv`, or any other remote folder. Use remote discovery when the user wants help selecting folders.

Changing configuration alone must not upload, download, restore, or delete files.
