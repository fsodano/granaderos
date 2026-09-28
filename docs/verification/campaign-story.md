# Authored campaign chapters and endings

The story editor can replace historical progression with 1–12 ordered chapters,
introductory text and victory/defeat text. Each chapter requires all of 1–6 global
conditions: day, treasury, locality control, character state or quest state.
Optional failure conditions also require all entries; an empty list adds none.
Definitions are pinned in each save. Completed chapter records never reset when
conditions change, and the terminal outcome is recorded once. Surviving recruited characters also use their
authored ending lines once.

Paid arrival must actually enter service before satisfying a service condition.
Quest completion can occur through tactical dialogue, but chapters and victory
wait until the scene is settled. Failure can occur inside a scene and permits
closing it. Headquarters loss, total force loss on tactical return and authored
failure conditions take priority over victory. Quest deadlines are processed
before evaluating a new chapter. Review reproduced an attack that still opened
a battle after the campaign ended during approach; the corrected route cancels
deployment. Defeat during strategic travel preserves the last reached position. A second regression reproduced lost clock time when a
batched tactical checkpoint crossed a quest-driven defeat. Tactical synchronization
now retains every already-consumed second; strategic travel still stops on defeat.

The map, desk and journal display the authored objective and ending. Editor
controls support reordering, removal, undo/redo, original-mode restoration and
reference protection for characters and quests. Authored indexes are separate
from the original historical phase. San Lorenzo/Yatasto mission entry and the
implicit indispensable historical NPC defeat are original-mode behavior.

## Verification

Runtime source: `a2f5123587bb9852ec0fd9d58a9284ef9457be6d`.

- `tests/campaign-story.test.mjs`: schema limits and legacy defaults; actual paid
  arrival, open-scene quest acceptance/completion and victory on return; ordered
  chapters, real contract expiry and one-time retained progress; real quest failure
  and deadline defeat; simultaneous failure precedence; actual melee death of a
  historical contact with and without an authored death requirement; actual
  approach/travel cancellation; rejected missing, reordered, future, inconsistent
  and modified-content saves. A separate prepared compact enemy battle kills a
  serving character without a quest-survival dependency: its campaign death
  condition now resolves at the real tactical checkpoint, before settlement, and
  save admission rejects a forged living actor.
- Headquarters occupation is prepared to isolate defeat precedence. The actual
  dialogue/death route uses the existing controlled open-cell fixture, an authored
  placement and low-health contact. It is not a historical mission victory.
- `tests/story-editor.test.mjs`: mounted creation, condition choice, ordering,
  deletion, invalid-empty-condition rejection, undo/redo, original-mode restoration,
  protected references and launch followed by actual paid arrival and saved victory.
- `tests/campaign-story-render.test.mjs`: actual desk/journal/map components show
  introduction, current objective and both terminal texts; the completed final
  chapter is marked complete and no historical mentor/chapter prompt is shown.
- Focused authoring/runtime/render checks: 53 passed before the clock correction;
  30 focused chapter, deadline and civilian checks passed after it; 20 chapter
  and character-presentation checks passed after connecting ending lines. Another
  26 chapter, survival and successor checks passed after adding deployed death
  confirmation for campaign conditions. Additional headquarters
  and civilian compatibility cases passed. The attack-approach regression was
  reproduced before the fix and passed afterward.

Final release validation: **751/751 tests**, zero failures or skips (188,479 ms);
type check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (191 requirements, all 50 original and 87 parity rows,
30 evidence records); 107 changed local links. Exact-head GitHub checks are
required before merge.

Accepted in [PR #53](https://github.com/fsodano/granaderos/pull/53) at
`5f8c892a3ccb8b0d091ec4799510dc7bff19d2b4`, with
[successful exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36385619850/job/108810257020).
Merged into `main` as `1a5352be5ca9982e9a985bd6e7ff214c02733353`.

## Limits

CHAPTERS-01 is bounded. These short routes establish the chapter contract, not a
second full independent campaign. At this checkpoint historical identities could
not be removed; the subsequent [cast delivery](campaign-cast.md) permits removal
and independent profile copies. Recruitment and economic roles, factions, calendar incursions, contacts and map
composition retain existing behavior. Branching chapter graphs, authored tactical
missions/markers, automatic scene effects and complete campaign balance remain
open. Conditions on movement arrival must resolve a quest through dialogue first.
Bouchard and San Martín retain original mission/chapter recruitment gates; those
roles cannot join in authored progression at this checkpoint. Use independent
authored residents for a custom campaign cast until role composition is available.
No full historical route, live browser session or sustained loaded-combat
performance acceptance is claimed.
