# Historical worktree diagnostics archive

This archive preserves 97 historical QA scripts, patches, review notes and source inputs recovered during the 2026-10-09 worktree cleanup. These files were previously ignored in completed worktrees. They are recovery material. They are not approved runtime code or current acceptance evidence.

All blob files are non-executable and have the `.blob` suffix. Local Git attributes preserve their raw bytes without line-ending conversion or textual patch display. No runtime, build or test entry point loads or executes this archive. The archive is outside the production source digest in `tools/build-identity.mjs`, which reads `package.json`, `game`, `web` and `tools`. It is also outside the source roots in `tools/audit-snapshot.py`.

The [manifest](manifest.json) maps every original worktree and path to an exact Git blob, SHA-256, byte count and archive path. Identical files share one stored blob. The original directory and filename are provenance; they are not restoration destinations. Absolute paths identify the source machine and do not need to exist.

To restore one file:

1. Select its entry in `manifest.json`.
2. Copy the listed `archivePath` to a new, separate review directory. Use the listed `originalPath` as its relative filename.
3. Verify the copied byte count and SHA-256 against the entry. The Git blob ID is SHA-1 of `blob <byte-count>` followed by a NUL byte and the original contents.
4. Review the restored script or patch before any execution or application. Old imports, paths, assumptions and gameplay results can be stale.

Do not copy this material into the game or test directories as part of restoration. Any active use needs a separate reviewed change and current validation. Original bytes are retained without fixing or executing historical scripts.
