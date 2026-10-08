# Safety Model

## Core safety guarantees

The plugin is designed around several principles:

1. **No credentials in the repository.** Connection fields are blank in the distributed plugin.
2. **No silent destructive reconciliation.** Deletion and overwrite decisions require explicit user action under the applicable workflow.
3. **Remote-only content is not automatically removed.** Untracked remote files remain untouched unless explicitly selected.
4. **Conflicts are surfaced.** The plugin does not silently choose local or remote content when both sides diverged.
5. **Partial success is reported.** Successful files can be recorded without pretending failed operations succeeded.
6. **Baseline state matters.** SHA-256 tracking is used to avoid treating every existing remote file as new.

## Destructive categories

Depending on the workflow and Protection settings, destructive actions include:

- delete from hosting;
- delete locally;
- overwrite local;
- overwrite remote;
- force-local / force-remote conflict resolution;
- restore operations that overwrite an existing target.

These actions should be tested only with recoverable data.

## Backups

Protection workflows can create local or remote backups before destructive operations. Backup retention is configurable. Backup failures are treated as safety events rather than silently ignored.

## State, locking, and crash recovery

Persisted JSON state is written atomically using a temporary file followed by replacement. Shared read-modify-write transactions use dedicated file locks. Stale locks can be recovered only when their recorded owner process is no longer alive, and lock cleanup verifies an ownership token before removing a lock.

Corrupt or unreadable persisted state fails closed rather than silently resetting safety decisions. Remote actions that depend on an earlier observation are revalidated immediately before the sensitive operation. Partial-success synchronization advances only the portion of the baseline that actually completed.

A crash can still leave an operation at a recoverable intermediate point—for example, a remote upload may complete before its manifest update. The next planning/status pass is expected to reconcile the observable state. The implementation is designed to avoid silently treating an incomplete transaction as fully successful.

## Testing rule

Use a dedicated non-production cPanel account for Protection testing. Never use customer production data as a test fixture.
