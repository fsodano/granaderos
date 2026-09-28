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

Runtime source: `8b8ea9abbbe799d0641e1ffd72109b97cc275ea1`.

- `tests/campaign-story.test.mjs`: schema limits and legacy defaults; actual paid
  arrival, open-scene quest acceptance/completion and victory on return; ordered
  chapters, real contract expiry and one-time retained progress; real quest failure
  and deadline defeat; simultaneous failure precedence; actual melee death of a
  historical contact with and without an authored death requirement; actual
  approach/travel cancellation; rejected missing, reordered, future, inconsistent
  and modified-content saves.
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
  and character-presentation checks passed after connecting ending lines. Additional headquarters
  and civilian compatibility cases passed. The attack-approach regression was
  reproduced before the fix and passed afterward.

Final release validation: **750/750 tests**, zero failures or skips (188,900 ms);
type check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (191 requirements, all 50 original and 87 parity rows,
30 evidence records); 107 changed local links. Exact-head GitHub checks are
required before merge.

## Limits

CHAPTERS-01 is bounded. These short routes establish the chapter contract, not a
second full independent campaign. Historical identities still cannot be removed;
recruitment and economic roles, factions, calendar incursions, contacts and map
composition retain existing behavior. Branching chapter graphs, authored tactical
missions/markers, automatic scene effects and complete campaign balance remain
open. Conditions on movement arrival must resolve a quest through dialogue first.
Bouchard and San Martín retain original mission/chapter recruitment gates; those
roles cannot join in authored progression at this checkpoint. Use independent
authored residents for a custom campaign cast until role composition is available.
No full historical route, live browser session or sustained loaded-combat
performance acceptance is claimed.
