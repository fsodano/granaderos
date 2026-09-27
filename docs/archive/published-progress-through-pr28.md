> Historical published checkpoint through PR #28. Use [current progress](../verification/published-progress.md).

# Granaderos implementation and verification ledger

## Objective and completion rule

Implement the entire supplied specification as a WEB GAME, using the supplied JA2 v1.13 source as reference, including original graphics. Player-facing content must be Spanish; code and docs remain English. Build and test the actual game; use semver and check in progress through GitHub pull requests. A small playable encounter is a milestone, not completion. This file records evidence rather than planned work as accomplished.

## Current status — 2026-09-27

**The full game and story editor are not complete.** This is the primary progress
ledger. It was not updated alongside recent PRs; its previous latest checkpoint
was 2026-09-05. This update reconciles published work through PR #27. Earlier
work-log entries below are historical snapshots, not current verification.

Published baseline: `main` at `5f1deab1ef35143ef3c2ba1af421528467e23510`.
[PR #27 checks](https://github.com/fsodano/granaderos/actions/runs/36355036006/job/108720967309)
passed on source commit `b70877f3fb3bce59f7f367b7ff0749b440ff254e`: 537 tests,
TypeScript checks, and production export (721 files, 631 asset references).
This establishes that delivery's checks. It does not establish a complete
campaign playthrough or compatibility with unpublished branches.

The published game has `/story` for content and `/editor` for sector construction.
The local editor on port 3107 is a separate prototype. Its larger gameplay
implementation and the original working checkout still require consolidation.
A feature in that prototype is not automatically a feature on GitHub `main`.

### Delivered and verified scopes

`VERIFIED` below applies only to the stated, bounded capability. The requirement
IDs connect it to the broader acceptance table; they do not close that whole row.
See [story-editor.md](../development/story-editor.md) for behavior and test details.

| Capability | Status | Published evidence | Remaining boundary |
|---|---|---|---|
| Choose the custom officer's existing portraits | VERIFIED | [PR #19](https://github.com/fsodano/granaderos/pull/19); character creator tests | Not a complete face animation set (ART-02) |
| Edited names, portraits, biography and attributes in an isolated campaign and save | VERIFIED | [PR #20](https://github.com/fsodano/granaderos/pull/20); `campaign-content.test.mjs`, `story-editor.test.mjs` | Not arbitrary narrative composition (ENG-03, ROST-01) |
| Contract candidates stay off-map; paid arrivals use controlled, suitable reception sites | VERIFIED | [PR #21](https://github.com/fsodano/granaderos/pull/21); `hiring-arrivals.test.mjs` | Timed arrival, not a geographic transport simulation (REC-01, REC-02, LOG-01/02) |
| Authored firearm stats, images and variants survive use, loot, equipment changes and saves | VERIFIED | [PR #22](https://github.com/fsodano/granaderos/pull/22); `content-weapons.test.mjs` | Melee, artillery, ammunition types, accessories and merchant stocks are not authored yet (ITEM-01/02) |
| Authored firearms for generated enemy and militia classes | VERIFIED | [PR #23](https://github.com/fsodano/granaderos/pull/23); `content-force-equipment.test.mjs` | Does not configure complete forces or strategic opposition (MIL-01, AI-01/02/03) |
| Add, copy, remove and hire new contract identities | VERIFIED | [PR #24](https://github.com/fsodano/granaderos/pull/24); `content-roster.test.mjs` | New encounter NPCs and replacement of historical campaign roles remain pending (REC-02, ROST-01) |
| Authored voice phrases, personality, portrait and tactical appearance | VERIFIED | [PR #25](https://github.com/fsodano/granaderos/pull/25); `content-presentation.test.mjs` | Phrases are not branching dialogue or quests (ART-02/03/05, NAR-01) |
| Combat abilities configurable independently of character identity | VERIFIED | [PR #26](https://github.com/fsodano/granaderos/pull/26); `content-abilities.test.mjs` | Historical campaign and recruitment gates remain fixed (ROST-02) |
| Exact land-cell selection, travel, tactical entry and independent saved scenes | VERIFIED | [PR #27](https://github.com/fsodano/granaderos/pull/27); `world-cells.test.mjs`, `world-cells-render.test.mjs` | Includes 40-cell save test; not live NPC placement or water-cell travel (MAP-01/02, ENG-03) |

### Open integration work

| ID | Work | Status | Evidence required to close |
|---|---|---|---|
| STORY-01 | Fixed, initial-random and daily NPC presence on exact cells | IN PROGRESS | Real encounters and local recruitment, deterministic saves, scene protection, no duplicate residents; implementation branch is not yet published |
| STORY-02 | New encounter identities, persistent civilian condition and death successors | TODO | Wounds/death and identity persist through movement, recruitment and saves; successor inherits the intended campaign role exactly once |
| STORY-03 | Branching dialogue, quests, conditions and effects | TODO | Author and complete a branching quest through the normal interface; save at each branch |
| STORY-04 | Triggered movement inside a tactical sector | TODO | Authored interaction starts real pathfinding, handles interruption and resumes after save/load |
| STORY-05 | Configurable campaign rules and historical role extraction | PARTIAL | Existing sheets/abilities work; remaining combat, care, economy, progression, logistics and opposition rules require configuration and gameplay tests |
| STORY-06 | Complete equipment and merchant authoring | PARTIAL | Firearms work; melee, artillery, ammunition, attachments, stocks and replenishment remain |
| STORY-07 | Campaign start, ownership, chapters and endings | TODO | A second distinct playable campaign created without engine-code changes |
| STORY-08 | Portable, immutable content package and asset/dependency validation | PARTIAL | Package identity and embedded weapon/portrait data work; full narrative/rule/asset package still pending |
| INTEGRATION-01 | Consolidate published game, local prototype and advanced gameplay work | PARTIAL | Preserve the current pesos-only economy and contract behavior; run the complete combined suite and actual campaign routes |
| QA-01 | Full campaign completion and failure routes | PARTIAL | Recorded uninterrupted gameplay across all phases; injected victory results and focused combat fixtures are insufficient |

The prototype's latest recorded broad run had 2894/2895 tests pass, with a
San Lorenzo route defeat still unresolved. That is an earlier diagnostic result,
not a new check on this published baseline. The smaller published suite cannot
be used to declare that prototype defect fixed.

### Maintenance rule

Every implementation PR must update this file with the bounded behavior delivered,
the affected requirement IDs, tests run and remaining gaps. Mark a delivery
verified only after its exact source commit passes the relevant checks; record
its PR here. Unmerged code must stay explicitly in progress. Keep full acceptance
rows open until their own evidence is complete. Do not infer a completion
percentage from PR counts or test counts.

### Scope changes that override the original specification

[PR #12](https://github.com/fsodano/granaderos/pull/12) replaced the original
materials/production/convoy/horse-care economy with pesos. Campaign preparations,
diplomacy, equipment and ammunition use the treasury; the army preparation costs
3000 pesos. Raw-material production and individual horse care must not be
reintroduced merely to satisfy an obsolete checklist. [PR #17](https://github.com/fsodano/granaderos/pull/17)
removed the one-day-only limit for elite hires; current day/week/month terms must
remain available subject to funds. Historical log entries describe earlier designs.

## Milestones

1. **0.1.0 development:** playable browser campaign and tactical core, original static art, saves, automated checks and static build.
2. **0.2.0:** historical scenario and rules fidelity; complete recruitment flows.
3. **0.3.0:** complete strategic logistics, faction behavior and campaign narrative.
4. **0.4.0:** animation, sound and responsive interface polish.
5. **1.0.0 candidate:** full specification audit, balancing and recorded campaign playthrough.

## Full requirements and acceptance evidence

Status: TODO = no accepted implementation; IN PROGRESS = work not yet verified and published; PARTIAL = implemented subset or incomplete acceptance evidence; VERIFIED = evidence covers the complete stated scope; SUPERSEDED = replaced by an approved scope change.

The broad rows below remain open unless their complete acceptance evidence is available. The verified delivery scopes above identify concrete progress within those rows. This refresh does not claim a new full-specification audit of every older subsystem.

| ID | Requirement | Status | Required acceptance evidence |
|---|---|---|---|
| ENG-01 | Build browser game using supplied source as reference | PARTIAL | Static build and browser QA; final release audit pending |
| ENG-02 | Launch browser game | PARTIAL | Local browser menu/campaign/tactical runtime verified; hosted build pending |
| ENG-03 | Save/load and versioning | PARTIAL | Round-trip campaign/tactical saves and versioned package |
| NAR-01 | Elío/Vigodet, Pezuela, Tristán, Romarate and Loyalist commands | PARTIAL | In-game narrative and multi-command objectives |
| NAR-02 | Retiro recruitment and training phase | PARTIAL | Costs, recruits and mounts advance phase only on requirements |
| NAR-03 | San Lorenzo river ambush | PARTIAL | Authored playable tactical map, force composition and win/loss conditions |
| NAR-04 | Yatasto/Northern Army transition | PARTIAL | Triggered sequence and Güemes frontier assignment |
| NAR-05 | El Plumerillo campaign preparation under the pesos-only economy | PARTIAL | 3000-peso funding and remaining campaign prerequisites; full route acceptance pending (original production scope replaced by PR #12) |
| NAR-06 | Pehuenche diplomacy and San Martín final unlock | PARTIAL | Treaty and logistics prerequisites enforced; no early recruitment |
| FAC-01 | Six factions, reputation effects and immutable Royalist hostility | PARTIAL | Gameplay changes recruitment, tariffs, morale and raids; persistence |
| REC-01 | Logia Lautaro, monthly stipends and ideological contracts | PARTIAL | Functional recruitment screen and monthly financial cycle |
| REC-02 | Civic bulletin, low-cost provincial recruits and growth | PARTIAL | Recruitment, starting equipment and progression |
| REC-03 | Cabildo custom officer examination and four historical traits | PARTIAL | Character creation and tested tactical trait effects |
| LOG-01 | Chasque/posta travel network | PARTIAL | Route control and travel time; individual remount stamina/care was removed by PR #12 |
| LOG-02 | Armed river flotilla | PARTIAL | River navigation, artillery transport and amphibious deployment |
| LOG-03 | Cuyo ox-cart heavy supply trains | PARTIAL | Distinct speed, capacity and logistics use |
| ECO-01 | British imports and timed deliveries | PARTIAL | Purchase in pesos, inventory and delivery under control/blockade changes; silver resource replaced by PR #12 |
| ECO-02 | Retiro/Beltrán raw-material production chains | SUPERSEDED | Replaced by pesos-only procurement and campaign payments in PR #12; do not restore obsolete material recipes |
| ECO-03 | Estancia income, raids and recovery | PARTIAL | Income tied to livestock and multiweek recovery |
| ECO-04 | Customs revenue and naval blockades | PARTIAL | Blockade reduces income and can be lifted |
| ECO-05 | Provincial treasuries | PARTIAL | Capture payouts and recurring tax without repeat-capture exploit |
| MIL-01 | Cívicos, Montoneras and veteran line/Granaderos tiers | PARTIAL | Training, historical loadouts and distinct behavior |
| TAC-01 | 100 AP, exact weapon cycles, long reloads, prone penalty | PARTIAL | Runtime AP deductions and weapon XML match specification |
| TAC-02 | Smoothbore dispersion and Baker precision | PARTIAL | Range-based combat tests including 15/25/35/50 tiles |
| TAC-03 | Expanding persistent smoke, LOS/CTH/interrupt effects | PARTIAL | Volley smoke in tactical runtime, aging and visibility checks |
| TAC-04 | Weather/fouling misfires, 15 AP re-prime, flint durability | PARTIAL | Failed ignition consumes trigger AP but preserves main charge; repair cycle |
| TAC-05 | Straight-line charge and +10% damage per tile | PARTIAL | Path, AP, collision and momentum tests in runtime |
| TAC-06 | Sabre bleeding/parry, bayonet reach/intercepts, lance knockdown, facón defense | PARTIAL | Distinct melee behaviors verified against target types |
| TAC-07 | Formation morale shock and routing | PARTIAL | Leadership/speed checks, dropped weapons and fleeing enemies |
| TAC-08 | Crew-served 4/8 lb guns and swivels | PARTIAL | Crew requirements, movement/pivot AP and range |
| TAC-09 | Solid shot penetration and structural destruction | PARTIAL | Multi-target and wall-breach scenario |
| TAC-10 | Canister cones and suppression | PARTIAL | Cone geometry, damage falloff and morale tests |
| MAP-01 | All 13 named strategic sectors and four theaters | PARTIAL | Map geography, names, biomes, sector assets and tactical maps |
| MAP-02 | Camino Real, Paraná choke point and Andean supply routes | PARTIAL | Contested route interruption changes supply and travel |
| ENV-01 | Mud costs, heat, humidity/fouling | PARTIAL | Biome-specific movement and stamina tests |
| ENV-02 | Altitude, ponchos, cold and winter pass closure | PARTIAL | Equipment mitigation and seasonal transit tests |
| AI-01 | Northern invasion objective | PARTIAL | Royalist corps advances Humahuaca–Jujuy–Salta–Tucumán |
| AI-02 | Revenue-triggered coastal raids | PARTIAL | Naval response to customs growth |
| AI-03 | Low-loyalty partisan raids | PARTIAL | Target selection and economic damage |
| ROST-01 | All 13 historical operatives, exact stats and loadouts | PARTIAL | Data validation and recruitment in running game |
| ROST-02 | Unique operative abilities and gated availability | PARTIAL | Runtime tests per operative including bodyguard and grand strategist |
| ITEM-01 | All 9 firearms and 5 melee weapons | PARTIAL | XML values, inventory images, sounds and use in combat |
| ITEM-02 | All 3 artillery pieces and 5 consumable/equipment types | PARTIAL | Data and actual consumption/carry effects |
| ART-01 | Main menu and period desk interfaces | PARTIAL | Original assets exported and rendered in engine |
| ART-02 | Historical portraits and face animations | PARTIAL | 13 usable face sets, correct palettes and expression offsets |
| ART-03 | Uniforms, infantry and cavalry animations | PARTIAL | Complete stance/action/direction frame sets rendered in tactical engine |
| ART-04 | Terrain, colonial buildings, rivers, foundry, ships and ordnance | PARTIAL | Engine tilesets and authored sector maps |
| ART-05 | Historical sound and dialogue conversion | PARTIAL | No unintentional modern weapon/mercenary audio in campaign |
| QA-01 | Campaign end-to-end completion | PARTIAL | Recorded playthrough covering phases, victory and defeat |
| QA-02 | Artifact/release audit | PARTIAL | Reproducible package, installation docs, semver, PR and tested release |

## Historical work log (earlier designs and checkpoints)

- Goal execution started: established Git repository and upstream submodule; dispatched independent engine-build, campaign-data and graphics work. No game-completion claim.


- Web clarification implemented: browser rules and React interface are primary; all thirteen portraits and fourteen maps installed. Persistent goal remains active until full acceptance audit.

- Second web milestone: Cabildo custom officer and civic bulletin implemented and exercised in browser; custom officer and volunteer survived save/resume. Four custom doctrines and finite tactical consumables influence real orders. Named Royalist commands have distinct timed behaviors. Added explicit mobile orders, visible battle errors, zoom, original synthesized sound effects, cannon/foundry art and eight infantry action poses. Pose artwork is not a complete animation set. GitHub web CI for 9a9ca07 passed (run33964710149); later changes require their own CI run.

## Additional gameplay requirements

The user supplied twelve detailed JA2-style gameplay comments and six reference screenshots. The expanded requirements and separate acceptance ledger are preserved in `specification/gameplay-expansion.md`. Persistent sector exploration, multiple squads, NPC dialogue, full dossiers, individual inventories/loot, energy/unconsciousness, night play, horses and true movement animation are required for completion. Current battle-only encounter generation does not satisfy this scope.

### Recruitment desk and encounter integration checkpoint

Implemented a separate Spanish Escritorio screen with service dossiers and a return to the strategic map. Encounter-only characters have no hire card. Tactical NPC markers open conversations, gated by adjacency and backend campaign requirements. Browser verification in an isolated QA save: opened desk, returned to map, entered Retiro, approached the sergeant and received his dialogue. Combined engine tests: 145 passed; TypeScript and static production build passed before the next animation/horse UI batch. The full game remains incomplete.

### dev.4 evidence checkpoint

166 tests pass, TypeScript passes, static build verifies 155 files and 73 asset references. Original infantry walk/crouch/crawl and cavalry walk rigs are preserved with render and verification scripts. Browser checks cover the separate desk, adjacent Retiro greeting and horse buy/assign/feed. The legal opening playthrough wins both opening battles without injected victories; this does not establish full campaign balance. See REQUIREMENT-AUDIT.md for remaining requirements.


## 2026-09-05 — 0.2.0-dev.1 personal campaign start

New campaigns start at the desk with no personnel. One free custom officer has
manual attributes, original portrait, class and an effective trait questionnaire.
Seven fictional paid volunteers use finite day/week/month contracts with XP pay
growth and elite daily limits; historical figures remain tactical encounters.
The strategic map now focuses on personnel, sectors, time and city militia.
NPC supply quests award city loyalty once. See NEW-START-AUDIT.md for browser
acceptance and scope limits. All 192 tests, typecheck and static build pass.
Previous milestone PR #1 merged as e8cc25d92352cd02b1d44f3e41c8065c9dcb1615.
Current branch: feat/0.2.0-personal-campaign-start. Native engine submodule edits
are pre-existing and excluded from this web milestone.


## Full implementation continuation — active

The user resumed the complete game objective after the campaign-start milestone.
Do not treat PR #2 or its 192 tests as complete-game acceptance. The broader
REQUIREMENT-AUDIT.md remains the gap ledger and has stale entries that must be
rechecked against current code. Root is adding actual faction policy consequences;
campaign_data owns live tactical militia and casualty conservation; engine_build
owns practiced riding/sneaking persistence and UI; graphics owns adapted keyboard
controls. Screenshot capture was blocked by the locked Mac; this does not block
implementation or automated verification. Do not mark the full goal complete.

Final 0.3.0-dev.1 checkpoint: 209 tests, typecheck and production export pass.
Browser QA tab9 (?qa=1) resumes with Sosa and three Retiro militia. After reload,
Z on a focused command button correctly selected Agachado y sigiloso. Spanish
help opens, save/resume preserves the sector, and console error list is empty.
Two requested screenshots were displayed inline (recruitment desk and map).
Local dev server session36459 was started on port3000.
Next work is detailed in NEXT-IMPLEMENTATION.md; full goal remains active.


## 0.4.0-dev.1 — tactical visuals and campaign continuity

The tactical renderer now uses original generated material textures and transparent vegetation, proportional eight-direction soldiers with stance and action atlases, depth sorting, textured building cutaways, and a compact bottom squad HUD. Camera zoom and panning make the field inspectable at playing scale. See TACTICAL-VISUALS.md for provenance and remaining visual gaps; this is an intermediate art pass, not final JA2-level scenery density.

This checkpoint also integrates shared tactical/campaign time, authored historical encounters, finite industry inputs and delayed equipment imports. All 228 automated tests, TypeScript checks, and the static build passed before the version-only checkpoint update. Browser review verified the daylight San Lorenzo scene and camera controls.
