# Authored quest states and campaign journal

Authors can create shared quests and connect them to resident dialogue choices.
A quest starts unstarted, becomes active and then completes or fails. Different
residents can participate in the same quest. Terminal states cannot reopen.

## Behavior

The editor supports up to 100 quests with stable identities, titles and objective
text. It provides search, copy, deletion and reference protection. Draft recovery,
undo/redo and package launch use the same authoring path. Existing packages that
omit quests remain compatible.

A choice can require a quest state and can change one quest. It can also charge
or reward pesos in the same atomic choice. Missing funds, a premature completion
or an illegal terminal transition rejects all changes. Conditions can add day,
locality or character requirements. Replaying a consumed choice cannot reopen a
quest or repeat its reward. A copied character can reference the original shared
quest; a copied quest is a separate identity and does not rebind conversations.

Each accepted transition appends its source NPC, passage, choice, prior/new state
and campaign hour to an ordered record. Save admission checks legal transitions,
chronology, graph references and matching dialogue receipts in both directions.
The journal derives status from this history and shows accepted objectives, their
descriptions and start/resolution days. Unstarted quests remain undisclosed.

## Evidence

Runtime source: `9c9e57221af4d725c454ff27b6766cead3f99899`.
The complete local suite passed **645/645 tests**, without failures or skips.
Types, production export and all 36 baseline comparisons passed. The register
retains 179 requirements and 18 evidence records. Exact-head CI is required before
merge.

- `tests/campaign-content.test.mjs`: supported quest data is admitted while
  unimplemented scene/rules settings still reject launch.
- `tests/content-quests.test.mjs`: actual resident acceptance, real campaign time
  opening a completion branch, a saved reward, the alternative failure branch,
  different start/completion residents, atomic rejection, terminal replay and
  rejection of malformed definitions or missing/reordered/inconsistent history.
- `tests/story-editor.test.mjs`: mounted quest authoring, undo/redo, independent
  copy/removal, reference protection and quest-state conditions/effects; campaign
  launch, physical approach and saved acceptance of the authored objective.
- `tests/webmcp-campaign.test.mjs`: mounted conversation accepts and completes a
  quest; normal map controls display the active/completed journal and preserve the
  synchronized save. The test closes conversation before using the map shortcut,
  as required by the existing keyboard rules.

## Limits

QUEST-01 is bounded; STORY-03 remains partial. These transitions are explicitly
chosen through authored dialogue. Automatic failure on death/time, item delivery,
escort or area objectives, role transfer, historical dialogue overrides and
scripted movement remain open. Existing historical errands keep their rules.
There is no claim of a complete campaign, live-browser acceptance or performance
acceptance. Save consistency is not cryptographic anti-cheat protection.
