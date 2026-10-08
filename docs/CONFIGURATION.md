# Configuration

## Connection fields

A connection consists of:

- connection name;
- cPanel host URL;
- cPanel username;
- cPanel remote root/home path;
- cPanel API token.

The distributed plugin leaves these fields blank.

## Mappings

Mappings connect a local workspace directory to a remote cPanel directory. User-selected remote folders are not restricted to a single `public_html` root; the configured cPanel account must simply have access to the selected path.

Because arbitrary paths can include system/configuration/mail/log data, users should select mappings deliberately.

## Protection settings

Protection is configured per connection:

- `OFF` — backward-compatible core workflow;
- `CUSTOM` — selected Protection groups;
- `SECURED` — complete Protection policy.

The settings command is `/cpanel-hosting-settings`.

## Credentials

Never store credentials in this repository. Never paste an API token into an issue, pull request, README, test fixture, or log.
