# Contributing to cPanel Hosting Deploy

Thank you for helping improve cPanel Hosting Deploy.

This project is a Cursor plugin that can modify local and remote files. Contributions that affect deployment, synchronization, deletion, overwrite, backup, recovery, or credential handling require extra care.

## Before you start

1. Read `README.md` and `docs/ARCHITECTURE.md`.
2. Read `docs/SAFETY.md` before changing synchronization or destructive-operation behavior.
3. Read `docs/PROTECTION-TESTING.md` before changing Protection logic.
4. Never commit cPanel credentials, API tokens, customer data, production paths, private logs, or generated secrets.
5. Test against a disposable/non-production cPanel account whenever possible.

## Development

The project intentionally has no runtime npm dependency tree. The MCP server uses Node.js built-ins and the Cursor MCP environment.

Run the local checks:

```bash
node --check server/cpanel-mcp.js
node tests/validate-plugin.js
```

If you add or change behavior, update the relevant documentation and test matrix.

## Pull requests

Please keep pull requests focused. A good PR should explain:

- what changed;
- why it changed;
- affected commands/MCP tools;
- safety implications;
- tests performed;
- whether behavior differs between `OFF`, `CUSTOM`, and `SECURED` modes.

For destructive-operation changes, include a reproducible test scenario and expected/actual results.

## Protection testing

Protection is implemented, but v1.11.0 is explicitly entering a broader real-world testing phase. Community testing is welcome. Prefer isolated cPanel accounts and test data.

Never attach credentials or unredacted logs. Redact hostnames, usernames, paths, tokens, cookies, and customer data where necessary.

## Commit style

Use clear, imperative commit messages, for example:

- `fix: prevent stale remote status during sync`
- `docs: expand protection testing guide`
- `test: cover remote deleted reconciliation`

## Reporting bugs

Use the GitHub bug-report template when possible. Include the plugin version, Cursor version, Node.js version if relevant, command used, Protection mode, reproducible steps, expected result, actual result, and sanitized diagnostics.

For security vulnerabilities, do **not** open a public issue. Follow `SECURITY.md`.
