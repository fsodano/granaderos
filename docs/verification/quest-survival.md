# Required character survival

An authored quest can require up to six characters to remain alive. Confirmed
death of any required character fails an active quest once. A dead requirement
blocks acceptance; a completed quest keeps its result. Wounds, unconsciousness,
local hiring and dismissal are not deaths.

## Behavior

The quest editor selects existing character identities, prevents duplicates and
retains the list through undo, copy, recovery and launch. A referenced character
cannot be deleted from the package. The runtime uses the same canonical identity
for a world resident and its later military service. Required deployed deaths
are acknowledged at a valid tactical checkpoint, without waiting for settlement;
saved or reported health cannot revive that confirmed casualty.

Failure records the character and confirmation time in the ordered quest history.
Save admission checks the pinned requirement, dead identity and its recorded
death minute, and rejects an active quest whose required death has no failure
record. The campaign journal names the cause. These failures do not issue a
dialogue receipt or reward. If one batched checkpoint reports both an already due
deadline and a death, the earlier recorded deadline resolves the quest once.
A death confirmed before the deadline keeps its failure when that deadline later passes.

## Evidence

Runtime source: `78fc6c4900f960b8307a7ce18b4d594346721b54`.
The complete local suite passed **661/661 tests**, without failures or skips.
Types, production export and all 36 baseline comparisons passed. The register
retains 181 requirements and 20 evidence records. Exact-head CI is required before
merge.

- `tests/quest-survival.test.mjs`: actual approach and civilian melee death,
  once-only saved failure, blocked post-death acceptance, retained completion,
  injury/healing and local service changes. A compact prepared battlefield and
  prepared ownership allow an actual enemy shot to kill a required serving unit;
  active save admission rejects reviving it. This is a death/synchronization check,
  not a claim of a complete attack route. Invalid references/death records and a
  combined deadline/death checkpoint are also covered.
- `tests/death-successors.test.mjs`: existing civilian and military successor
  behavior remains covered after extending deployed-death tracking.
- `tests/story-editor.test.mjs`: mounted survivor selection, undo/redo, copy,
  character deletion protection and launch retain the pinned references.
- `tests/webmcp-campaign.test.mjs`: actual mounted conversation accepts the quest;
  registered movement and melee confirm its required resident death; the journal
  displays the cause and the active autosave preserves the accepted pair.

## Limits

SURVIVAL-01 is bounded; STORY-03 remains partial. This rule checks confirmed death,
not capture, dismissal, absence or escort failure. Item objectives, scripted
movement and historical role overrides remain open. The journal and rules checks
do not establish full campaign, live-browser or performance acceptance.
