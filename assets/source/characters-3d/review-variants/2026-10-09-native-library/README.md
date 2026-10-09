# Native character review source archive

This archive preserves all unique source, art, test and receipt blobs from the
four local human-library checkpoint branches, including available temporary
pilot source/art referenced by their review receipts and the final dirty collar
and Worker skin source saved in `d100b46e`. It also preserves unique authored
files from the ignored character review directory. These are review variants.
The game does not load this directory. No production model, animation bank,
clothing asset, gameplay rule or test limit is replaced by this archive.

## Inventory

- `manifest.json`: 1,788 unique blobs, exact Git and SHA-256 hashes, original
  paths, source commits, source branches and review status.
- `private-files.json`: 2,158 selected private paths, including duplicate aliases
  and content already preserved in main history.
- `external-files.json`: 18,724 available temporary and worktree source/art paths, receipt
  references and exact identities. Where a study recorded no Git branch, that
  missing provenance is stated explicitly.
- `worktree-source-overlaps.json`: all-worktree ignored authored-source audit,
  exact checkout provenance, and content already reachable from integration.
- `blobs/`: exact bytes, deduplicated by their Git blob identity.
- `squash-overlaps.json`: exact complete patch-id matches for 23 local source
  branches and their existing main squash commits.
- `branch-overlaps.json`: compared paths and the original branch tips.

The archive has 1,408,613,954 logical bytes. Of these, 895,190,119 bytes are
already stored in local human-branch Git objects; the new archive paths reuse
those objects. The 630 unique private blobs total 183,689,175 bytes. The largest
individual blob is 18,626,420 bytes. The external supplement adds 480 unique
source/art/receipt blobs totaling 312,533,121 bytes. No dependency or generated
distribution code is included. The final all-worktree supplement preserves 109
unique QA/pilot script, patch and source-model blobs totaling 17,201,539 bytes.
Its 963 path receipts distinguish committed overlap from previously ignored
authorship. The early primary-worktree human Blender/GLB study stays inactive;
none of these older assets replace the current library.

The original `artifacts/character-anatomy-review/` remains intact. Its repeated
rendered evidence files are not copied into production source. Dependency and
cache files are excluded. Render pages and receipt paths retain their original
names and may refer to that original local evidence directory.

## Review status

`rejected-study-preserved` identifies explicitly rejected visual/contact trials.
They include sleeve construction, coat ease and cloth/material experiments.
Their original rejection notes and source patches are exact. They are retained
for further correction and are not enabled in the game.

`historical-review-variant-not-enabled` covers competing complete body/motion
libraries, older checkpoint assets and diagnostics. A passing private check does
not authorize replacing newer main geometry, clothing, supported movement or
native contact corrections.

`bounded-private-review-requires-current-main-recomposition` covers the older
collar rim and Worker surface study. Main already uses the exact generated
Worker face material and neutral eyebrow beds through its accepted face source.
All seven dirty-body donor hashes match main's reviewed-face source manifest.
The collar part of those donor bodies was deliberately excluded from face
extraction; main uses its later collar-seam repair at all three LODs. The old
rim source remains a separate review variant.

Each JSON receipt may also retain `originalReviewMetadata`. It records the
original study decision, not a new claim of runtime acceptance.

## Verify and recover

Run `python3 verify.py` from this directory to verify every archived blob and
private or external alias. Run `python3 restore_review.py --prefix
artifacts/character-anatomy-review/delivery/coat-sleeve-rejected --destination
/tmp/granaderos-coat-sleeve-review` to recover one private study. Recovery writes
only outside this checkout and does not execute archived source. Use
`--external-prefix /tmp/granadero-stubble-pilot/delivery` instead of `--prefix`
to recover a recorded temporary study.

Original committed snapshots are also recoverable with `git archive` and the
exact source tips in `manifest.json`. Keep their ancestry when integrating the
archive. Selective current-main integration must retain the accepted runtime
library, its current body/motion/cloth records and source contracts.
