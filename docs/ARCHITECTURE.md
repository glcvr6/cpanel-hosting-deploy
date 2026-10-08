# Architecture

cPanel Hosting Deploy is a Cursor plugin composed of Cursor commands/rules/skills plus a local MCP server.

## Components

```text
Cursor
  |
  +-- commands/        User-facing slash commands
  +-- skills/          Workflow instructions
  +-- rules/           Persistent deployment/safety guidance
  +-- mcp.json         MCP server registration
  |
  `-- server/cpanel-mcp.js
          |
          +-- connection/config state
          +-- cPanel API/Fileman operations
          +-- local manifest and SHA-256 tracking
          +-- local deployment planning
          +-- remote status/synchronization
          `-- Protection policy layer
```

## State model

The plugin maintains a local manifest under `.hosting/manifest.json`. The manifest provides the baseline used to classify tracked files as `UNCHANGED`, `CHANGED`, `NEW`, or `DELETED`.

Remote status additionally distinguishes:

- `REMOTE NEW` — remote file exists, local file is absent;
- `REMOTE CHANGED` — tracked local file differs from the remote baseline/content;
- `REMOTE DELETED` — tracked local file exists but the remote file is gone;
- `REMOTE UNTRACKED` — remote file exists outside the tracked local baseline;
- `CONFLICT` — local and remote both diverged from the shared baseline.

## Persisted state and concurrency

The plugin uses several local state files under the workspace `.hosting` directory. State writes use atomic temporary-file replacement. Read-modify-write transactions that can be touched by concurrent MCP processes are serialized with dedicated locks.

Important protected state includes:

- `connections.json` for shared connection configuration;
- `manifest.json` for local deployment baselines;
- remote baseline metadata;
- Protection accepted-state data;
- operation and state lock files.

Locks record ownership metadata and can recover stale locks when the recorded process is no longer alive. Lock cleanup verifies ownership so a process cannot remove a replacement lock created by another process.

## Remote safety and recovery

Remote status snapshots carry size/mtime metadata through planning. Before sensitive overwrite, restore, delete, or synchronization actions, the live remote state is revalidated against the decision snapshot. A mismatch fails closed instead of silently acting on newer remote content.

Partial synchronization updates the remote baseline only for files that were successfully synchronized. Interrupted operations therefore remain detectable rather than being marked successful prematurely.

## Protection layer

v1.11.0 adds a policy layer around the existing core workflows:

- `OFF` — original v1.10.3 core path;
- `CUSTOM` — selected Protection groups;
- `SECURED` — complete Protection policy.

The Protection layer is intentionally designed so the core deployment engine remains separate from policy decisions.

## Remote operations

The plugin uses cPanel API/Fileman capabilities available to the configured account. Remote deletion uses cPanel's trash operation rather than an irreversible filesystem deletion where the API supports that path.

## Design principle

The system favors explicit user decisions over hidden reconciliation. In particular, remote-only files are not silently deleted, conflicts are not silently resolved, and destructive operations require explicit confirmation according to the active Protection policy.
