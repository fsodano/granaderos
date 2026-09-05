# Granaderos implementation and verification ledger

## Objective and completion rule

Implement the entire supplied specification as a WEB GAME, using the supplied JA2 v1.13 source as reference, including original graphics. Player-facing content must be Spanish; code and docs remain English. Build and test the actual game; use semver and check in progress through GitHub pull requests. A small playable encounter is a milestone, not completion. This file records evidence rather than planned work as accomplished.

## Current browser milestone

The user clarified that the deliverable is a web game. The browser implementation is now primary; earlier native build work is retained as reference. No licensed JA2 installation is needed to run this implementation.

Implemented: Spanish campaign and tactical interface; thirteen historical operatives and portraits; fourteen authored tactical maps; five campaign phases; recruitment, diplomacy, production, transport and strategic raids; firearm reloads, misfires, smoke, melee, mounted charges, reactions, crew-served artillery and operative bonuses; local save/export/import.

Evidence: see `WEB-SYSTEMS.md`, `tactical-verification.md`, and `tests/*.test.mjs`. Automated campaign progression uses injected victory results; it is not evidence of a complete human playthrough. Browser QA has exercised recruitment preparation, production completion, deployment, movement and rejected invalid orders through the real interface.

Remaining full-release work includes custom officer creation, full animation and sound sets, complete historical narrative and faction behavior, broader tactical fidelity, balance and an end-to-end campaign playthrough. The checklist below preserves original acceptance criteria; TODO means not fully proved even where a subset is implemented.

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
| ENG-03 | Save/load and versioning | TODO | Round-trip campaign/tactical saves and versioned package |
| NAR-01 | Elío/Vigodet, Pezuela, Tristán, Romarate and Loyalist commands | TODO | In-game narrative and multi-command objectives |
| NAR-02 | Retiro recruitment and training phase | TODO | Costs, recruits and mounts advance phase only on requirements |
| NAR-03 | San Lorenzo river ambush | TODO | Authored playable tactical map, force composition and win/loss conditions |
| NAR-04 | Yatasto/Northern Army transition | TODO | Triggered sequence and Güemes frontier assignment |
| NAR-05 | El Plumerillo foundry and 3,000 infantry preparation | TODO | Resource consumption, manufacturing and uniforms tracked in saves |
| NAR-06 | Pehuenche diplomacy and San Martín final unlock | TODO | Treaty and logistics prerequisites enforced; no early recruitment |
| FAC-01 | Six factions, reputation effects and immutable Royalist hostility | TODO | Gameplay changes recruitment, tariffs, morale and raids; persistence |
| REC-01 | Logia Lautaro, monthly stipends and ideological contracts | TODO | Functional recruitment screen and monthly financial cycle |
| REC-02 | Civic bulletin, low-cost provincial recruits and growth | TODO | Recruitment, starting equipment and progression |
| REC-03 | Cabildo custom officer examination and four historical traits | TODO | Character creation and tested tactical trait effects |
| LOG-01 | Chasque/posta horse relay network | TODO | Route control, travel time and remount stamina/cost |
| LOG-02 | Armed river flotilla | TODO | River navigation, artillery transport and amphibious deployment |
| LOG-03 | Cuyo ox-cart heavy supply trains | TODO | Distinct speed, capacity and logistics use |
| ECO-01 | British contraband and 72–120 hour deliveries | TODO | Silver purchase, restricted historical inventory and timed delivery |
| ECO-02 | Retiro/Beltrán production chains | TODO | Materials become weapons, artillery and cartridges over time |
| ECO-03 | Estancia income, raids and recovery | TODO | Income tied to livestock and multiweek recovery |
| ECO-04 | Customs revenue and naval blockades | TODO | Blockade reduces income and can be lifted |
| ECO-05 | Provincial treasuries | TODO | Capture payouts and recurring tax without repeat-capture exploit |
| MIL-01 | Cívicos, Montoneras and veteran line/Granaderos tiers | TODO | Training, historical loadouts and distinct behavior |
| TAC-01 | 100 AP, exact weapon cycles, long reloads, prone penalty | TODO | Runtime AP deductions and weapon XML match specification |
| TAC-02 | Smoothbore dispersion and Baker precision | TODO | Range-based combat tests including 15/25/35/50 tiles |
| TAC-03 | Expanding persistent smoke, LOS/CTH/interrupt effects | TODO | Volley smoke in tactical runtime, aging and visibility checks |
| TAC-04 | Weather/fouling misfires, 15 AP re-prime, flint durability | TODO | Failed ignition consumes trigger AP but preserves main charge; repair cycle |
| TAC-05 | Straight-line charge and +10% damage per tile | TODO | Path, AP, collision and momentum tests in runtime |
| TAC-06 | Sabre bleeding/parry, bayonet reach/intercepts, lance knockdown, facón defense | TODO | Distinct melee behaviors verified against target types |
| TAC-07 | Formation morale shock and routing | TODO | Leadership/speed checks, dropped weapons and fleeing enemies |
| TAC-08 | Crew-served 4/8 lb guns and swivels | TODO | Crew requirements, movement/pivot AP and range |
| TAC-09 | Solid shot penetration and structural destruction | TODO | Multi-target and wall-breach scenario |
| TAC-10 | Canister cones and suppression | TODO | Cone geometry, damage falloff and morale tests |
| MAP-01 | All 13 named strategic sectors and four theaters | TODO | Map geography, names, biomes, sector assets and tactical maps |
| MAP-02 | Camino Real, Paraná choke point and Andean supply routes | TODO | Contested route interruption changes supply and travel |
| ENV-01 | Mud costs, heat, humidity/fouling | TODO | Biome-specific movement and stamina tests |
| ENV-02 | Altitude, ponchos, cold and winter pass closure | TODO | Equipment mitigation and seasonal transit tests |
| AI-01 | Northern invasion objective | TODO | Royalist corps advances Humahuaca–Jujuy–Salta–Tucumán |
| AI-02 | Revenue-triggered coastal raids | TODO | Naval response to customs growth |
| AI-03 | Low-loyalty partisan raids | TODO | Target selection and economic damage |
| ROST-01 | All 13 historical operatives, exact stats and loadouts | TODO | Data validation and recruitment in running game |
| ROST-02 | Unique operative abilities and gated availability | TODO | Runtime tests per operative including bodyguard and grand strategist |
| ITEM-01 | All 9 firearms and 5 melee weapons | TODO | XML values, inventory images, sounds and use in combat |
| ITEM-02 | All 3 artillery pieces and 5 consumable/equipment types | TODO | Data and actual consumption/carry effects |
| ART-01 | Main menu and period desk interfaces | TODO | Original assets exported and rendered in engine |
| ART-02 | Historical portraits and face animations | TODO | 13 usable face sets, correct palettes and expression offsets |
| ART-03 | Uniforms, infantry and cavalry animations | TODO | Complete stance/action/direction frame sets rendered in tactical engine |
| ART-04 | Terrain, colonial buildings, rivers, foundry, ships and ordnance | TODO | Engine tilesets and authored sector maps |
| ART-05 | Historical sound and dialogue conversion | TODO | No unintentional modern weapon/mercenary audio in campaign |
| QA-01 | Campaign end-to-end completion | TODO | Recorded playthrough covering phases, victory and defeat |
| QA-02 | Artifact/release audit | TODO | Reproducible package, installation docs, semver, PR and tested release |

## Work log

- Goal execution started: established Git repository and upstream submodule; dispatched independent engine-build, campaign-data and graphics work. No game-completion claim.


- Web clarification implemented: browser rules and React interface are primary; all thirteen portraits and fourteen maps installed. Persistent goal remains active until full acceptance audit.
