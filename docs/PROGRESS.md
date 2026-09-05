# Granaderos implementation and verification ledger

## Objective and completion rule

Implement the entire supplied specification as a WEB GAME, using the supplied JA2 v1.13 source as reference, including original graphics. Player-facing content must be Spanish; code and docs remain English. Build and test the actual game; use semver and check in progress through GitHub pull requests. A small playable encounter is a milestone, not completion. This file records evidence rather than planned work as accomplished.

## Current browser milestone

The user clarified that the deliverable is a web game. The browser implementation is now primary; earlier native build work is retained as reference. No licensed JA2 installation is needed to run this implementation.

Implemented: Spanish campaign and tactical interface; thirteen historical operatives and portraits; fourteen authored tactical maps; five campaign phases; recruitment, diplomacy, production, transport and strategic raids; firearm reloads, misfires, smoke, melee, mounted charges, reactions, crew-served artillery and operative bonuses; local save/export/import.

Evidence: see `WEB-SYSTEMS.md`, `tactical-verification.md`, and `tests/*.test.mjs`. Automated campaign progression uses injected victory results; it is not evidence of a complete human playthrough. Browser QA has exercised recruitment preparation, production completion, deployment, movement and rejected invalid orders through the real interface.

Remaining full-release work includes full animation and dialogue sets, remaining strategic logistics and faction behavior, broader tactical fidelity, balance and an end-to-end campaign playthrough. The checklist below preserves original acceptance criteria; TODO means not fully proved even where a subset is implemented.

## Milestones

1. **0.1.0 development:** playable browser campaign and tactical core, original static art, saves, automated checks and static build.
2. **0.2.0:** historical scenario and rules fidelity; complete recruitment flows.
3. **0.3.0:** complete strategic logistics, faction behavior and campaign narrative.
4. **0.4.0:** animation, sound and responsive interface polish.
5. **1.0.0 candidate:** full specification audit, balancing and recorded campaign playthrough.

## Requirements and acceptance evidence

Status: TODO = not proved; PARTIAL = implemented subset with limitations; VERIFIED = authoritative evidence covers the requirement.

| ID | Requirement | Status | Required acceptance evidence |
|---|---|---|---|
| ENG-01 | Build browser game using supplied source as reference | PARTIAL | Static build and browser QA; final release audit pending |
| ENG-02 | Launch browser game | PARTIAL | Local browser menu/campaign/tactical runtime verified; hosted build pending |
| ENG-03 | Save/load and versioning | PARTIAL | Round-trip campaign/tactical saves and versioned package |
| NAR-01 | Elío/Vigodet, Pezuela, Tristán, Romarate and Loyalist commands | PARTIAL | In-game narrative and multi-command objectives |
| NAR-02 | Retiro recruitment and training phase | PARTIAL | Costs, recruits and mounts advance phase only on requirements |
| NAR-03 | San Lorenzo river ambush | PARTIAL | Authored playable tactical map, force composition and win/loss conditions |
| NAR-04 | Yatasto/Northern Army transition | PARTIAL | Triggered sequence and Güemes frontier assignment |
| NAR-05 | El Plumerillo foundry and 3,000 infantry preparation | PARTIAL | Resource consumption, manufacturing and uniforms tracked in saves |
| NAR-06 | Pehuenche diplomacy and San Martín final unlock | PARTIAL | Treaty and logistics prerequisites enforced; no early recruitment |
| FAC-01 | Six factions, reputation effects and immutable Royalist hostility | PARTIAL | Gameplay changes recruitment, tariffs, morale and raids; persistence |
| REC-01 | Logia Lautaro, monthly stipends and ideological contracts | PARTIAL | Functional recruitment screen and monthly financial cycle |
| REC-02 | Civic bulletin, low-cost provincial recruits and growth | PARTIAL | Recruitment, starting equipment and progression |
| REC-03 | Cabildo custom officer examination and four historical traits | PARTIAL | Character creation and tested tactical trait effects |
| LOG-01 | Chasque/posta horse relay network | PARTIAL | Route control, travel time and remount stamina/cost |
| LOG-02 | Armed river flotilla | PARTIAL | River navigation, artillery transport and amphibious deployment |
| LOG-03 | Cuyo ox-cart heavy supply trains | PARTIAL | Distinct speed, capacity and logistics use |
| ECO-01 | British contraband and 72–120 hour deliveries | PARTIAL | Silver purchase, restricted historical inventory and timed delivery |
| ECO-02 | Retiro/Beltrán production chains | PARTIAL | Materials become weapons, artillery and cartridges over time |
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

## Work log

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
