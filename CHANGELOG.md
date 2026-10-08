## [1.11.8] - 2026-10-08

### Fixed
- Revalidate the live remote file state immediately before deploy uploads, restores, and remote deletions so stale observations cannot silently overwrite newer hosting changes.
- Revalidate remote-sync actions against the snapshot shown to the user before downloading or deleting local files.
- Remove the unused remote-pending journal that was written but never consumed for recovery.

## [1.11.7] - 2026-10-08

### Fixed
- Serialize add, edit, remove, and settings mutations of the shared connections store under a dedicated stale-lock-safe transaction lock.
- Replace the shared connections temp file with unique atomic state writes.
- Reject connection renames that collide with an existing connection name.

## [1.11.6] - 2026-10-08

### Fixed
- Reject actual NUL bytes in local folder mappings instead of checking for a literal backslash-zero sequence.
- Fail closed when the deployment manifest exists but is malformed or unreadable.
- Fail closed when the saved remote baseline exists but is malformed or unreadable.

## [1.11.5] - 2026-10-08

### Fixed
- Serialize accepted Protection-state read-modify-write updates with a dedicated stale-lock-safe file lock.
- Harden lock cleanup with an ownership token so one process cannot remove another process's replacement lock.
- Reuse the same lock implementation for destructive operation locks.

## [1.11.4] - 2026-10-08

### Fixed
- Write manifest, remote baseline, pending state, and protection state atomically through temporary files and rename.
- Fail closed when protection state exists but is unreadable/corrupted instead of silently resetting accepted decisions.

## [1.11.3] - 2026-10-08

### Fixed
- Recover stale operation locks left by a crashed process without deleting active locks.
- Make local backup retention recurse through nested backup paths and retain the newest backups by modification time.
- Keep distributed version metadata aligned with the server release.

## [1.11.1] - 2026-10-08

### Fixed
- Fix Cursor plugin workspace detection for Marketplace-installed MCP servers.
- Stop relying on the unresolved ${workspaceFolder} placeholder inside the plugin's MCP environment.
- Resolve the active local workspace from Cursor's `WORKSPACE_FOLDER_PATHS` (with safe fallbacks).
- Expose the resolved workspace source in workspace-state diagnostics.

# Changelog

All notable changes to this project are documented here.

## [1.11.0] - 2026-10-08

### Added

- Per-connection Protection modes: `SECURED`, `CUSTOM`, and `OFF`.
- Grouped custom Protection settings.
- Configurable large-file verification threshold with a 3 MB default.
- `/cpanel-hosting-settings` and Protection settings MCP operations.
- Protection-aware state, backup, reporting, recovery, and destructive-operation handling architecture.
- Community Protection testing roadmap and documentation.
- GitHub CI, Dependabot configuration, issue templates, pull-request template, Code of Conduct, support guidance, and citation metadata.

### Changed

- Preserved the original v1.10.3 core workflow when Protection is `OFF`.
- Updated author and repository metadata.
- Remote mappings are not restricted to a single remote root folder; users can select accessible remote paths deliberately.
- Expanded documentation around safety, architecture, testing, release management, and contribution.

### Testing status

Core plugin validation and syntax checks pass. Protection is implemented, but systematic real-world Protection testing remains the next development phase. The project explicitly invites controlled community testing on non-production cPanel accounts.

## [1.10.3]

- Stable remote status/synchronization workflow.
- Remote status refresh before remote synchronization.
- Conflict detection and explicit reconciliation.
- Preservation of remote-untracked content.
