# cPanel Hosting Deploy

<p align="center">
  <img src="https://raw.githubusercontent.com/glcvr6/cpanel-hosting-deploy/main/docs/assets/cpanel-hosting-deploy-banner.svg" alt="cPanel Hosting Deploy — Cursor to cPanel safe synchronization" width="920">
</p>


[![CI](https://github.com/glcvr6/cpanel-hosting-deploy/actions/workflows/ci.yml/badge.svg)](https://github.com/glcvr6/cpanel-hosting-deploy/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.13.4-blue.svg)](https://github.com/glcvr6/cpanel-hosting-deploy/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**A generic Cursor plugin for safe local-to-cPanel deployment and remote synchronization.**

cPanel Hosting Deploy connects a Cursor workspace to one or more cPanel accounts, tracks file state with SHA-256 baselines, detects local and remote changes, identifies conflicts, and keeps destructive actions explicit.

> **v1.13.4:** Adds an explicit workspace path for remote downloads when Cursor does not provide workspace context, and rejects Cursor's application/plugin installation folders.

---

## ❤️ Support the project

If **cPanel Hosting Deploy** is useful to you, you can support its continued development.

### 💙 Donate via PayPal

**[👉 Support the project with PayPal](https://paypal.me/gabrijelbaban)**

Other donation options are available in [`SUPPORT.md`](SUPPORT.md), including:

**Revolut · Genome · Binance Pay · BTC · USDT · ETH · BNB · USDC**

---

## Why this project?

Typical FTP-style deployment workflows make it easy to overwrite or delete the wrong thing. This project is designed around a different principle:

**show the state, explain the consequence, and require an explicit decision when the operation is risky.**

### Highlights

- Local ↔ cPanel deployment through Cursor.
- Multiple named cPanel connections.
- Flexible local-to-remote folder mappings.
- SHA-256 baseline tracking.
- Local `NEW`, `CHANGED`, `DELETED`, `UNCHANGED` detection.
- Remote `REMOTE NEW`, `REMOTE CHANGED`, `REMOTE DELETED`, `REMOTE UNTRACKED` detection.
- `CONFLICT` detection when local and remote both diverge.
- Explicit remote synchronization choices.
- Remote deletion routed through cPanel trash behavior where supported.
- Configurable Protection modes: `OFF`, `CUSTOM`, `SECURED`.
- Credential-clean distribution.
- Atomic persisted state and transaction locks for shared local state.
- Remote TOCTOU revalidation immediately before sensitive overwrite/delete/restore actions.
- Local symlink/path-boundary protection and bounded cPanel API requests.
- Windows DPAPI credential protection in the local workflow.
- Retry/partial-success handling and reporting architecture.

## Installation

Install the plugin through the Cursor plugin/marketplace workflow or use the repository package for development/testing.

The distributed plugin contains **no real hosting credentials, customer mappings, API tokens, or customer data**.

After installation:

1. Open the plugin configuration in Cursor.
2. Enter a connection name, cPanel host, username, remote root, and API token.
3. Configure the local ↔ remote mappings.
4. Start with `/cpanel`.
5. For a new or sensitive environment, inspect `/cpanel-remote-status` before changing anything remotely.

See [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) for details.

## Core commands

| Command | Purpose |
|---|---|
| `/cpanel` | Main menu |
| `/cpanel-hosting-help` | Help and command reference |
| `/cpanel-hosting-config` | Connections and mappings |
| `/cpanel-hosting-settings` | Protection/settings |
| `/cpanel-hosting-connections` | Workspace onboarding |
| `/cpanel-local-status` | Local deployment status |
| `/cpanel-local-deploy` | Deploy local changes |
| `/cpanel-local-upload` | Upload selected local content |
| `/cpanel-remote-status` | Remote change detection |
| `/cpanel-remote-sync` | Remote reconciliation |
| `/cpanel-remote-download` | Explicit remote download |

Full details: [`docs/COMMANDS.md`](docs/COMMANDS.md).

## State model

### Local status

- **UNCHANGED** — local and baseline agree.
- **CHANGED** — local content differs from the baseline.
- **NEW** — local file is not present remotely.
- **DELETED** — a previously tracked local file is missing locally while still present remotely.

### Remote status

- **REMOTE NEW** — remote exists, local is missing.
- **REMOTE CHANGED** — tracked remote content differs from the local/baseline state.
- **REMOTE DELETED** — local tracked file exists, remote file is missing.
- **REMOTE UNTRACKED** — remote content exists but is outside the local tracked baseline.
- **CONFLICT** — local and remote both diverged from the shared baseline.

The system does not silently treat remote-only files as disposable content.

## Protection

Protection is configured per connection.

| Mode | Meaning |
|---|---|
| `OFF` | Backward-compatible v1.10.3 core workflow. |
| `CUSTOM` | Enable selected Protection groups. |
| `SECURED` | Enable the complete Protection policy. |

Protection groups cover areas such as change detection, content verification, conflict handling, backups, operation safety, destructive-operation protection, accepted state, and reporting.

The default remains `OFF` for backward compatibility.

### Important maturity note

The Protection implementation is present in v1.11.0, but the project intentionally does **not** claim that every Protection policy has been exhaustively validated across real-world cPanel environments. Systematic real-world testing is the next development phase.

See [`docs/PROTECTION-TESTING.md`](docs/PROTECTION-TESTING.md).

## Safety principles

1. **Credentials never belong in Git.**
2. **Destructive operations are explicit.**
3. **Conflicts are surfaced rather than silently resolved.**
4. **Remote-untracked files are not silently deleted.**
5. **Baselines are updated only for successfully completed operations.**
6. **Partial failures are reported.**
7. **Sensitive/system/log/mail paths are user-selectable but should be mapped only deliberately.**

See [`docs/SAFETY.md`](docs/SAFETY.md).

## State and recovery safety

v1.13.x significantly strengthens persisted and concurrent state:

- JSON state writes use temporary-file replacement rather than in-place writes.
- Connections-store mutations are serialized as transactions, including first-run initialization.
- Manifest read-modify-write transactions use a dedicated lock.
- Operation and Protection-state locks detect stale owners and verify lock ownership before cleanup.
- Corrupt manifest, remote-baseline, connection-store, and Protection-state data fails closed.
- Remote size/mtime snapshots are revalidated immediately before relevant overwrite/delete/restore actions.
- Partial-success synchronization advances the remote baseline only for successfully synchronized items.
- Local deployment paths reject symlink components and workspace escapes.
- cPanel API requests have bounded timeouts.
- Backups use unique names and retention cleanup.

For the detailed model, see [`docs/SAFETY.md`](docs/SAFETY.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Development

Requirements:

- Node.js 20+ recommended.
- Cursor with plugin/MCP support.
- A disposable/non-production cPanel account for integration testing.

Run validation locally:

```bash
node --check server/cpanel-mcp.js
node tests/validate-plugin.js
```

GitHub Actions runs the validation on Node.js 20 and 22.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/TEST-MATRIX.md`](docs/TEST-MATRIX.md).

## Contributing

Contributions and Protection testing are welcome.

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). For security issues, read [`SECURITY.md`](SECURITY.md) and do not publish credentials or sensitive customer information in a public issue.

Useful contribution areas include:

- Protection test scenarios;
- cPanel compatibility reports;
- conflict/recovery testing;
- documentation improvements;
- cross-platform testing;
- bug fixes with reproducible test cases.

## Community testing invitation

If you have a non-production cPanel account, you can help validate the new Protection layer.

Please test `OFF`, `CUSTOM`, and `SECURED` where applicable and report reproducible results through GitHub Issues. Sanitized logs and precise reproduction steps are especially valuable.

**Never include API tokens, passwords, cookies, private keys, or customer data.**

## Security

This plugin interacts with hosting accounts and therefore deserves careful security handling. GitHub repository security features, Dependabot configuration, secret protection, and CI are part of the project's maintenance model.

See [`SECURITY.md`](SECURITY.md).

## Support the author

If cPanel Hosting Deploy saves you time or helps protect your deployment workflow, you can support continued development.

- [PayPal](https://paypal.me/gabrijelbaban)
- [Revolut](https://revolut.me/glcvr6)
- [Genome](https://pay.genome.eu/pay?p=dT0xMDUxMDk3ODAwMDc2NDc1NjY0JnQ9MTc5MTQ2MzAzNyZuPUdBQlJJSkVMJTIwQkFCQU4maT1MVDQ4MzExMDAyNzE0NjM2NDUxMyZiPU1OTkVMVDIxWFhYJmM9RVVS)
- **Binance Pay ID:** `146307213`

### Crypto donation addresses

| Asset | Network | Address |
|---|---|---|
| BTC | Bitcoin | `142uQqSCfAGTFT2EzP3mVXwyFcoo71eic5` |
| USDT | TRC20 | `TCSVbhScGJLfs1qo5MKRMFLyGtGxsbNmyU` |
| USDT | ERC20 / BEP20 | `0xbc404ef40b46979cde3ffef4696cace3054dafd9` |
| ETH | ERC20 | `0xbc404ef40b46979cde3ffef4696cace3054dafd9` |
| BNB | BEP20 | `0xbc404ef40b46979cde3ffef4696cace3054dafd9` |
| USDC | ERC20 / BEP20 | `0xbc404ef40b46979cde3ffef4696cace3054dafd9` |

> **Important:** Always verify the network before sending cryptocurrency. Sending an asset over an unsupported network can permanently lose the funds.

For the full donation details, see [`SUPPORT.md`](SUPPORT.md).

## Project documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture
- [`docs/COMMANDS.md`](docs/COMMANDS.md) — command/MCP overview
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — connections and mappings
- [`docs/SAFETY.md`](docs/SAFETY.md) — safety model
- [`docs/TEST-MATRIX.md`](docs/TEST-MATRIX.md) — validation and test status
- [`docs/PROTECTION-TESTING.md`](docs/PROTECTION-TESTING.md) — Protection testing roadmap
- [`docs/RELEASE.md`](docs/RELEASE.md) — release process
- [`docs/MARKETPLACE.md`](docs/MARKETPLACE.md) — Marketplace submission notes

## Roadmap

### Current

- Broader real-world Protection testing.
- Expand end-to-end and fault-injection coverage.
- Gather compatibility reports from different cPanel environments.
- Continue recovery and backup testing under interrupted operations.

### Future

- Broader automated integration testing against a mock cPanel API.
- More granular diagnostics and test tooling.
- Additional deployment/recovery improvements driven by community testing.

## License

MIT — see [`LICENSE`](LICENSE).

## Author

**Gabrijel Baban**

Repository: https://github.com/glcvr6/cpanel-hosting-deploy
