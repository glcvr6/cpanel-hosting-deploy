# Release Process

## Versioning

The project follows semantic versioning in the form `MAJOR.MINOR.PATCH`.

The plugin version must remain consistent across:

- `.cursor-plugin/plugin.json`;
- `package.json`;
- `server/cpanel-mcp.js`;
- `CHANGELOG.md`;
- README/release documentation where the version is explicitly referenced.

## Current release: v1.13.4

v1.13.4 is a workspace-resolution safety patch. It removes the unsafe fallback to the MCP process working directory, prefers Cursor's `WORKSPACE_FOLDER_PATHS`, and fails closed with actionable guidance when the active workspace cannot be identified.

### Headline changes

- Transactional deployment-manifest locking.
- Atomic first-run connections-store creation.
- Crash-safe persisted JSON state.
- Stale-lock detection and ownership-safe lock cleanup.
- Remote snapshot revalidation before sensitive actions.
- Local workspace/path and symlink protection.
- Bounded cPanel API requests.
- Unique remote backup naming and retention.
- Workspace detection prefers Cursor's `WORKSPACE_FOLDER_PATHS` variable.
- Remote downloads accept a validated explicit project path when active workspace context is missing, and fail closed for invalid paths or Cursor/plugin installation directories.
- Regression tests cover missing workspace context, invalid paths, and project paths containing spaces.

### Validation status

The release CI validates:

- Node.js 20;
- Node.js 22;
- JavaScript syntax;
- plugin metadata/structure;
- package version metadata.

PR #20 contains the workspace-resolution fix and its Node.js 20/22 CI validation.

## Release checklist

1. Confirm all version fields agree.
2. Update `CHANGELOG.md`.
3. Update README and user-facing documentation.
4. Review safety/recovery documentation.
5. Run `node --check server/cpanel-mcp.js`.
6. Run `node tests/validate-plugin.js`.
7. Review repository contents for credentials/secrets.
8. Confirm no generated local state is included.
9. Confirm CI is green on Node.js 20 and 22.
10. Merge the release-preparation changes to `main`.
11. Create the GitHub tag/release using the exact version.
12. Publish release notes that distinguish implemented behavior from behavior still under real-world testing.

## Release notes guidance

Do not claim that Protection has been exhaustively validated on every cPanel environment. The implementation is present and regression-tested, while broader real-world testing remains an explicit project goal.

For release assets, distribute only the intended plugin/package contents. Never include API tokens, passwords, cookies/session data, private keys, customer files, generated `.hosting` state, or local test fixtures containing secrets.

## Rollback

If a release introduces a regression:

1. Stop recommending the affected version.
2. Identify the last known-good tag.
3. Reproduce the failure on disposable data.
4. Fix and regression-test the issue.
5. Publish a patch release rather than rewriting a published release.
