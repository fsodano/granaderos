# JA2 gameplay: live verification record

This record covers the live checks completed on 6 September 2026 and reported by the primary gameplay agent. It separates observed browser behavior from automated coverage. The observations below were not repeated by the agent that wrote this record. The equipment section below was added by the primary agent after later live checks.

## Exploration movement

In Retiro, Shift-click selected soldiers 1000 and 110. Clicking E4 moved the group to the corrected formation destinations: (3,4) and (3,5). This checks the ordinary mouse click after the group-hover fix.

Alt-clicking D4 moved only soldier 1000 to (3,3), while retaining east-facing orientation. Soldier 115 did not move. This checks the individual preserve-facing input and its resulting state. It does not establish every posture, diagonal, interruption or sprite-animation transition.

## Physical exit and reload

The south-exit control was disabled before the selected soldier reached the boundary. Soldier 1000 then crossed that boundary. The departure receipt recorded 60 elapsed seconds and survived reload. Soldiers 110 and 115 crossed afterward. Returning to the campaign placed the same three soldiers in Buenos Aires.

This checks boundary admission, partial departure, saved receipts and the final campaign return. Enemy counterfire at an exit, automatic rout, surrender, casualty transport and following a departed subgroup during an unfinished encounter were not checked live.

## Medical item and campaign return

The medical check used an actual seed-8 victory on the earlier compact San Nicolás map. Funes (115) took 10 of Aguirre's (107) 21 dressings, equipped **Vendas** for 4 AP, treated Aguirre through the portrait target, then treated himself. Two dressings were consumed. Neither treatment increased HP:

| Soldier | Final HP | Bleeding | Dressings |
| --- | ---: | ---: | ---: |
| Aguirre, 107 | 1 | 0 | 11 |
| Funes, 115 | 55 | 0 | 8 |

The new return control was then used from active exploration in the cleared sector. The campaign returned to San Nicolás with patriot ownership, no pending deployment and no open tactical battle. Residents 110, 114, 115 and 107 remained in the squad.

This checks partial item pickup, finite medical use, portrait targeting, preservation of critical HP and the post-care report control. It does not verify the automatic-bandage planner live.

## Item controls and information projection

A quick skirmish displayed the concise held-item strip without separate Charge or Heal commands. Together with the medical check, this verifies part of the item-driven interaction model. Tools, thrown explosives and the full range of held supplies still need live checks.

The player-known state projection worked for live state reads and successful action responses. Hidden-enemy sight loss, hearing-only contacts, hidden loot and exclusion of private enemy state were covered by pure tests, not demonstrated through live hidden-enemy scenarios. A working state read does not prove every information boundary.

A later read-only desk check found six historical recruits but only one living person (114). The summary incorrectly showed six in service. After the count fix, the same browser state showed **1 granadero en servicio**, with unchanged treasury and campaign day. Dead and captured records no longer contribute to desk or recruitment summary totals. Temporary component-render checks retain historical casualty cards and deployed soldiers whose contract departure awaits a battle report.

## Removable bayonet and workshop stock

A fresh seed-19 workshop campaign hired Acosta and Funes through paid ordinary orders. In the live UI, the matched India socket bayonet cost 50 pesos (treasury 2697→2647). It was issued to Acosta's secondary slot. After entering Retiro, **Fijar al Brown Bess** moved it onto his held musket. The operation took one exploration second, preserved the loaded round and both 100% conditions, and kept carried weight at 8.6 kg.

**Retirar a mochila** moved that same item into the pack. The ordinary transfer control gave it to Funes. His Baker rifle correctly showed a disabled fitting control with an incompatible-host reason. Funes returned it to Acosta, who refitted it. Reload retained the assembly, empty packs, loaded rounds and the exact five elapsed seconds. **Volver a la campaña** retained the fitted gun in Retiro, with no phantom secondary bayonet.

The medical purchase UI showed 40/40 workshop kits. Buying five for Acosta reduced shop stock to 35, increased his carried kits from two to seven, and charged 150 pesos (2647→2497). Timed restocking, depleted stock and the remaining one-to-four kit purchase are covered by automated tests; they were not advanced through the live clock in this check.

A second fixture reached an actual authored San Nicolás position through legal campaign purchases, import delivery, fitting and movement. Actor 1000 at (15,8) had 16 AP and a loaded fitted Brown Bess. Clicking the occupied enemy tile at (17,8) performed a thrust: enemy health 100→50, actor AP 16→0, fitting condition 100→99. Gun condition stayed 100%; loaded/spare ammunition stayed 1/9. The fixture did not edit actor attributes, equipment quantities, map cells or the battle result. Figure-button targeting exposed a separate SVG hit-area defect: the outer group's bounds included the full clipped sprite atlas. Moving focus and input handlers to the existing fixed body ellipse corrected it without changing the art. Reimporting the same starting position and clicking the actual visible figure produced the exact thrust result above. A separate fresh import used F then the same figure button: actor AP 16→4, loaded rounds 1→0, firearm condition 100→99, fitting condition stayed 100%, and enemy health fell to 53. This verifies the deliberate close-shot alternative through live input.

Temporary replay evidence is in `/tmp/granaderos-live-fitting-thrust/prepare.mjs`, `ready-to-thrust.json` and `expected-thrust.json`. The workshop fixture is `/var/folders/k2/r1ywdpdx5x513g1qp4m7m3340000gn/T/granaderos-ui-i06-yBcLW0/workshop.json`. These temporary files are not committed fixtures.

## Assignment stop, reload and continuation

A separate browser origin used a fresh seed-19 campaign created through paid officer creation, ordinary travel from Retiro to Buenos Aires and a Rest assignment. At hour 12 the officer had fatigue 8, health 78, energy 100 and morale 80. Selecting **1 día** and pressing **Avanzar** stopped at hour 13. The visible notice reported **1 de 24 horas solicitadas**, named the officer and Rest assignment, and explained deliberate continuation. The public state read confirmed fatigue 0 with health, energy, morale and assignment unchanged.

Reload and **Continuar campaña** retained the hour-13 notice. Selecting **6 horas** and pressing **Avanzar** moved to hour 19, cleared the notice and retained the same personnel state. The earlier 23 unused hours did not run automatically. The notice layout was visually checked at the ordinary desktop viewport. Medical, repair, skill, militia and blocked-assignment stops remain automated evidence rather than separate live scenarios.

The development server initially retained a failed resolution from when a new imported module did not yet exist. Restarting that local server resolved it; the completed stop/reload/continue sequence produced no subsequent console warnings or errors. Temporary preparation orders and expected state are in `/tmp/granaderos-a07-live/`. No troop statistics were edited for the live check.

## Current assignment-control checkpoint

The final logic run passed **875/875 tests**, excluding only the unchanged illustration-packing test file. Type checking, the production build and the diff check passed. Static export verified **607 files and 518 asset references**. The prior full 841-test run below already included those six packing tests; it must not be combined into a new full-suite count.

Current temporary logs: `/tmp/granaderos-a07-final-tests.log`, `/tmp/granaderos-a07-final-typecheck.log`, `/tmp/granaderos-a07-final-build.log` and `/tmp/granaderos-a07-opening.log`.

## Validated held-item checkpoint

Before the assignment-wait increment, the integrated run passed **841/841 tests**, including all six illustration-packing tests, with no skipped tests. It includes held-item admission, compatible bayonet ownership, mission-ally reports, expanded tactical sectors and civilian routines. Type checking and the production build passed; static export verified **607 files and 518 asset references**. These tests do not replace the live checks listed above or verify later code changes.

The expanded-map opening replay uses the original seed 8 and legal paid orders. It wins San Nicolás in 12 turns with 131 orders, and San Lorenzo in six turns with 68 orders. Aguirre (107) and Soria (123) die in the first battle; Funes (115) and the paid replacement medic Lagos (116) die in the second. All four deaths persist through campaign reports and synchronized saves. The survivors after the first battle have no wounds, so that replay does not demonstrate post-battle medical treatment. Finite corpse pickup and nearby transfer provide the replacement medic's supplies without a local medical shop or free refill.

Eleven new admission tests verify that direct `heal`, `ration`, `throwTorch` and `boleadoras` orders cannot skip equipping the corresponding item. They retain separate paid selection/use actions, exploration wounds during selection, knocked-down constraints, and a real enemy-phase interruption with JSON continuation. HUD previews share those same checks. This new alias-admission boundary has automated coverage; it was not retested through live direct API calls.

Current logs: `/tmp/granaderos-held-final-tests.log`, `/tmp/granaderos-held-final-typecheck.log`, `/tmp/granaderos-held-final-build.log` and `/tmp/granaderos-opening-held.log`. They are temporary evidence files, not repository fixtures.

The small personnel-summary fix followed that full run. Its actual component renders, type check and rebuilt production UI passed separately; the corrected desk count was also observed live above.

## Prior automated checkpoint

At the T09 checkpoint, the logic run passed **727/727 tests**, excluding only the six illustration-packing tests. Type checking and the production build passed. Static export verified **607 files and 518 asset references**. The diff check passed. This predates the later bayonet, held-item admission, NPC and expanded-map changes.

The inspected logs are `/tmp/granaderos-gameplay-current-tests.log`, `/tmp/granaderos-gameplay-current-typecheck.log`, `/tmp/granaderos-gameplay-current-build.log` and `/tmp/granaderos-gameplay-current-diff-check.log`. These are temporary evidence files, not repository fixtures.

A prior full run passed 730 tests including all six packing tests, before the latest group-hover and post-care return fixes. Its different count must not be presented as the current full-suite result.

## Still unverified live

- First-contact transitions and interactive or nested interruptions.
- Enemy reactions and counterfire during physical departure.
- Contextual tool, lock, trap and explosive controls.
- Hidden-enemy information-projection cases.
- The full set of moving, prone, wounded and interrupted sprite animations.
- The full five-phase campaign through actual tactical combat.

The [parity audit](ja2-parity-audit.md) retains these limits for each affected requirement. Passing tests and the successful browser flows above do not complete unrelated rows.


## Carried equipment repair checkpoint

Controlled imported legacy fixture on `http://127.0.0.1:3010/`, separate from a normal player save. The fixture supplies known wear; this is a repair UI check, not a claim that the wear was earned in a played campaign.

- Purchased 100 toolkit points for Paroissien for 120 pesos, selected Dorrego, and chose the new carried-equipment repair scope through normal UI controls.
- The visible order was loose secondary bayonet 99%, Brown Bess 98%, fitted bayonet 98%, and pliers 97%.
- Advancing one day stopped at hour 2 with all four conditions at 100%, 92 toolkit points left, energy 94 and fatigue 4. The notice reported two of 24 requested hours.
- Reload and Continue retained the owner, scope, conditions, tools and completion notice. A deliberate six-hour advance reached hour 8 with no notice, further tool charge or worker energy charge.
- Browser warning/error log was empty. The personnel layout was inspected at the normal desktop viewport.
- Current automated checkpoint: **890/890 logic tests passed**, excluding only the unchanged illustrated-sprite packing suite. Typecheck and production build passed; static output verified 607 files and 518 asset references. Do not combine this with older packing counts as a single full-suite run.

See [carried equipment repair](equipment-repair.md) for implementation boundaries. This does not establish complete JA2 parity.


## Projectile cover checkpoint

Controlled imported tactical fixture on `http://127.0.0.1:3010/`, with Dorrego at D3, a visible enemy at D9, and barrel props at D6–D8. This tests cover behavior, not a naturally played encounter or historically measured ballistic properties.

- Normal head/leg controls and keyboard focus showed a clear 75% head shot and a 0% leg shot, with a charge-consumption warning only for the blocked path. Four aim increments changed the displayed cost to 36 AP while the leg impact chance remained zero.
- Normal target activation fired the blocked leg shot: 97→61 AP, loaded 1→0, condition 100→99, reserve cartridges still eight, target HP still 100. The journal reported that cover stopped the shot.
- Reload and Continue retained the three props and all costs. Paid reload cost 45 AP and one reserve cartridge. The subsequent clear head shot cost 12 AP, dealt 79 damage, left four AP and seven reserve cartridges, and reduced condition to 98.
- The warning fit the normal narrow desktop viewport. Browser warning/error output was empty.

See [projectile cover](projectile-cover.md) for simulation tests and remaining scope. This is a verified increment toward JA2 parity, not full parity.

Final automated cover checkpoint: **904/904 logic tests passed**, excluding only the unchanged illustrated-sprite packing suite. Typecheck, production build and whitespace validation passed. Static output verified 607 files and 518 asset references.

## Enemy body-region selection checkpoint

This supersedes the earlier opening-battle outcomes and automated counts above. It does not erase those historical checkpoints.

The controlled imported fixture on `http://127.0.0.1:3010/` placed Dorrego at D3, an enemy with one prepared Brown Bess charge at D9, and barrels at D6–D8. The other two soldiers stood behind a wall. Equipment, geometry and the enemy's initial AP were fixture inputs, not earned campaign progress. The normal player save on the localhost origin was not used.

- **Fin del turno** ran the enemy's ordinary decision. The combat journal identified a head hit for 92 damage. Dorrego's 84 HP fell to zero, his AP became zero, and his own loaded charge and eight reserve cartridges stayed intact.
- The shot opened a player interrupt for Cabral and Paroissien. Their remaining AP were 97 and 93; elapsed tactical time was six seconds.
- Opening the origin in a fresh tab and choosing **Continuar campaña** restored turn one, the same interrupt participants and budgets, Dorrego's death, and the six-second clock. Enemy charge and condition were no longer public after the sole observer died; their costs are established by model tests, not this live read.
- Keyboard activation expanded the journal and exposed the head-hit entry. An initial pointer attempt exposed a clipping fault: the journal was outside its scrolling HUD parent and input reached the map. The journal now sits beside the clipped strip in a common positioned wrapper, in both ordinary and inventory views. After the fix, pointer input opened and closed it, keyboard input reopened it, and the public battle state was identical. The resulting journal was inspected at the live 1280×720 desktop viewport. A separate narrow-viewport retest remains pending.
- Both browser warning/error logs were empty.

Eight new targeting tests cover the shared shot-option batch, body selection, penetration loss, information limits, actual enemy turns and critical reactions. The final logic run passed **912/912**, excluding only the unchanged illustrated-sprite packing suite. Type checking, production build and whitespace validation passed; the static output retained 607 files and 518 asset references.

The current legal seed-8 opening wins San Nicolás in 12 turns/132 orders and San Lorenzo in nine turns/129 orders. Four real deaths persist; the first battle also leaves a critical nine-HP survivor who uses the existing finite recovery workflow. See [AI shot selection](ai-shot-selection.md) for scoring, test boundaries and remaining AI work. This remains a partial JA2-parity checkpoint.

The journal layout fix followed the 912-test run. Its 29 existing UI/render tests, type check, rebuilt production export and whitespace check passed separately. These are not an additional 29 distinct tests added to the full-suite count.

## Conscious weapon-grab checkpoint

An imported controlled fixture on `http://127.0.0.1:3010/` placed empty-handed Dorrego next to a conscious enemy. Dorrego began with 97 AP and a holstered loaded pistol at 81% condition. The enemy held a loaded Brown Bess at 67% condition with a failed ignition. Its initial AP were zero to isolate the transfer from retaliation. This is a UI fixture, not earned campaign equipment or a naturally played encounter.

- Selecting Dorrego, choosing the existing **Recoger equipo** cursor and focusing the enemy showed **Quitar arma · 97 PA · 0 PA restantes**. The warning stated that failure also consumes the remaining AP. The shared pickup cursor did not display the misleading fixed corpse-loot cost while hands were empty.
- Normal target activation succeeded. Dorrego had zero AP and 92 energy. His primary hand held the loaded, jammed Brown Bess at 67%; his pack held the old pistol at 81% with its loaded round. His eight reserve cartridges were unchanged. The journal warned that the enemy could still fight.
- Opening a fresh tab and choosing **Continuar campaña** restored the exact public soldier record and six-second tactical clock.
- Reimporting the original fixture, returning to the ordinary cursor and using **Ctrl-Enter** on the enemy produced the same soldier record and clock. Ctrl-pointer input is covered by the common modifier resolver but was not separately exercised live.
- Browser warning/error output was empty. Live failed grabs, full packs and post-grab enemy retaliation remain model-test evidence.

The final automated checkpoint passed **925/925 logic tests**, excluding only the unchanged illustrated-sprite packing suite. The 13 new weapon-stealing cases are included in that total. Typecheck, production build and whitespace validation passed; static output verified 607 files and 518 asset references. Evidence logs are `/tmp/granaderos-stealing-final-logic.log`, `/tmp/granaderos-stealing-final-types.log` and `/tmp/granaderos-stealing-final-build.log`.

See [weapon stealing](weapon-stealing.md) for explicit costs, chance tuning, equipment conservation and remaining AI scope. This does not establish full JA2 parity.

## Militia combat promotion checkpoint

Controlled imported fixture on `http://127.0.0.1:3010/`. The militia soldier began at the middle rank, with three fixture-supplied prior combat points, 53/75 HP, a loaded Brown Bess at 100% condition and five reserve cartridges. The declared adjacent enemy had 30 HP and zero initial AP. These inputs isolate promotion and custody; they are not a claim about a naturally played defense.

- The normal selected-soldier HUD showed **Montoneras · 3 puntos de combate** and 85 AP. Selecting a head shot with four aim increments and activating the target spent 36 AP and killed the actual opponent.
- The resulting soldier had six combat points, 49 AP, 53/75 HP, an unloaded gun at 99% condition and the same five reserve cartridges. The tactical rank stayed unchanged until the battle report returned.
- **Volver a la campaña** accepted the actual result. The map showed three total defenders: two middle-rank militia and one veteran. The new rank-count labels use category/value text, including **Veteranos: 1**.
- **Entrar al sector** returned the same soldier ID 20000 as **Veterano Miliciano de prueba**, rank two, six points, 53/75 HP, unloaded gun, five cartridges and 99% condition. Leadership rose to 50 and experience level to five. No new weapon, healing or ammunition was granted.
- A fresh tab and **Continuar campaña** restored the exact public veteran record. The notebook's received dispatches contained the combat-promotion message. A later small correction places new promotion messages at the front of the bounded campaign journal, consistent with other messages; a regression assertion verifies its order.
- Browser warning/error output was empty. Formal training custody, interruption, cancellation, full-garrison controls and legacy-course recovery have model/component coverage; they were not all exercised live in this check.

See [militia combat experience](militia-combat-experience.md) for point thresholds, attribute gains, finite trainee records and remaining autonomous-militia scope.

The final automated checkpoint passed **938/938 logic tests**, excluding only the unchanged illustrated-sprite packing suite. The 11 new militia-experience tests and two new training-control render tests are included in that total. Typecheck and production build passed; static output verified 607 files and 518 asset references. Evidence logs are `/tmp/granaderos-militia-final-logic.log`, `/tmp/granaderos-militia-final-types.log` and `/tmp/granaderos-militia-final-build.log`. This remains a partial JA2-parity checkpoint.

## Enemy field aid and spare-weapon checkpoint

Controlled imported fixtures on `http://127.0.0.1:3010/`. A declared enemy held an unloaded musket with failed ignition, no priming powder or reserve cartridges, and a prepared identified duel pistol in its pack. It received 14 fixture AP. A second enemy had two dressings, medical skill 60 and 33 AP beside an unconscious ten-HP ally bleeding three HP per round. Player AP began at zero to isolate the ordinary enemy turn. These are explicit fixture inputs, not campaign-earned equipment or combat results.

- **Fin del turno** ran the actual enemy decisions. The visible critical patient remained alive and unconscious at ten HP. The expanded journal reported that **Practicante realista** treated **Realista herido**, stopped the bleeding and then prepared its Brown Bess.
- The same turn wounded Cabral from 96 to 32 HP: 60 head damage plus four HP of round-end bleeding. The battle returned to player turn two with six elapsed seconds.
- A fresh tab and **Continuar campaña** restored the exact public unit records, including Cabral at 32 HP and the patient unconscious at ten HP. The treatment message remained visible. Enemy AP, pack identity and dressing counts are private to the simulation; their exact costs are established by the reducer tests, not this public read.
- A second import isolated the pistol carrier so the expanded journal's five-entry limit did not hide its equipment message. The normal end-turn control produced **equipa Pistola de Duelo de Oficial y guarda el arma desplazada**, followed by the actual 60-damage head shot. The visible outcome again showed Cabral at 32 HP and the six-second clock. This second fixture's separate reload was not repeated.
- Both browser warning/error logs were empty. Live rescue movement, nested interruptions and fitting remain model-test evidence.

The final automated checkpoint passed **956/956 logic tests**, excluding only the unchanged illustrated-sprite packing suite. Eighteen new care/equipment tests are included. Typecheck, production build and whitespace validation passed; static output verified 607 files and 518 asset references. Logs are `/tmp/granaderos-ai-equipment-final-logic.log`, `/tmp/granaderos-ai-equipment-types.log` and `/tmp/granaderos-ai-equipment-build.log`.

The actual seed-8 opening now wins San Nicolás in 11 turns/131 orders and San Lorenzo in seven turns/97 orders. Four deaths persist. A newly reached failed-ignition state exposed an illegal fire choice in the playthrough driver; its fire/reload choices now exclude jammed guns. The production ignition rule was preserved. These results supersede the earlier opening outcomes, but do not establish a complete campaign. See [AI field equipment](ai-field-equipment.md) for the decision policy and remaining scope.


## Contextual approach and treatment checkpoint

A controlled imported legacy campaign fixture on `http://127.0.0.1:3010/` placed Paroissien at (2,2), with 60 AP and two dressings, and Cabral at (6,2), with 50 HP and bleeding four HP per round. A declared enemy remained behind a wall. These positions, wounds, supplies and AP were fixture inputs. The normal localhost player save was not used.

- Selecting **Vendas · 2** through the actual item strip spent 4 AP, leaving 56.
- Focusing Cabral's visible figure showed **Acercarse y vendar · 42 PA · 14 PA restantes**, with 24 movement AP and 18 treatment AP.
- One Enter activation moved Paroissien three tiles to (5,2), left 14 AP and one dressing, and stopped Cabral's bleeding. Cabral remained at 50 HP with 46 bandaged wound points.
- The expanded journal showed item selection, three-tile movement and treatment. The battle clock remained at six seconds. The actual 594×924 viewport showed the map, HUD and two-line medical help.
- A fresh tab and **Continuar campaña →** restored the exact public unit records and six-second clock. Browser warning/error logs were empty.
- Melee approach and interruption during approach have simulation coverage; this live check exercised medical targeting and persistence only.

The final regression run passed **969/969 tests**, excluding only the unchanged illustrated-sprite packing suite. This includes thirteen approach tests. Typecheck, production build and whitespace validation passed. Static export verified 607 files and 518 asset references. Logs are `/tmp/granaderos-approach-final-logic.log`, `/tmp/granaderos-approach-final-types.log` and `/tmp/granaderos-approach-final-build.log`. The legal opening campaign outcome remains 11 turns/131 orders and seven turns/97 orders, with four persistent deaths.

See [approach and use](item-approach.md) for the shared route/cost contract and stop conditions. The broader [parity audit](ja2-parity-audit.md) still contains partial and missing requirements.


## Door, container and tool approach checkpoint

Controlled imported fixtures on `http://127.0.0.1:3010/` retained an actual pending legacy campaign battle but declared the test positions, 100 AP, chest contents, lock and alarm. They do not establish that the equipment was earned in a played campaign, or that the authored Yatasto/Mendoza cache routes were exercised. The normal localhost player save was not used. Fixture files are `/tmp/granaderos-environment-approach-live/before.json` and `trap.json`.

- One keyboard activation of the chest at C6/(5,2) moved Cabral from (2,2) to (4,2) and opened it for 20 AP: 16 movement plus 4 use. The nearby panel revealed its only key at 73% condition.
- **Recoger · 8 PA** took that exact key and left the chest empty. Selecting it in **Equipar herramienta** immediately spent the 4 AP hand-change cost; no second equip command was required. Cabral had 68 AP.
- Keyboard focus on the door at C9/(8,2) then showed **Acercarse y usar llave · 100% de éxito · 36 PA · 32 PA restantes**. The split was 32 movement plus 4 use. One Enter activation walked around the blocking chest to (7,3) and unlocked the door. It stayed closed. A second activation opened it for 4 AP, leaving 28 AP. The key retained its single count and 73% condition.
- A fresh tab and **Continuar campaña →** restored exactly the same public units and environment: retained key, empty chest and open door, with six elapsed seconds.
- The separate alarm fixture began with an undiscovered, armed difficulty-zero alarm and one pair of pliers at 100% condition. Ordinary locked-door targeting with the primary weapon selected showed **Acercarse y examinar · 20 PA · 80 PA restantes**. The action moved Cabral to (7,3), inspected the door and revealed the alarm. The preview did not disclose the unknown trap.
- Selecting pliers spent 4 AP. Door targeting then showed **Desarmar trampa · 61% de éxito · 18 PA · 58 PA restantes**. The real seeded attempt succeeded, left the lock closed and locked, and reduced the pliers to 98% condition. A fresh tab restored the same public units, disarmed alarm and six-second clock.
- Browser warning/error logs were empty in both flows and restored tabs. A 1280×720 screenshot exposed missing keyboard tile previews: the tile focus/blur handlers were corrected, and the subsequent live door and inspection previews above passed. Rendered event coverage checks focus, preview, Enter and blur.

The final run passed **981/981 regression tests**, excluding only the unchanged illustrated-sprite packing suite. This includes eleven environment-approach cases and one new keyboard event case. Typecheck, production build and whitespace validation passed; static export verified 607 files and 518 asset references. Logs are `/tmp/granaderos-env-approach-final-logic.log`, `/tmp/granaderos-env-approach-types.log` and `/tmp/granaderos-env-approach-build.log`.

Live crowbar/lock-pick failure, failed disarm, approach interruption and authored cache routes remain outside this check. Shared simulation tests cover those supported rules. See [environment approach](environment-approach.md) and the [parity audit](ja2-parity-audit.md).


## Ground pile and body picker checkpoint

The controlled import `/tmp/granaderos-loot-approach-live/before.json` on `http://127.0.0.1:3010/` placed Cabral at (2,2) with 100 AP, a dead opponent at (6,2), and two ground stacks on that same tile. The body held nineteen cartridges; the ground held twelve cartridges and an identified Brown Bess at 41% condition with one loaded round, failed ignition and a fitted bayonet at 39% condition. These are explicit fixture inputs, not campaign-earned loot. The normal localhost save was not used.

- Before approach, Cabral's public nearby-loot projection was empty. Focusing **Equipo en C7 · 2 objeto(s)** showed **Acercarse al equipo · 24 PA · 76 PA restantes**, with another 8 AP required for pickup. One Enter activation moved him three tiles to (5,2). Only then did the picker show the body's items and both ground stacks, separately labeled by source.
- Selecting **En el suelo · Cartuchos · 12**, entering quantity three and confirming **Recoger · 8 PA** left nine ground cartridges. Cabral held three cartridges and 68 AP.
- Selecting the dead figure opened the same picker. Taking four of the body's nineteen cartridges left fifteen on the body and increased Cabral's total to seven, with 60 AP.
- Selecting the ground Brown Bess showed **Estado 41%. 1 carga(s). Necesita cebado. Con bayoneta fijada.** Escape closed the picker and preserved 60 AP and the six-second clock.
- Reopening and confirming took the exact musket into Cabral's pack for 8 AP, leaving 52 AP. His held sable and primary-hand selection did not change. The ground musket was depleted; the nine ground cartridges and fifteen body cartridges remained. Private instance identity conservation is established by the simulation test; the public read verified the weapon's load, ignition failure, condition and fitting condition.
- A 1280×720 screenshot was inspected. The picker was centered after correcting the inherited dialog margin; its select, quantity, metadata and confirmation remained readable. Keyboard focus moved to the selector after the approach animation. Escape closed the modal without a pickup charge.
- A fresh tab and **Continuar campaña →** restored identical public unit records, ground stacks, nearby loot and six elapsed seconds. That fresh tab had no browser warnings or errors. An earlier marker syntax error had prevented the development page from loading; it was corrected before the successful flow. The TSX test loader now fails on syntax diagnostics rather than accepting compiler recovery output.

The final run passed **993/993 regression tests**, excluding only the unchanged illustrated-sprite packing suite. Ten new simulation cases and two component cases are included. Typecheck, production build and whitespace validation passed. Static export verified 607 files and 518 asset references. Logs are `/tmp/granaderos-loot-approach-final-logic.log`, `/tmp/granaderos-loot-approach-types.log` and `/tmp/granaderos-loot-approach-build.log`.

Live interrupted approaches and full-pack rejection remained outside this browser checkpoint; they had simulation/component coverage. Select All was added and capacity rejection checked in the next checkpoint below. Strategic sector inventory remains unimplemented. See [loot approach](loot-approach.md) and the [parity audit](ja2-parity-audit.md).

## Multi-item pickup checkpoint

Controlled imports on `http://127.0.0.1:3010/` reused the preceding approach fixture and a derived full-pack fixture at `/tmp/granaderos-loot-batch-live/full-pack.json`. Positions, equipment and initial 100 AP were explicit test inputs, not campaign-earned loot. The ordinary localhost player save was not used.

- Enter on the ground marker moved Cabral three tiles for 24 AP. **Seleccionar todos** selected five separate rows: the body's loaded musket, nineteen cartridges and one dressing, plus twelve ground cartridges and the loaded ground musket with failed ignition. The preview showed one 8 AP pickup charge and 68 AP remaining after confirmation.
- **Recoger selección · 8 PA** transferred all five stacks. Cabral held 31 reserve cartridges and three dressings. His sable remained equipped. Both muskets entered his pack separately: one at 100% condition and the other at 41%, retaining its failed ignition and fitted bayonet at 39%. Each retained its loaded round. Ground items and nearby body loot were depleted.
- A 1280×720 screenshot showed readable source labels, quantities and equipment details. The item list scrolled within the centered dialog while the selection controls and confirmation remained visible.
- A fresh tab and **Continuar campaña →** restored identical public unit records, empty ground sources, no nearby loot and the six-second clock.
- The capacity fixture began with 220 reserve cartridges and eleven of twelve pack capacity used. After the same 24 AP approach, Select All showed **No queda espacio para esa cantidad de objetos.** Confirmation was disabled. Public state still showed 76 AP, 220 cartridges and unchanged ground counts.
- **Limpiar selección**, then selecting four body cartridges and three ground cartridges, produced a valid selection. One confirmation spent 8 AP and left Cabral with 68 AP and 227 cartridges. Fifteen body cartridges and nine ground cartridges remained. Both guns and the body's dressing remained available.
- A fresh tab restored identical public units, ground sources, nearby loot and six elapsed seconds for this reduced selection. Warning/error logs were empty in both successful flows and both restored tabs.

The complete selection is planned on private copies before commitment. A stale source, invalid quantity or capacity failure transfers nothing. The flat 8 AP charge follows this game's existing whole-body pickup rule; it is Granaderos tuning, not a verified JA2 formula. Eleven new simulation tests cover rollback, combined capacity, malformed selections, duplicate aliases, source visibility and reach, item identity, exploration timing, saved interruptions and campaign persistence.

The final run passed **1004/1004 regression tests**, excluding only the unchanged illustrated-sprite packing suite. Typecheck, production build and whitespace validation passed. Static export verified 607 files and 518 asset references. Logs are `/tmp/granaderos-loot-batch-logic.log`, `/tmp/granaderos-loot-batch-types.log` and `/tmp/granaderos-loot-batch-build.log`.

Live interrupted approaches remain outside this browser check. Strategic sector inventory and other partial requirements in the [parity audit](ja2-parity-audit.md) remain open. These gameplay changes are local and uncommitted.

## Location fire checkpoint

Controlled imports on `http://127.0.0.1:3000/?qa=1` used the separate QA save key. Files are `/tmp/granaderos-point-fire-live/friendly.json` and `blind.json`. They retain an actual pending legacy campaign encounter but declare test positions, a full-height wooden barrier, one hidden enemy, loaded weapons, shooter marksmanship and 100 initial AP. These are UI fixtures, not earned campaign equipment or naturally played encounters.

- In the friendly-interception fixture, Cabral began at (1,3), Dorrego at (4,3), and an unseen opponent at (7,3), behind the barrier at x=5. The UI showed zero observed enemies.
- Selecting four aim increments, focusing **D8, accesible** and pressing **F** showed **Disparar a la casilla · 36 PA · 64 PA restantes**. It showed no percentage or enemy identity. The warning explained the fixed height, cover/body interception and friendly-fire risk. A screenshot was inspected; the preview and its cost/warning were legible above the map.
- One Enter activation fired at that cell. Cabral retained 96 HP and had 64 AP, zero loaded rounds, zero reserve cartridges and 99% weapon condition. The first body intercepted the projectile: Dorrego fell from 84 to 23 HP and had five bleeding points. The journal recorded 61 damage to the visible ally and the location shot. The clock was six seconds.
- A fresh tab and **Continuar campaña →** restored the exact public unit records and six-second clock. Browser warnings/errors were empty.
- The second fixture moved Dorrego away from the line. With four aim increments and the head-region button selected, F/Enter on D8 still used the fixed-height location shot. It spent 36 AP and one load, reduced condition to 99%, and showed only the generic location-fire message. The hidden opponent stayed absent from the public unit list. Private damage to that opponent is simulation-test evidence, not a claim from the public browser read.
- A second Enter attempt with the empty gun showed **Recargá el arma.** Public unit records and the six-second clock were unchanged. A fresh tab restored the same units and clock, with no visible enemy. Warning/error logs were empty in the blind-fire and restored tabs.

Fifteen location-fire simulation cases cover the wider geometry, scatter, readiness, privacy, timing and persistence contract. The final regression run passed **1020/1020 tests**, excluding only the unchanged illustrated-sprite packing suite. Typecheck, production build and whitespace validation passed; static export verified 607 files and 518 asset references. Logs are `/tmp/granaderos-point-fire-final-logic.log`, `/tmp/granaderos-point-fire-final-types.log` and `/tmp/granaderos-point-fire-final-build.log`.

The first full run found one changed hotkey-text expectation and two existing civilian sprite assertions that still expected the retired `civilian` family. The help text retains the deliberate-fire wording, and the two assertions now expect the current `surgeon` family. No sprite art or mapping was changed in this increment.

Live scattered misses, blunderbuss direction fire and interrupt firing remain outside this browser check; they have simulation coverage. Broader hidden-AI action journal filtering is also still open. See [location fire](location-fire.md) for explicit tuning and limits. Gameplay changes remain local and uncommitted; this is not full JA2 parity.
