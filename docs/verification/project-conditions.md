# Project conditions in chapters and dialogue

A shared project condition requires foundry organization or army funding to be
completed or still pending. It works in authored chapters, failure conditions and
dialogue choices. Completion reads the actual strategic project state. Hiring an
engineer alone is insufficient. The condition does not require the engineer to
remain in service or the project locality to remain controlled after completion.
Those requirements can be combined through separate character/locality conditions.

Conditions do not execute or pay for a project. Existing paid actions set its
state. Dialogue choices still recheck eligibility and retain their one-time quest
and payment receipts. Chapters keep their ordered completion history and wait for
scene settlement; failure still takes precedence over simultaneous victory.

## Verification

Runtime source: `616af1964f746e9e86799cee31b8048609238fe7`.

- `tests/project-conditions.test.mjs`: actual paid arrival, foundry organization,
  contract expiry and army funding complete ordered chapters and a saved victory
  exactly once. Altered saved definitions are rejected.
- A real exact-cell resident conversation rejects a premature quest reward, then
  accepts it after paid organization/funding. Actual re-entry and dialogue complete
  the quest; victory waits for leaving the scene. Payment does not repeat.
- Invalid keys, missing fields, unknown projects and non-boolean states are rejected.
  A real preparation that simultaneously satisfies failure and a chapter produces
  defeat, without a false chapter completion. Pending states work before either
  project is paid.
- `tests/story-editor.test.mjs`: mounted chapter authoring with project selection,
  pending/completed states and undo/redo, followed by real paid launch and victory.
  Dialogue condition copying and launch retain the same configured rule.
- Seventy-two focused chapter/dialogue/editor checks passed. Three final project
  cases passed after adding explicit rejection of unknown runtime project checks.

Release checks: **779/779 tests**, zero failures or skips (187,555 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (195 requirements, all 50 original and 87 parity rows,
34 evidence records); 116 changed local links. Exact-head GitHub checks are
required before merge.

## Limits

PROJECTS-01 exposes two existing completed steps. It does not author arbitrary
projects, grant project effects from dialogue, create tactical buildings or prove
a complete alternate campaign. Chapter conditions do not replace the original
Cuyo mission gates. Item/escort objectives, other strategic services, factions,
world events and full campaign acceptance remain open. No live browser session or
sustained loaded-combat performance acceptance is claimed.
