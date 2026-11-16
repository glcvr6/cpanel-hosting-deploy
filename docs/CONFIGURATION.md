# Configuration

## Connection fields

A connection consists of:

- connection name;
- cPanel host URL (must be `https:`);
- cPanel username;
- cPanel remote root/home path;
- cPanel API token.

The distributed plugin leaves these fields blank.

In v1, API tokens are encrypted and decrypted with Windows DPAPI. Adding or editing a live token therefore requires Windows. Connection metadata can still be inspected without returning the secret.

## Mappings

Mappings connect a local workspace-relative directory to a remote cPanel directory:

```json
{ "local": "public", "remote": "/home/example/public_html", "enabled": true }
```

Constraints verified in code:

- `local` must be relative to the workspace (no drive letters, UNC roots, or `..` escapes).
- `remote` must stay under the connection `remoteRoot`.
- `enabled: false` keeps the mapping stored but out of status, deploy, sync, and download scope.
- At least one enabled mapping is required for download and workspace-setup flows.

User-selected remote folders are not restricted to a single `public_html` root; the configured cPanel account must simply have access to the selected path. Because arbitrary paths can include system/configuration/mail/log data, select mappings deliberately.

### Enabled vs disabled mappings

Local Status and Remote Status compare only paths that belong to currently enabled mappings. Manifest entries for disabled mappings remain on disk so re-enabling a mapping can resume from prior baseline history, but they are not queried or compared while disabled.

## Exclude patterns

New connections default to excluding:

- `node_modules`
- `.git`
- `.env`
- `logs`

Matching rules:

- A pattern containing `/` matches that relative path and everything beneath it.
- A single path component matches that name anywhere in the relative path.
- Protection backup/report directories and `.zip` files are also ignored.

Tune excludes through connection configuration rather than editing generated `.hosting` state by hand.

## Protection settings

Protection is configured per connection:

- `OFF` — backward-compatible core workflow;
- `CUSTOM` — selected Protection groups;
- `SECURED` — complete Protection policy.

The settings command is `/cpanel-hosting-settings`. Related numeric settings include large-file threshold, retry attempts, report retention, and backup retention.

## Credentials

Never store credentials in this repository. Never paste an API token into an issue, pull request, README, test fixture, or log.

## Related docs

- `docs/TROUBLESHOOTING.md` — common setup and runtime pitfalls
- `docs/SAFETY.md` — destructive-operation and state-safety rules
