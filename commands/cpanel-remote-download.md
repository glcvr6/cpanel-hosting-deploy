---
name: cpanel-remote-download
description: Preview and explicitly confirm downloading files from cPanel to the mapped local folders
---
# cPanel Remote Download

1. Call `cpanel_download` for the selected connection without `confirm=true`.
2. Show the user the exact `workspace`, every `remotePath`, and its `localMappedPath` from the returned preview. Do not paraphrase or omit paths.
3. Explain that existing local files at those paths may be overwritten.
4. Ask the user: “Download from these remote folders into these exact local folders? Existing local files may be overwritten.”
5. Only after an unambiguous affirmative answer, call `cpanel_download` again with the same connection name, `confirm: true`, and the exact `confirmationToken` returned by that preview.
6. If the token is missing/invalid or the workspace/mappings changed, show the fresh preview and ask for approval again. Never reuse approval for different paths.
7. If the user declines or the displayed paths are wrong, do not download. Help correct the workspace or mappings and preview again.

Never treat an absent confirmation as approval. Never bypass workspace detection, workspace-boundary checks, symlink checks, or Cursor/plugin installation path protections, even if the user asks to proceed regardless.
