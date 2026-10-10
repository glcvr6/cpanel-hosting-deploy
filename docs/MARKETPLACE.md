# Marketplace and GitHub Presentation Notes

## Project identity

**Name:** cPanel Hosting Deploy  
**Version:** 1.13.5  
**Author:** Gabrijel Baban  
**Repository:** https://github.com/glcvr6/cpanel-hosting-deploy

## Short description

Safe cPanel deployment and remote synchronization for Cursor. Detect local and remote changes, detect conflicts, protect destructive operations, maintain SHA-256 state, and synchronize multiple cPanel connections with explicit user decisions.

## GitHub preview priorities

The repository front page should communicate these points immediately:

1. What the plugin does: safe Cursor ↔ cPanel deployment and synchronization.
2. Why it is different: explicit destructive decisions, conflict detection, and state-aware synchronization.
3. Current release: v1.13.5.
4. Safety work: atomic state, concurrency locks, remote TOCTOU revalidation, local path/symlink protection, backups, and bounded API operations.
5. Honest maturity: Protection is implemented and regression-tested, while broader real-world cPanel validation is still being expanded.
6. How to install/configure: link users to `docs/CONFIGURATION.md`.
7. How to test/contribute: link users to `docs/TEST-MATRIX.md`, `docs/PROTECTION-TESTING.md`, and `CONTRIBUTING.md`.

## Distribution requirements

The distributed package must not contain:

- customer credentials;
- cPanel API tokens;
- production mappings;
- private customer data;
- local state generated during testing.

## Release messaging

v1.13.5 fixes Local Status and Remote Status so they only inspect enabled folder mappings. Disabled-mapping entries remain in the manifest but are not compared or queried, and regression tests cover both local and protected/unprotected remote status.

Do not describe the project as fully production-proof across all cPanel configurations. Invite controlled testing on non-production accounts.

## Recommended GitHub topics

`cpanel`, `hosting`, `deployment`, `cursor`, `mcp`, `fileman`, `sync`, `devtools`, `web-hosting`, `automation`.

## Recommended release title

`v1.13.5 — Enabled-mapping status reliability`
