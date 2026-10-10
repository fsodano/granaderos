# Closed affected gate evidence, 10 October 2026

This archive contains every regular file from `/tmp/granaderos-current-corrections-affected-2026-10-10T091133583Z`, with the original bytes preserved. The gate ran once and closed with exit 1: nine tests, four passed, five failed, none skipped/cancelled. All original assertions were retained. The before/after source maps are byte-identical and the final receipt records zero source drift. Source freeze was released by the parent only after terminal verification. This archive creation ran no tests, gameplay orders, routes or source changes.

## Recorded failures

- Fresh recovery: finite ammunition refused operative 122 at San Nicolas, four musket-family rounds short. The full passive refusal JSON is retained, including the raw partially progressed campaign and the three accepted preceding ammunition transactions. These are not rolled back or rewritten. Its recorded clock is hour 120, second 1336; accepted transfers are three rounds to operative 112, six more to 112 and six to 122. The checkpoint expressly does not include cache exploration orders.
- Hired coastal opening: the original `freshCoastalRoute` assertion at line 157 failed with `true !== false`. The log records the exact assertion and stack. There is no separate complete coastal tactical result or independent before-action capture for this failure in this gate directory; none was reconstructed.
- Funded Cuyo: the original Cordoba victory assertion returned retreat.
- Ordinary stock ending: the original assertion failed with `paid local care must not replace a living field survivor` during coastal care.
- Established southern opening: San Nicolas returned defeat at turn 13 after 112 actions. The original log includes the terminal unit projection and exact assertion stack. This gate did not capture its complete raw tactical tape.

The funded created coastal route, its surviving-toolkit child case, the witnessed paid toolkit casualty case and the free local opening route passed. These four passes do not make the affected gate green.

## Interpretation and preservation

The parent concluded that the broad useful-prone opening guard is unsupported by route acceptance, and authorized removal of that opening patch/tests from the working candidate. That conclusion and intended removal are parent-reported; this archive does not perform or confirm the removal. The mixed-source affected run alone does not isolate the cause of every failure. It gives the exact failure boundaries that must remain visible when judging subsequent changes.

The pre-removal candidate snapshot is preserved separately in `granaderos-current-corrections-source-reconstruction-20261010.tar.gz`: 3,517,625 bytes, SHA256 `6948820a2eb6793bc9794d6a8843b296a43a437fc296f70113541d7c80145943`. Its existing manifest records 57 paths against base `462abba277a47dafbfed1f60fc4529c8a4721cdc`, verified temporary-index reconstruction, and source snapshot SHA256 `bd08d4d6fdd9b87fcad1b770308f1dcf28c0d1b154e1867521f6b6134ce4af28`, matching this gate. The unchanged companion manifest is included here; the archive is not repacked.

The earlier bounded corrections evidence remains separately preserved in `granaderos-current-corrections-evidence-20261010.tar.gz`: 5,010,091 bytes, SHA256 `a93da7c86c8a0078e9de66ebb3bf32d387868f378e2f91a53c113cf417f2056b`. Its 54/54 focused gate cannot establish the failed affected routes. Both companion archives were checked before and after this archive operation and were unchanged. Original artifact directories were not changed. The current working source may now differ after the parent released the freeze; this archive binds the executed snapshot, not any later working tree.

## Verification and limits

`MANIFEST.json` binds every payload file to its source path, byte count and SHA256, and excludes only its own hash to avoid a cycle. The matching external manifest and verification receipt cover every tar member, including `MANIFEST.json`. Every member was read from the completed tar and compared with its staged bytes and original source bytes. All members are regular files with relative safe paths. No dependency or checkout links are included.

This is portable evidence for inspection. It does not include a complete runnable source/dependency environment or missing tactical/care tapes. Preserved executed wrappers retain their original absolute paths. No full-route victory, final acceptance, JA2 parity, or gameplay completion is claimed. This failed run must not be reported as a green gate.
