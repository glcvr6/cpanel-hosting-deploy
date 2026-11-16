# Troubleshooting

Developer-oriented pitfalls verified against `server/cpanel-mcp.js` in v1.13.6. Use a disposable cPanel account when reproducing hosting-side failures.

## Workspace cannot be resolved

**Symptom:** Errors such as `Unable to determine the Cursor workspace` or refusals to write into a Cursor/plugin install directory.

**Cause:** Plugin MCP servers may start without a project root. The server resolves the workspace from, in order:

1. `WORKSPACE_FOLDER_PATHS`
2. `CURSOR_PROJECT_DIR`
3. `CURSOR_WORKSPACE`
4. `VSCODE_CWD`

It never falls back to `process.cwd()`, because that can be Cursor's installation directory.

**What to do:**

- Open the intended project folder in Cursor and reload the window.
- For `/cpanel-remote-download` / `cpanel_download`, pass an absolute `workspace` path when Cursor does not expose workspace context.
- Do not point `workspace` at a Cursor application or plugin installation directory.

## Status fails after disabling a mapping

**Symptom:** Local or remote status previously failed (or appeared to query unrelated folders) after a mapping was disabled.

**Cause (fixed in v1.13.5):** The deployment manifest can retain entries for disabled mappings. Status now skips those entries and only compares currently enabled mappings.

**What to do:** Keep unused mappings disabled rather than deleting manifest history. Re-enable a mapping only when you intend to compare that folder again.

## Download preview rejected / confirmation token invalid

**Symptom:** `cpanel_download` keeps returning `requiresConfirmation`, or approving once does not complete the download.

**Cause:** Downloads are a two-step flow. The first call returns a preview with exact `remotePath` / `localMappedPath` pairs and a `confirmationToken` derived from the connection name, absolute workspace, and enabled mappings. The second call must send `confirm: true` and that exact token. Changing the workspace or mappings invalidates the token.

**What to do:** Show the fresh preview paths, get explicit approval, then retry with the new token. Never reuse a previous approval for different destinations.

## Download transport / size mismatch

**Symptom:** Download fails with UAPI content errors, size mismatch, or a message that also mentions fallback `/download`.

**Cause:** Explicit downloads prefer authenticated Fileman `get_file_content` UAPI with byte-preserving Latin-1 handling and size validation. If that path fails (for example host size limits), the server tries the legacy `/download` route and surfaces both errors when the fallback also fails. Some hosts return HTTP 403 on the legacy route when only an API token is available.

**What to do:** Check the combined error text. Confirm the remote file size is stable, the API token can read Fileman content, and the host allows UAPI file reads for the target size.

## Connection / credential errors on non-Windows hosts

**Symptom:** Creating or editing a connection fails with `This v1 secure credential store requires Windows DPAPI.`

**Cause:** API tokens are encrypted and decrypted with Windows DPAPI via PowerShell. Adding or revealing tokens is Windows-only in v1.

**What to do:** Configure live connections on Windows. Syntax validation and most regression tests still run on Linux/macOS CI without storing tokens.

## HTTPS required

**Symptom:** Connection tests or API calls reject the host URL.

**Cause:** `authHeaders` requires an `https:` cPanel host so the API token is never sent over cleartext HTTP.

**What to do:** Use an HTTPS cPanel URL (no trailing slash required; the server normalizes it).

## Exclude patterns not matching as expected

**Symptom:** Files under an expected exclude still appear in plans, or a broad name exclude hides more than intended.

**Cause:** Default excludes are `node_modules`, `.git`, `.env`, and `logs`. Patterns containing `/` match that relative path and everything below it. Single-component patterns match that name anywhere in the relative path. Protection backup/report paths and `.zip` files are also ignored.

**What to do:** Prefer precise path excludes (`site/logs`) when a bare component name (`logs`) would match too broadly.

## Partial sync / deploy results

**Symptom:** Some files succeed while others fail; baselines appear only partially updated.

**Cause:** By design, partial-success paths advance the local or remote baseline only for files that completed successfully. Failed items remain detectable on the next status/plan pass.

**What to do:** Re-run status, review the failed list, fix the underlying transfer error, then sync/deploy the remaining items explicitly.
