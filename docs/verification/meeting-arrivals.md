# Arrival-gated dialogue and quest effects

A dialogue choice can require an authored resident to be at its current meeting
place. This checks the actual actor in the active sector and the latest saved
movement order. It does not infer arrival from elapsed time or a queued command.
The same existing choice can then complete a quest or pay a reward once.

## Contract

The resident must be alive, conscious, outside military service, and free of an
immediate danger response. Its position must equal the destination of its latest
local command, with the same identity and presence revision. A scene from another
sector or deployment cannot supply the condition. The active scene is required;
a retained unloaded scene alone is not evidence for a conversation.

An obstacle, unfinished walk, incapacity or danger leaves the option unavailable.
Normal movement and recovery can make it available again. Saved re-entry at the
same destination preserves availability. The campaign checks the condition again
before applying money, quest progress or dialogue changes. The editor protects
referenced residents and retains the condition through undo, copy and launch.

## Evidence

Runtime source: `29c7edad645e9dafe571509c1159996ff5550b77`.
The final complete suite passed **681/681 tests**, without failures or skips.
Types, production export (721 files, 631 asset references), all 36 baseline
comparisons and the documentation audit passed. The register retains 183
requirements and 22 evidence records. Exact-head CI is required before merge.

- `tests/meeting-arrivals.test.mjs`: actual conversation accepts a meeting quest;
  an early completion attempt is rejected without money or progress. Six-second
  tactical steps reach the destination; a saved completion pays once. Re-entry,
  wrong-deployment rejection and invalid definitions are covered. Prepared alarm,
  incapacity and temporary occupancy probes isolate the physical guards; ordinary
  tactical time and movement verify recovery after the alarm/blocker. Those probes
  are not claims of a complete combat or campaign route.
- `tests/story-editor.test.mjs`: mounted condition selection, undo/redo, copy,
  deletion protection without a movement-effect reference, and pinned launch.
- `tests/meeting-arrivals-ui.test.mjs`: mounted conversation hides the completion
  option before arrival, then reveals and executes it after actual tactical rest.
  Its quest result and one reward are preserved by the active automatic save.

Expanded mounted testing prompted an idle-path review. Residents waiting beside
an interlocutor, or pausing their routine, no longer construct unused routes. The
existing path, danger, door and routine tests cover the same movement policies.
The new mounted acceptance has a separate test file using the same shared harness,
so it does not share the earlier sequence of mounted cases. All assertions remain.
Earlier incomplete full runs were stopped after these source/test changes and
superseded by the final full rerun. No completion results are claimed for those
interrupted runs.
This optimization is not a loaded-combat frame-rate measurement.

## Limits

ARRIVAL-01 is bounded. STORY-03 and STORY-04 remain partial. This is a dialogue
condition for current presence at a commanded meeting, not an automatic arrival
callback or a permanent history flag. Marker authoring, automatic actions on
arrival, returning to ambient routines, multiple-actor sequencing, historical
scene roles and complete campaign acceptance remain open.
