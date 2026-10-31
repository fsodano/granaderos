# SaveGame

The player persists the current accepted game snapshot. `SaveGameUseCase` owns
`SaveGameRepository`. It admits a save only when the session identity, revision,
and request identity still match the repository's current state. The repository
serializes and writes the snapshot. A write failure does not roll back accepted
in-memory progress.

The browser adapter holds one exclusive Web Lock for each save key. A second
tab cannot write that key. Missing lock support blocks automatic writes. The
player can continue and download a save file. Closing the owner permits a new
claim; focus, a new accepted snapshot, or an explicit flush retries the claim.

The encoding worker echoes session, revision, and request identities. Workers
never write storage. Stale responses cannot overwrite newer accepted progress.

Verification: `node --test tests/browser-save-writer.test.ts
tests/campaign-autosave-identity.test.ts tests/campaign-autosave-lifecycle.test.ts`.

A changed save request is refused with `DomainRefusalCode.RevisionConflict`. The
browser adapter translates the code and keeps accepted progress available.
