---
name: cpanel-remote-download
description: Explicitly download files from cPanel hosting to the local workspace
---
# cPanel Remote Download

Only download when explicitly requested. Existing local files may be overwritten.

When calling `cpanel_download`, pass `workspace` as the absolute path of the currently open Cursor project folder. Never use the Cursor application or plugin installation directory. If the active project path is not known with confidence, ask the user for it instead of guessing.

The downloader uses cPanel's authenticated `Fileman::get_file_content` UAPI for byte-preserving reads first. It validates the downloaded byte count before writing and uses the legacy `/download` route only as a fallback when UAPI cannot return the file (for example, a host-enforced size limit). Failed fallback responses include a sanitized diagnostic preview; never retry persistent HTTP 403 responses blindly.
