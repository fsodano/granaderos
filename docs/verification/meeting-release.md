# Ending a local meeting

A dialogue movement effect can return a world resident to its ordinary routine.
The speaker can release another resident or end its own commanded meeting. The
resident must be present, conscious and have a current meeting order. A release
without that order is unavailable and cannot pay or advance a quest.

## Behavior

Release records a new command that clears the previous local destination, its
wait and the scene's movement reference. The ordinary civilian routine then
controls the resident. Danger and conversations still apply: release does not
force a frightened or engaged person to walk immediately. A saved release stays
released after re-entry; an older scene cache cannot reinstate its destination.

The choice may combine release, one quest change and one treasury operation.
All three are accepted together. An unavailable condition or missing pesos leaves
the quest, money, command history and conversation unchanged. The editor offers
"Venir a este lugar" and "Retomar su rutina" and preserves the choice through undo,
copy and launch. A person may be its own release target, but cannot call itself.

Each dialogue option still operates once. A later distinct call can issue a new
meeting order. Replaying an already used release cannot cancel that newer order or
repeat its earlier payment. Arrival conditions cease to hold when the meeting is
released, even if the resident is still standing on the former meeting square.
The 1000-command campaign limit includes both calls and releases.

## Verification

Runtime source: `2f1287020a76ce47d5422c28d4361d76a557c8fd`.
The complete local suite passed **689/689 tests**, without failures or skips
(183643 ms). Types, production export (721 files, 631 asset references), all 36
baseline comparisons and the documentation audit passed. The register retains
184 requirements and 23 evidence records. Exact-head [CI](https://github.com/fsodano/granaderos/actions/runs/36376899052/job/108784480770) passed for `889e8ac5c73335442f84b4dd0c11efda82e699ea`.
[PR #46](https://github.com/fsodano/granaderos/pull/46) merged as
`09998ab180fbc029ecb0d582db23ffce122a302b`.

- `tests/meeting-release.test.mjs`: actual call, arrival and release; one atomic
  quest result/payment; subsequent routine movement; saved re-entry; no-order
  rejection; insufficient-funds rollback; a later call and consumed release;
  malformed command/result evidence; and a resident ending its own meeting through
  a real approach and its own conversation.
- `tests/story-editor.test.mjs`: mounted mode selection, self-target selection,
  undo/redo, copy and pinned campaign launch.
- `tests/meeting-release-ui.test.mjs`: mounted call, actual tactical rest and
  arrival, release confirmation, quest result and reward. A double click leaves
  one accepted release and the active autosave preserves both simulation states.
- Existing movement/arrival, NPC, dialogue, quest and save tests remain included.

## Limits

ROUTINE-01 is a bounded delivery. STORY-03 and STORY-04 remain partial. This enables
a dialogue-driven call/arrival/conversation/release sequence for authored residents.
It does not add map markers, automatic arrival actions, multi-actor choreography,
historical role overrides, repeatable dialogue effects or full campaign acceptance.
