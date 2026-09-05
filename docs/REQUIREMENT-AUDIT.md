# Granaderos requirement audit

Audit date: 2026-09-05. Sources: `docs/specification/original.txt` and `docs/specification/gameplay-expansion.md`. This is a source-code audit of the current shared working tree, not a completion certificate or a substitute for browser acceptance testing. Other workers may change the implementation after this snapshot.

**Implemented** means the described bounded behavior has an authoritative implementation and a player entry point. **Partial** means a playable approximation exists, but the full requested behavior does not. **Missing** means no implementation was found. Data labels, character biographies, standalone helpers and passing isolated tests do not establish a complete player experience.

The original native-engine conversion requirement has been superseded by the user's explicit Spanish browser-game direction. The original campaign, combat and later gameplay requirements remain relevant. `engine/` and `mod/` are reference/native conversion artifacts; the running browser game uses `game/` and `web/app/`, not the JA2 engine. The old TODO ledger in the expansion document is historical and should not be read as the current status.

## Campaign, politics and geography

| Requirement | Status | Evidence and precise remaining gap |
|---|---|---|
| Five phases from Retiro to San Martín field deployment | Implemented | `game/campaign.js:progress`, `campaignObjectives`, academy/diplomacy/foundry/produce actions; `Campaign.tsx` objectives and workshop. `tests/campaign-web.test.mjs` traverses the campaign through reducer orders. This is a campaign state machine, not five fully scripted cinematic missions. |
| Academy invests money, mounts, arms and recruits | Partial | Academy action consumes resources; custom recruitment exists. There is no extended cavalry training course requiring high-strength recruits. |
| San Lorenzo coordinated historical strike | Partial | `game/maps.js:buildSectorMap` has a distinct convent/riverside map and two approaches; attack action gates the encounter. San Martín is not a scripted allied NPC commander fighting alongside the player, and historical rescue/choreography is not a mission system. |
| Yatasto, relief of Belgrano, strategic realization | Partial | `game/narrative.js:mentorDispatch` and `progress` provide narrative and north-pact gates. No playable Yatasto sector, Belgrano encounter, or staged Vilcapugio/Ayohuma sequence. |
| El Plumerillo foundry, 3,000 infantry, passes and parliament | Implemented | `progress` checks foundry, infantry, cannons, fortifications, mountain control and parliament. Production consumes inputs. San Martín requires the local encounter after unlock. |
| Royalist command hierarchy and distinct doctrines | Partial | `narrative.js:ROYALIST_COMMANDS`, `oppositionFor`, `royalistIntel`; `campaign.js:raid` models ordered northern invasion, coastal revenue raids and interior sabotage. Commands mostly supply labels/objectives and strategic arithmetic, not unique commander AI, field bosses, sieges or a conquerable Montevideo headquarters. |
| Northern counter-invasions through Humahuaca | Implemented | `NORTHERN_AXIS` and `raid` advance through Humahuaca, Jujuy, Salta and Tucumán; held frontiers are not skipped. Tactical command identity is propagated in pending encounters. |
| Naval commerce interdiction and amphibious warfare | Partial | Blockade, port revenue damage, coastal attacks and flotilla routes work. No naval movement battlefield, vessel boarding map, naval command fleet, or amphibious flank landing selection. |
| Six faction reputation values | Implemented | `data.js:FACTIONS`, campaign reputation and diplomacy actions; Campaign diplomacy controls. Royalists remain fixed enemies. |
| Full faction consequences | Partial | Pacts, emancipation/commission, pay arrears and recruitment gates exist. Dynamic trade tariffs, national tax edicts, cattle-expropriation politics, indigenous betrayal/counter-raids, neglect-driven Pardo loyalty and privateering prize contracts are not complete systems. |
| Four theaters and 13 tabulated strategic sectors | Implemented | `data.js:CAMPAIGN_SECTORS`, map UI and authored tactical maps cover the table, with San Lorenzo additional. |
| All geography named in prose | Partial | Rosario, San Juan, La Rioja, Montevideo and Yatasto are not independent playable sectors; the 13-row table takes precedence in current map implementation. This is not a comprehensive historical geographic map. |
| Estancia/customs/municipal income and capture treasury | Implemented | Campaign daily income, damageUntil, blockade multipliers and one-time ownership capture payment. Repeated blockade clearance does not repeatedly award capture treasury. |
| Livestock recovery over weeks | Partial | Timed damage suppresses regional revenue. No individual cattle population, scattering, restocking or estate recovery simulation. |
| Domestic manufacturing and 72–120-hour contraband | Implemented | Production/contraband reducer actions, recipes, queues and Campaign workshop UI. |
| Full raw-material economy | Partial | Powder, copper, textiles and equipment resources exist. Separate timber, scrap iron, lead, leather and saltpeter extraction/refining chains and throughput scaling are absent. Imported individual weapons can also be bought instantly through Armory, bypassing historical shipment delay. |
| Three-tier militia | Partial | Campaign militia action and regional counts affect raid defense. Timed three-person courses now require a hired, co-located instructor; leadership and tactician specialities reduce duration. Promotions reserve prior-rank troops. No tactical militia formation squares, morale doctrine, live garrison units or equipment distribution tied to these counts. |
| Post-victory peaceful continuation | Implemented | Campaign action allowlist preserves time, travel, visits, squad/horse/equipment care; raids stop and defeat stays terminal. Horse tests advance 1,425 days through gestation and maturity. UI locks must remain aligned with this new behavior. |

## Recruitment, characters and strategic persistence

| Requirement | Status | Evidence and precise remaining gap |
|---|---|---|
| Third correspondence desk and portrait catalogue | Implemented | `Desk.tsx`, `Recruitment.tsx`, page screen transition. Historical portraits open `CharacterDossier.tsx`. |
| Complete familiar attributes and dossiers | Implemented | `characters.js:ATTRIBUTE_LABELS`, `CharacterDossier`; all ten supplied attributes, equipment, biography, personality and specialities. Civic/custom profiles use initials rather than painted portraits. |
| Thirteen exact historical baseline attribute sets | Implemented | `data.js:OPERATIVES`; baseline statistics are separate from persistent strength training. |
| Every exact historical starting item | Partial | Primary and blade loadouts exist. Hats, clothing variants, telescopes, forged passes, firing tables, surgical instruments, named tools and the special double-barrel carbine are not all functional individual items. Dossier prose must not imply those objects are equippable. |
| Logia, low-cost civic bulletin and custom Cabildo officer | Implemented | `recruitment.js`, createOfficer/recruitCivic actions and Recruitment controls. One custom officer, three questionnaire answers and four selectable doctrines are supported. |
| Era-appropriate foreign fighters | Implemented | Brown/Bouchard/Paroissien plus explicitly fictional foreign civic volunteers in `recruitment.js`; authored biographies and speech. |
| Important leaders require physical meeting | Implemented | `encounters.js`, `recruitmentStatus`, `talkNPC`; catalogue cannot hire encounter-only figures. San Martín is gated by phase 4; Güemes/Azurduy have regional commitments. |
| NPC leadership/town/quest recruitment | Implemented | `encounterRequirements`, talk action validates local actor, adjacency, leadership, distinct liberated towns and base recruitment gates. Costs charged once; recruited contact removed next visit. |
| Rich NPC conversation | Partial | Friendly/direct/recruit approaches and authored responses exist. Conversations are shallow and mostly static; no extensive branching quest dialogue, social simulation or independent NPC schedules. |
| Distinct personality and Spanish event speech | Implemented | `characters.js`, `character-events.js:withCharacterSpeech`, Battlefield integration supplies contact/clearance/wound/exhaustion/death text. Spoken audio/voice acting is absent. Dramatic text is explicitly identified as interpretation. |
| Historical special abilities | Partial | `tactical.js` ID-based bonuses implement Cabral interception, Paz initiative, Brown/Barcala artillery, Beltrán support, Dorrego mobility, Bouchard night/breaching, Quiroga mounted shock and San Martín command effects. Macacha's full strategic intelligence/ambush neutralization, Paroissien chemistry/attribute-decay prevention, and every named major/minor trait are not complete independent systems. |
| Specialists train militia | Implemented | `militia.js:militiaCourse`, campaign militia/cancelMilitia and hourly tick, Campaign trainer selector and progress display. Leadership shortens courses; Paz, San Martín, guerrilla_tactician and line_marksman confer a further 25% reduction. Trainers cannot leave while assigned; supply loss pauses instruction. `tests/militia-web.test.mjs` covers finite cohorts and persistence. |
| Independent persistent squads, maximum six | Implemented | `squads.js`, createSquad/selectSquad/squad/travel reducer actions and `Squads.tsx`. Co-location matters and remote reassignment is rejected. |
| Travel rather than remote attack teleport | Implemented | Attack requires an adjacent/current sector and consumes travel time; owned routes govern ordinary movement. |
| Every sector enterable and persistent | Partial | Friendly visit and adjacent enemy attack cover every mapped sector; `world.js:enterSector` restores terrain, dropped gear and positions. Hostile entry starts combat mode rather than unrestricted hostile-sector scouting. Tactical elapsed time and strategic time are not a unified continuous simulation. |
| Saving and malformed-save handling | Implemented | `save.js`, `validate-battle.js`, `restoreCampaign`, sector snapshot validation, export/import controls. This is local save persistence, not cloud accounts or server authority. |

## Logistics, equipment and horses

| Requirement | Status | Evidence and precise remaining gap |
|---|---|---|
| Posta, carts and flotilla | Implemented | `logistics.js`, travel/transport/supplyTransfer and `Logistics.tsx`; route availability, finite cargo, capacities, delays and remount costs. |
| Pack saddle adds 40 kg in mountains | Partial | Mule logistics capacity is 80 kg including the 40 kg saddle increment. It is a transport-mode abstraction, not an individually equipped mule accompanying the tactical squad. |
| Field cannons and heavy goods constrain transport | Implemented | Logistics cargo weights and mode restrictions reject unsuitable heavy cargo routes. Naval/pedrero mount-on-vessel presentation remains absent. |
| Finite individual armory and equip access | Implemented | `equipment.js`, purchaseEquipment/equip actions, `Armory.tsx` expose all nine firearms, five blades and three artillery types. |
| Priming/flints/rations, maintenance and refill | Implemented | Tactical repair/reprime/ration, persistent supplies and paid workshop repair/resupply. Surplus recovered supplies are retained rather than reset to kit defaults. |
| JA2-like LBE inventory hierarchy | Partial | Finite inventories, weapon/blade slots, recovered-item UI and tactical loot exist. No full pocket/haversack/equipment-slot layout with item dimensions, container compatibility and all period accoutrements. |
| Individual acquired/rented horses | Implemented | `horses.js:applyHorseAction`, campaign horseAction and `Horses.tsx` provide buy/hire/assign/unassign/feed; identity/location/condition/stamina persist into tactical mounts. |
| Real breeding lifecycle | Implemented | Owned adult parents, cost, 330-day gestation, three-year maturity, feed and rental expiry. UI exposes sire choice; horse tests cover calendar continuation. |
| Riding skill | Partial | Tactical movement/energy formulas read ridingSkill. Individual riding proficiency is not a full player-visible trained attribute/curriculum; supplied historical baseline has no riding stat. |

## Tactical combat and presentation

| Requirement | Status | Evidence and precise remaining gap |
|---|---|---|
| 100-AP firearm tables and prone reload penalty | Implemented | `tactical.js:WEAPONS`, `reloadCost`, `actionCosts`; nine canonical entries and 50% prone penalty. |
| Smoothbore dispersion and rifle advantage | Partial | `shotChance` implements distance caps and range/condition context. Small 20×16 authored maps and sight range 12 normally prevent experiencing the specified 35–50 tile firearm envelope or 80–110 tile artillery envelope. |
| Black-powder smoke | Partial | Firing generates three-turn smoke; sight, accuracy and reactions respond. Clouds have fixed radius rather than expanding volumetric simulation; no wind-driven propagation. |
| Rain/humidity/fouling ignition failure | Implemented | `misfireChance`, `ignitionRisk`, jam/reprime, firearm condition and finite flints. Weather is a simplified scalar/boolean model rather than evolving meteorology. |
| Charge consumes remaining AP and gains 10% per tile | Implemented | Tactical charge enforces straight collision-free path, AP affordability, momentum damage and reaction/interception checks. |
| Sabre bleeding/parry, bayonet reach/interception, lance knockdown, facón defense | Implemented | `meleeStrike`, `interceptCharge`, brace and charge actions. |
| Armor penetration and elaborate morale formation checks | Partial | Damage modifiers, morale loss, routing and weapon dropping work. No layered armor/penetration model or coherent multi-soldier formation with leadership-versus-speed area checks for every charge. |
| Artillery crew, pivot/move, solid/canister, structural breaches | Implemented | `ARTILLERY`, `artilleryCosts`, artillery action branches and Battlefield battery controls. Crew is checked spatially rather than separate loader/gunner jobs. |
| Full artillery effects from specification | Partial | Direct fire and cone casualties exist, but not a 25-tile canister cone, limb-loss model, elevation/bore calculation, mountain howitzer item or naval installation system. |
| Exploration, contact transition and independent motion | Partial | `getReachable`, `detectContact`, `actBattle`, `endTurn`, Battlefield/useUnitMotion. Exploration removes AP movement restriction and contact invokes combat. It remains click-to-path simulation, not a continuously advancing real-time world with autonomous NPC patrol schedules. |
| Walk/run/crouch/prone energy and unconsciousness | Implemented | `movementEnergy`, `exhaust`, movement mode actions, medical/rest recovery and saved energy. AP and energy are distinct. |
| Strength weight limits and strength growth | Partial | `carryCapacity`, `carriedWeight`, encumbrance and strengthTraining exist and persist. Not all fixed kit/clothing weight is counted as independent inventory objects. |
| Sneaking and other practiced skill growth | Missing | Civic combat XP and strength use growth exist; a dedicated sneak-practice progression and general use-based skill-development system were not found. |
| Corpse/unconscious loot and gear conservation | Implemented | Tactical loot/transfer/equipLoot, `RecoveredInventory.tsx`, `ammunition.js:returnAmmunition`, campaign persistence and conservation tests. |
| Recoverable boleadoras | Implemented | Tactical throw/free/recovery actions consume and recover finite objects, entangle/dismount targets; Battlefield item controls. |
| Day/night from strategic time | Implemented | Campaign pending requests carry night/hour; tactical visibility and Battlefield overlay use time-derived night. Resting tactical turns does not fully advance the strategic clock. |
| Torches, lanterns, campfires, occlusion and night-vision | Implemented | `tileIllumination`, `canSee`, light lifetime, throwTorch and map lights; Battlefield rendered visibility. Dedicated illumination tests exist. |
| Walkable buildings, windows and separate door leaves | Implemented | `buildings.js:buildBuilding`, map integration, door actions, `visibleRooms`/revealedRooms and Battlefield roof rendering. No multilevel interiors or complex structure destruction simulation. |
| Proper directional animation | Partial | `useUnitMotion.ts` and Battlefield use directional sprite assets and interpolated paths. Source existence does not establish visual quality, complete action transitions or JA2-level facing/occlusion fidelity; browser review is still required. |
| Familiar adapted hotkeys | Partial | Battlefield binds Space, R, M, F and 1–6 with input/dialog guards. This is a small subset of the supplied JA2 hotkey reference. |
| All Spanish game content | Partial | Authored narrative, controls and dossiers are Spanish. A systematic final error/empty-state/a11y/browser audit remains necessary; English engine identifiers and documentation are intentionally retained internally. |

## Acceptance risks and next work

The largest substantive gaps are tactical militia garrisons; full historical equipment/LBE; deeper faction consequences; use-based skill progression; naval missions; narrative set pieces; and scale sufficient to exercise long-range ballistics. These should not be masked by adding more labels or biographies.

The browser has visible entry points for the desk, squads, local NPC talk, armory, logistics, recovered inventory and horses. Nevertheless, code wiring is weaker evidence than successful player interaction. In this worker's most recent UI attempt, CUA returned no browser surfaces and rejected creation of a hidden in-app tab. Therefore this audit does **not** assert that every control was browser-tested, that all layouts work at every viewport, or that the horse purchase/assignment/feed acceptance sequence has been visually verified. Parent-agent browser QA may provide separate evidence.

Focused campaign, encounter and horse tests passed during the preceding implementation work, including real reducer progression and post-victory breeding. Tests do not demonstrate all original requirements or historical fidelity. The original specification also contains historical assumptions and anachronistic equipment descriptions; implementing them is distinct from independently validating their historical accuracy.


## 0.3.0 continuation evidence (2026-09-05)

The original table above records an earlier snapshot. The following gaps now have
additional authoritative implementation:

- Tactical militia: game/garrison.js plus campaign/world integration, finite
  issued ammunition, stable IDs, injuries, casualty counts and lootable corpses.
  tests/garrison-web.test.mjs covers actual tactical returns. Browser training
  and entry displayed three local militia, separate from the hired squad.
  Formation doctrine and autonomous formation AI remain incomplete.
- Practice: game/skill-training.js already contained sneaking; its earlier
  'Missing' designation was stale. Riding now progresses, and both retain unique
  practiced tiles across sector re-entry. TrainingProgress is visible in game.
- Factions: docs/FACTION-POLICIES.md records real import pricing, weekly tax
  decisions, neglect penalties and frontier agreement consequences. Privateering
  and full estate livestock simulation remain incomplete.
- Hotkeys: docs/TACTICAL-HOTKEYS.md lists expanded controls with actual input
  guards and Spanish help. This is an adapted set, not modern JA2 feature parity.
- Ending speech: living companions emit authored lines once at actual campaign
  completion; ending-speech tests check event coverage and no repeats.

Full suite: 209 passed; types and export pass. This is progress toward the full
objective, not its completion certificate.
