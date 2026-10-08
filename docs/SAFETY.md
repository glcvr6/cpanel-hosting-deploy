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

## Testing rule

Use a dedicated non-production cPanel account for Protection testing. Never use customer production data as a test fixture.
