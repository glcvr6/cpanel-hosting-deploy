# Protection Testing Roadmap

## v1.11.0 status

Protection is implemented with three per-connection modes:

- `OFF` — preserves the v1.10.3 core workflow;
- `CUSTOM` — enables selected Protection groups;
- `SECURED` — enables the complete Protection policy.

The code path for `OFF` has been statically compared with the v1.10.3 core implementation and the plugin validator/syntax checks pass. A full matrix of real-world Protection behavior remains the next development phase.

## Priority scenarios

1. Local/remote conflict handling.
2. Backup creation and backup collision naming.
3. Failed transfer retry behavior.
4. Partial-success baseline updates.
5. Resume/start-over recovery after interruption.
6. Workspace and remote locking.
7. Accepted-state behavior.
8. Large-file verification.
9. Destructive-operation confirmation.
10. Backup-retention cleanup failures.
11. Multiple mappings and independent connection queues.
12. Restore operations with existing targets.

## How to help

Use a non-production cPanel account with disposable test files. Run the same scenario in `OFF`, `CUSTOM`, and `SECURED` where applicable.

Report:

- plugin version;
- Cursor/OS version;
- Protection mode and selected rules;
- exact scenario;
- expected result;
- actual result;
- sanitized logs;
- whether the result is reproducible.

Never include API tokens, passwords, cookies, private keys, or customer data.

Community testing is explicitly welcome. The goal is to turn the Protection implementation into a well-tested, independently exercised safety layer before making stronger maturity claims.
