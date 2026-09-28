# Dialogue choice conditions

Resident dialogue choices can depend on campaign state. A choice is visible only
when all its conditions hold. The campaign checks the same conditions again when
the player chooses it, so stale or fabricated input cannot use a hidden branch.

## Behavior

Each choice supports up to six conditions: an inclusive campaign-day or treasury
interval, ownership of a named locality, or a character that is alive, dead,
serving, or present in the world. Maximum bounds can be absent. Day 1 starts at
campaign hour 0. Serving requires a living, uncaptured recruited identity. World
presence requires a living, uncaptured identity that has appeared at a cell and
is not in service. Accepted deployed health takes precedence over strategic
health that is awaiting battle settlement.

The editor provides typed controls within each choice, retains conditions through
undo, copy, recovery and launch, and protects referenced characters from deletion.
Package admission rejects unknown fields/types, missing references, reversed
intervals and excessive conditions. Existing graphs without conditions remain
available. Conditions do not change saved passage text or charge resources.

## Evidence

Runtime source: `22629a10c8dbc61fad50308447982d3b2b7b88ff`.
The complete local suite passed **626/626 tests**, without failures or skips.
Types, production export and all 36 baseline comparisons passed. The register
retains 177 requirements and 16 evidence records. [PR #39](https://github.com/fsodano/granaderos/pull/39) merged after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36369928510/job/108763904616) passed.

- `tests/dialogue-conditions.test.mjs`: actual elapsed days open/close a branch;
  a paid armory purchase changes available funds; an actual civilian death opens
  a branch; local hiring changes presence/service; saves retain the rules.
  Locality ownership uses a prepared, save-admitted state. A deployed casualty
  fixture checks health precedence but does not establish an actual combat kill.
  Invalid data and unavailable selections are rejected.
- `tests/story-editor.test.mjs`: mounted controls author day and character
  conditions, protect references, undo/redo, copy and launch; real hiring and
  elapsed campaign time change the authored predicate and survive save admission.
- `tests/webmcp-campaign.test.mjs`: mounted conversation hides a day-gated choice,
  reveals it after actual tactical rests cross midnight, and preserves the
  synchronized campaign/battle autosave.

## Limits

At this checkpoint, CONDITION-01 is a bounded delivery; STORY-03 remains partial. Quest state,
gameplay effects, rewards, effect receipts, historical role bindings and scripted
movement remain open. Ownership conditions address the named campaign localities,
not independently captured rural cells. Placement authoring still supports all
eligible land cells. These checks do not establish full campaign, live-browser or
loaded-combat performance acceptance.

[Dialogue payments and rewards](dialogue-payments.md) extend these choices in the following checkpoint.
