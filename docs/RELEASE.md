# Release Process

## Versioning

The project follows semantic versioning in the form `MAJOR.MINOR.PATCH`.

The plugin version should remain consistent across:

- `.cursor-plugin/plugin.json`;
- `package.json`;
- release notes/changelog;
- documentation where a version is explicitly referenced.

## Release checklist

1. Update version metadata.
2. Update `CHANGELOG.md`.
3. Update user-facing documentation.
4. Run `node --check server/cpanel-mcp.js`.
5. Run `node tests/validate-plugin.js`.
6. Review the repository for credentials/secrets.
7. Confirm the ZIP/package contains only intended files.
8. Commit to `main`.
9. Create a GitHub release/tag.
10. Publish release notes that distinguish implemented behavior from behavior still under testing.

## v1.11.0 release position

Protection is implemented in v1.11.0. The project deliberately labels systematic real-world Protection testing as the next development phase. This avoids overstating the maturity of new safety policies while making the implementation available for controlled testing.
