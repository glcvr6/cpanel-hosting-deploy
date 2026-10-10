---
name: cpanel-remote-download
description: Explicitly download files from cPanel hosting to the local workspace
---
# cPanel Remote Download

Only download when explicitly requested. Existing local files may be overwritten.

When calling `cpanel_download`, pass `workspace` as the absolute path of the currently open Cursor project folder. Never use the Cursor application or plugin installation directory. If the active project path is not known with confidence, ask the user for it instead of guessing.
