# Enemy-turn worker in the browser export

Runtime/test source: `46b512bbb09ed6719c5b81cb0f95921af3e231df`.

The PR #125 export built a worker URL against `file:///ROOT/lib/useEnemyPlayback.ts`.
The worker asset existed, but that constructor was not valid on the HTTP game page.
The hook could therefore calculate the turn on the main thread and cause a pause.
The earlier browser check proved visible playback, not worker execution.

The corrected hook imports the worker as a bundled URL and constructs it from
that HTTP asset. Static export verification now rejects a local file base and
checks that each emitted worker reference names a deployed file. Applying the
new check to the retained PR #125 export rejects its actual client chunk;
the corrected export passes and contains the referenced enemy-turn worker.

The complete regression passes **1244/1244**, with zero failures or skips.
Types and the production export pass: **723 files and 633 asset references**.
[Recorded evidence](../evidence/enemy-worker-export.json) identifies the exact
source, log checksums and before/after export results. The normal production
San Lorenzo controls show `0:enemy-0:prepare:fire`, disable input during playback,
and restore input on turn 2 without console errors. Exact-head CI is required
before merge.

This fixes worker loading. It does not add walking artwork, establish sustained
60 FPS, close large-battle performance acceptance or complete campaign parity.
The more advanced port 3000 checkout remains a separate integration target.
