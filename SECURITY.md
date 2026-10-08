# Security Policy

## Scope

cPanel Hosting Deploy handles credentials and can perform file operations against cPanel accounts. Security issues are therefore treated seriously.

## Reporting a vulnerability

Please do **not** disclose a suspected vulnerability publicly before a fix or coordinated disclosure has been discussed.

Use GitHub's private vulnerability reporting/security advisory workflow for this repository when available. If private reporting is not available, contact the maintainer through the contact method shown on the GitHub profile and request a private channel. Do not include API tokens or other secrets in the initial report.

A useful report includes:

- affected version;
- affected command or MCP tool;
- concise reproduction steps;
- security impact;
- sanitized logs or screenshots;
- proposed mitigation, if known.

## Credential safety

Never commit:

- cPanel API tokens;
- passwords;
- cookies or session tokens;
- private keys;
- production configuration containing secrets;
- customer data.

Connection variables are intentionally blank in the distributed plugin. API tokens are handled by the plugin's local credential mechanism and must never be copied into issues, pull requests, documentation, or test fixtures.

## Safe testing

Use a dedicated non-production cPanel account and disposable files when testing deployment or synchronization behavior. Destructive tests should be performed only on data that can safely be recreated.

## Supply-chain hygiene

Keep GitHub security features enabled where available, including Dependabot alerts/security updates, secret scanning/push protection, and code scanning. See `.github/dependabot.yml` and `.github/workflows/ci.yml` for repository-side automation.
