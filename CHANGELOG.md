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
