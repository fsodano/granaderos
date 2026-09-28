# Authored world presence: accepted scope and evidence

This delivery connects placement rules to existing encounter identities in the
campaign. The author chooses any supported land cells, including rural cells and
cells in different regions, inside the character sheet. Fixed placement,
once-at-start random placement and daily movement at 04:00 now determine actual
encounters, conversation and local recruitment. Paid bulletin candidates remain
separate: they never become wandering NPCs and still require controlled, suitable
arrival sites.

Daily movement has an explicit probability, random/alternate destination policy
and loaded-scene guard. Blocked destinations do not trigger repeated random draws.
The campaign saves the independent placement RNG, time, next daily event, location
and revision. Reading the map or correspondence cannot reroll it. Old scenes lose
moved residents; a new sector starts a new local routine. Correspondence exposes a
known fixed location or the last observed location, not a private random draw.

The presence adapter is versioned. Existing authored campaigns without this
adapter retain their original fixed behavior. Edited locations cannot enter
through the old adapter. Preview exports now use version 2 and reject old preview
sessions explicitly; campaign and content-package compatibility remain separate.

## Validation

Local verification ran on source
`e8e98f09fdb786e5a3f241165a9e7af09a26436d`, after integrating the documentation
reorganization. All **549 tests passed, with no failures or skips**; TypeScript
and production export also passed (721 files, 631 asset references). Subsequent
integration of the formal-audit documents changes documentation/tracking only.
The exact-head [GitHub CI run](https://github.com/fsodano/granaderos/actions/runs/36359181764) passed on source
`0a65711272fe4575be6792a8365cd4b94292a217`;
[PR #31](https://github.com/fsodano/granaderos/pull/31) merged as
`2ee9479250ac3887ecbe4230891e04faeba224e4`.

Eleven dedicated presence cases cover real movement to a rural NPC, conversation,
local recruitment, active and campaign saves, reentry, fixed/initial/daily rules,
04:00 loaded-source and destination protection, range guards, no redraw, no stale
scene duplicates, no disclosure through correspondence, contract candidates,
invalid/forged records, old adapters, and an actual hostile-sector deployment
with living enemies and an authored NPC. The mounted story-editor case authors
locations and rules, exercises undo/redo, launches the campaign and enters the
configured encounter. A daily relocation during strategic travel is followed
through the saved actual position, rather than assuming the actor stayed still.

No new browser playthrough was performed for this delivery. These simulation and
mounted-component checks do not establish complete campaign acceptance.

## Remaining limits

Only the existing encounter identities are connected. Their historical
recruitment conditions and special mission casts remain fixed. New world
identities, civilian injury/death/custody, editable NPC inventory and death-triggered
successors are separate work. Unsupported conditions block campaign launch;
preview support does not imply runtime support. See
[STORY-02 and the full register](published-progress.md).

The formal audit remains an immutable earlier snapshot. The active requirement
register carries the newer bounded verification without rewriting its old logs.
