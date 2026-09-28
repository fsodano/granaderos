# Dialogue-triggered local meetings

A dialogue choice can call another authored world resident to a free square next
to its speaker. Both residents must be present and conscious in the loaded sector.
The destination is chosen from legal routes when the choice is accepted, then
pinned to that place. The order does not teleport the resident or follow a moving
speaker. Bulletin candidates remain off-map until their normal hired arrival.

## Behavior and persistence

The resident uses ordinary cardinal paths, step budgets, usable doors and trap
responses. Arrival holds the resident at the meeting place. Occupancy or a newly
blocked door pauses the route. Danger takes priority; the resident seeks shelter,
then resumes when safe. Incapacity stops movement. Dead residents remain dead.
A later accepted dialogue order replaces the previous destination. Replaying an
already consumed choice cannot issue another order or reinstate an earlier one.

Commands and ordinary dialogue receipts are checked together on save admission.
The active scene and retained scene caches must use the latest command for the
same identity, sector and presence revision. A daily sector relocation ends that
old local order. Service removes the resident from the scene; returning to the
same presence can resume the meeting. Commands do not move people between sectors
or advance an unloaded tactical scene. The campaign permits up to 1000 commands.

Movement can share a choice with a treasury operation and a quest transition.
Acceptance checks run again in the campaign. An unavailable resident or route
rejects the transaction without money, quest or conversation progress.

## Verification

Runtime source: `315de1d578dd8cbc9ae131b45cee02cd45780f58`.
The final complete local suite passed **674/674 tests**, without failures or skips
(193374 ms). Types, production export (721 files, 631 asset references) and all
36 baseline comparisons passed. The register retains 182 requirements and 21
evidence records. [Exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36374790313/job/108778298184)
passed for merged PR #44.

- `tests/dialogue-movements.test.mjs`: actual approach and conversation, deferred
  walking, holding, active save and re-entry, once-only receipts, later commands,
  invalid orders and references, resident death through ordinary melee, and an
  actual daily move followed by travel to the new cell.
- `tests/npc-ai.test.mjs`: prepared house/door layouts check each walked square,
  usable and locked doors, blocked destinations, alarm traps, shelter, resumption
  and incapacity. These are bounded path-policy tests, not a campaign route.
- `tests/story-editor.test.mjs`: mounted authoring, undo/redo, copied effects,
  protected character references and campaign launch.
- `tests/webmcp-campaign.test.mjs`: the mounted conversation issues the order to
  the active sector, displays confirmation, advances actual tactical time and
  preserves the result through its automatic save.

The first complete run passed 673 checks and found one legacy-save failure.
The new movement validation ran before single-squad saves had their scene map
restored. Validation now runs after migration. The full rerun at `ca7236f58550f61d182d5e96f325bfe68cf3f7f8` passed
674/674 checks; no test was removed. A subsequent optimization stops the meeting
availability search once it reaches the nearest eligible destination, instead of
expanding every reachable square for a dialogue quote.

## Limits

MEETING-01 is bounded; STORY-03 and STORY-04 remain partial. This delivery has one
speaker-relative destination and one movement per choice. Authored map markers,
arrival effects, multi-actor sequences, automatic non-dialogue triggers, movement
of historical role actors and a dedicated scene editor remain open. It does not
establish full campaign, live-browser or loaded-battle performance acceptance.

[Arrival-gated dialogue](meeting-arrivals.md) adds a later condition for current
physical arrival. It does not supply automatic arrival callbacks.
