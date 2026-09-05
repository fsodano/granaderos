# Browser campaign systems

The requested delivery target is now a browser game. `game/campaign.js` is the strategic reducer; `game/data.js` contains authored Spanish game content. Source code and these documents remain English. This implementation reuses the requested historical structure and JA2-inspired data/mechanics; it does not execute the Windows JA2 binary in a browser.

## Source references

- User-provided **GRANADEROS: Jagged Alliance 2 Engine Historical Conversion Specification**, sections 1 (five-phase San Martín arc and six factions), 2 (recruitment, stipends, transports, foundries, economy and militia), 4 (thirteen sector table, supply routes, biomes and strategic AI), 5 (thirteen operatives), and 6 (weapons and equipment). The original supplied attachment is the authoritative requested design. Map grid labels are the specification's campaign references, not real geographic coordinates.
- Pinned [JA2 v1.13 source](https://github.com/1dot13/source/tree/ddb691318eb3dd0cdc6eab42139739b6d498c645): `gamedir/Data-1.13/TableData/Items/Weapons.xml`, `Items.xml`, `Magazines.xml`, `MercProfiles.xml`, and `Inventory/MercStartingGear.xml` informed weapon/profile field separation and ammunition capacity semantics. The `EXP` specification attribute means explosives skill, not experience level.
- The prior native data conversion and generator remain in `mod/` and `tools/generate_campaign.py` as historical work. They are not required for the browser game. Native engine language tables lack Spanish; browser strings are authored directly in Spanish.

## Strategic state and commands

`initialCampaign(seed)` creates a serializable state. `dispatchCampaign(state, action)` clones before mutation; rejected commands return the original values and a Spanish `lastError`. `campaignObjectives`, `recruitmentStatus` and `isSupplied` expose derived information. State uses numeric operative IDs and semantic sector IDs. Tactical results may report string IDs and are normalized.

The starting date is 1 March 1812. The simulation uses explicit thirty-day months and a 360-day year. `campaignDate` returns a calendar display; southern winter closes mountain travel in June–August. Recruitment and salaries use monthly stipends, computed by rounding the specification's weekly motivation figures times30/7; Güemes, Azurduy and San Martín have no monetary stipend. Monthly payroll occurs every720 campaign hours. Recruiting advances a month's stipend; troops already present at campaign start first draw pay on day30. Calendar-wide payroll does not yet prorate late-month inductions.

The capital, Retiro and Ensenada start under Patriot control. Ten other sectors require tactical victories. A breadth-first search through controlled adjacent sectors determines supplies from Buenos Aires. Reoccupation breaks links, reduces isolated income, and suspends workshop completion. The strategic grid preserves all thirteen requested named sectors across the four theaters. San Lorenzo is a separate historical encounter unlocked by Retiro and control of San Nicolás; it is not substituted for one of the thirteen sectors.

The five phases require actual state:

1. Retiro consumes20 horses,40 muskets,60 textiles and300 pesos.
2. San Lorenzo requires a won tactical encounter.
3. Yatasto requires liberated Tucumán, a supplied Salta, and the northern autonomy pact.
4. El Plumerillo requires Beltrán's funded foundry, a parliament,3000 equipped infantry,3 cannons, and fortified Patriot control of Mendoza/Uspallata/Los Patos.
5. San Martín becomes recruitable. Completion additionally requires all thirteen sectors liberated and no blockade or pending battle.

Each200-man infantry production order consumes200 muskets and200 uniforms. Uniforms require textiles; cannons require copper; muskets are reconditioned in batches of50. Workshops process up to three concurrent orders. Contraband shipments arrive after a deterministic seeded delay of72–120 hours and wait offshore during blockade or enemy control of Ensenada. Daily provincial revenues supply silver and raw materials. Military payroll and industrial expenses compete for those resources.

All six faction standings exist, with Royalists permanently hostile. Northern supply/autonomy, emancipation and commissions, merchant dealings, Indigenous gifts/parliaments, and requisitions affect the corresponding standings. Regional events gate officer recruitment. Militia has three ranks; defenses combine militia, forts and local troops. Northern invasions prioritize the Humahuaca corridor; coastal pressure responds to developed customs income; low-loyalty Córdoba can suffer interior raids. Raids damage regional income for fourteen days. Defended raids are repelled without ownership changes.

Postas consume remounts and travel faster; the flotilla requires an unblocked coastal path; carts travel slowly. Ordinary travel observes controlled routes and winter closure. Supply/fatigue influence the campaign state and daily recovery.

## Tactical handoff and ammunition conservation

`attack` creates `pendingBattle` with a unique ID, seed, biome, weather, squad records and available artillery. It issues at most ten cartridges per firearm user from the actual shared stock, including loaded rounds. Zero-stock deployments have zero loaded/reserve rounds and must use cold steel. Each troop carries weapon and blade references; horses and ponchos are assigned only if stock supports the squad.

`battleResult` requires the matching pending ID and accepts `victory`, `defeat`, or `retreat`. Reports contain `id`, `hp`, `loaded`, and `ammo`. Returned ammunition is capped by each soldier's issued quantity and the total issued stock. Missing or dead soldiers return no ammunition. Combat losses persist and can end the campaign. Liberation of an enemy sector grants captured supplies; lifting a blockade in an already controlled sector does not grant another capture bounty.

## Verification and remaining fidelity

`node --test tests/campaign-web.test.mjs` covers immutable orders, purchase rollback, phase/recruit gates, stock and production timing, blocked shipments, supply cutoffs, raids, stale tactical outcomes, persistent casualties, ammunition conservation, monthly payroll, save schema rejection and deterministic reload. The complete-campaign test uses only reducer orders, timed production, and tactical victory events to reach all five phases, equip3000 infantry, recruit San Martín and finish within120 simulated days. Tactical victories in this strategic integration test are injected event results; it does not prove a human can win every battle or replace browser playtesting.

Saves are schema-checked for bounded resources, sector state, roster membership, health, diplomacy, jobs, shipments and pending battle structures. Validation rejects malformed states; it is not anti-cheat cryptographic signing.

The campaign is an abstraction of the specification. Attack deployment currently requires access to an adjacent supplied friendly sector but does not itself advance a travel clock. Province-wide transport capacity, horse breeding/stamina, food/water, distinct raw-lead/saltpeter/timber industries, playable naval vessels, historically authored individual battle maps, and treaty betrayal counter-raids remain simplified or absent. Normal transport is implemented; the full ship and pack-animal simulation is not. All three artillery definitions exist in data, but verify tactical/UI integration before claiming all three usable. Named historical traits require the corresponding tactical effects rather than their narrative descriptions alone. Monthly payroll proration, historical authenticity review, extended balance testing and complete visual/audio fidelity remain outstanding.

## Cabildo examination and civic bulletin

`game/recruitment.js` exports `OFFICER_QUESTIONS`, `OFFICER_TRAITS`, `CIVIC_RECRUITS`, `civicStatus(state,id)` and `rosterFor(state)`. UI consumers must resolve soldiers through `rosterFor`, not the immutable historical `OPERATIVES` array. The returned roster includes the thirteen unchanged historical profiles, three civic volunteers, and an optional custom officer. Dynamic roster IDs remain numeric: civic100–102; officer1000.

`createOfficer` accepts `{name, answers:{origin,doctrine,crisis}}`. Question definitions enumerate all permitted answers. The examination charges300 pesos and can create one officer. Origin and crisis answers affect bounded attributes; doctrine selects one of four implemented trait identifiers: `cavalry_commander`, `guerrilla_tactician`, `gunsmith_artillerist`, `line_marksman`. Names reject markup/control characters and are limited to30 characters. The stored examination answers reconstruct the custom profile deterministically.

`recruitCivic` accepts `{id}`. The three original fictional volunteers enter through their liberated municipal bulletins for monthly stipends of180–220 pesos. They begin with lower combat statistics. Surviving a victory grants60 experience, defeat20, retreat10. Every100 experience increases their level, up to10; marksmanship increases by4 and other primary attributes by2 per level, capped at95. Growth changes the actual squad records dispatched into subsequent battles. Historical profiles retain the exact supplied statistics.

Version1 saves without these fields migrate with no historical stat changes. Reload validates examination answers and bounded experience. Tactical result reports may additionally contain `priming`, `flints`, `rations`, `condition`, and `fatigue`; these values persist into the next battle rather than resetting field supplies. Reported values are range-checked. UI handoff must include these fields to preserve consumption.

`tests/recruitment-web.test.mjs` verifies all four doctrine selections, questionnaire validation, duplicate prevention, regional civic availability, purchase costs, growth entering actual subsequent battle requests, field-supply persistence, and legacy migration.

## Royalist commands and narrative intelligence

`game/narrative.js` implements the antagonist hierarchy from specification sections1 and4. The Crown council names Elío and Vigodet; Pezuela directs the Northern Army with Tristán's vanguard; Romarate directs the river flotilla; local Loyalist cadres direct interior sabotage. These figures command formations rather than appearing as repeatedly resurrected combat casualties.

`royalistIntel(state)` returns command definitions with current target, objective, doctrine, activation and hours until the next strategic action. `mentorDispatch(state)` returns San Martín's phase-specific advisory text and deployability. These messages are original dramatic game dialogue, not documented historical quotations. The Yatasto transition sets the persistent mentoring flag and redirects strategic preparation to Cuyo.

Northern attacks every120 hours select the first Patriot-controlled sector in the ordered Humahuaca→Jujuy→Salta→Tucumán corridor. A defended border blocks the advance; the AI cannot skip it to raid softer targets farther south. Every168 hours, Romarate evaluates actual daily coastal revenue rather than counting provinces; income of at least500 pesos attracts a raid against the most valuable Patriot port. The resulting blockade reduces the revenue that motivated the raid. Low-loyalty Córdoba is vulnerable every144 hours: an undefended partisan raid seizes the real supply junction and removes up to150 pesos and20 powder, disrupting both northern and Cuyo logistics.

Battle requests carry `enemyCommand`, `enemyCommander`, `enemyObjective` and authored enemy troop identities. Map generation preserves those identities. `tests/narrative-web.test.mjs` tests the timed ordered advance, non-skipping defended front, revenue-triggered naval suppression, convoy resource losses and actual supply cutoff, troop identities and all mentorship phases.

## Cargo transport and depots

`game/logistics.js` exports `TRANSPORT_OPTIONS`, `transferOptions(state,source,destination)`, `inventoryAt(state,id)`, `cargoWeight(goods)` and `convoyStatus(state,convoy)`. Sources/destinations are sector IDs or `reserve`, the existing global inventory represented at Buenos Aires. `supplyTransfer` accepts `{source,destination,mode,goods:{resource:quantity}}`. Cargo is removed exactly once when dispatched, retained in `state.convoys` in transit, and added to the destination depot only after its travel time and an open controlled path. A blockade or captured route suspends delivery. Reversing a shipment returns existing inventory; it does not create resources.

Postas carry30kg and consume a remount per leg. Carts carry1000kg; the flotilla carries4000kg and requires an open coastal route. Cannons weigh500kg in the strategic cargo model and require carts or ships. Mules with a6kg pack saddle have40kg base capacity plus the specified40kg extra. High Andean paths reject carts and close during winter. `transport` accepts the additional `mules` mode for120 pesos and two animals from the campaign mount pool.

`state.depots[sectorId]` stores delivered goods. Local depot ammunition and artillery are available in battle requests from the current location. Returned tactical ammunition joins the campaign reserve; the global inventory abstraction still covers ordinary production and ongoing upkeep. Horses and infantry move through their own campaign systems and cannot be shipped as cargo. Cargo weights other than the specified saddle extension are gameplay balancing values, not detailed historical wagon manifests.

Version1 saves migrate missing depots, convoy queues and mule routes. The logistics tests verify finite removal/delivery, return transfers without duplication, blocked routes, weight limits, remount consumption, cannon restrictions, mule capacity, high-pass constraints, fluvial blockades, local tactical stock and save migration. `web/app/Logistics.tsx` is an independent Spanish UI with source/destination selectors, live cargo weights, route organization, depot inventory and convoy status.

## Armory and camp maintenance

`EQUIPMENT_CATALOG` exposes all nine firearm models, five blades and three artillery models with explicit simulation prices. `purchaseEquipment` deducts silver and adds finite spare stock. `equip` requires an available owned item and returns the previous item to the armory. `rosterFor` applies equipment overrides without changing historical attributes. `configureArtillery` selects up to three owned pieces by canonical `bronze4`, `field8`, `swivel` identifiers; these types enter the actual tactical request. Foundry products and older saves retain the bronze4 baseline.

`resupply` restores missing priming charges, four flints and two rations for a proportional charge; `repairWeapon` restores weapon condition for1.5 pesos per missing condition point. Both require the soldier's active camp at an owned, supplied Retiro/Córdoba/Mendoza workshop. Prices are gameplay balancing values, not historical market-price claims. `Armory.tsx` provides buying, equipment selection, artillery preparation and camp maintenance.

## Persistent squads and local sector visits

`state.squads` holds up to eight independent units of at most six members, each with a name and sector location. `activeSquadId` selects the unit receiving orders; legacy `squad` and `location` fields remain synchronized aliases for existing UI consumers. `createSquad`, `selectSquad` and `squad` rearrange only personnel physically present together. Removed personnel retain their reserve location. `operativeLocation` resolves both assigned and reserve personnel. Version1 single-squad saves migrate to one persistent formation.

An attack now requires the active unit to occupy a neighboring sector; direct remote deployment is rejected. Entering the frontier costs twelve hours and updates the unit's actual location. Retreat restores its origin. Travel through friendly terrain updates only the selected unit and stops if a raid cuts the route while marching. Garrison defense and daily recovery consult actual squad/member locations. Integration tests were updated to issue genuine travel orders before attacks; no compatibility bypass weakens adjacency.

`visitSector` opens the current friendly location as a tactical exploration request with no artificial enemies or capture reward. `leaveSector` requires the matching visit ID, a bounded tactical snapshot and survivor reports. `sectorStates[sectorId]` preserves the terrain, local objects and inhabitants for the UI to restore on later entry. Personal energy, field supplies and finite recovered inventory persist between visits. Normal conquest results may also supply a sector snapshot. Snapshot validation checks dimensions, unique tile coordinates, supported terrain types, array shapes and bounded unit positions before storage; the outer save package additionally performs its full tactical validation.

`Squads.tsx` exposes independent unit cards, co-located formation, travel, sector entry and a full personnel/location table. Tests cover independent movement, non-teleporting reassignment, strict attack adjacency and time, retreat, persistent friendly visits without rewards, finite recovered objects, legacy migration, duplicate assignment rejection and malformed terrain rejection.

## Local encounters and important leaders

`game/encounters.js` defines separate tactical NPCs, not enemy units. Every strategic sector has a local interlocutor; Beltrán, Paz, Brown, Macacha, Güemes, Azurduy, San Martín and the civic volunteer Sosa have personal recruitment encounters. Important leaders cannot be hired through the desk catalog. San Martín appears as a mentor in Mendoza and will join only after the existing El Plumerillo gate is complete, the interlocutor meets the leadership threshold and enough distinct localities are secure. Buenos Aires/Retiro count as one locality for these thresholds.

`talkNPC` requires an active visit or cleared field, a valid tactical snapshot, a living player interlocutor, physical adjacency, and a known local NPC. Friendly/direct approaches expose authored dialogue and conditions. Recruitment checks the actor's real campaign leadership, municipal control and distinct-locality count plus the operative's pre-existing faction/quest gate. Pay is charged once; the recruit enters the current squad if space is available or remains at that locality in reserve. `lastConversation` exposes speaker, text, available approaches and outcome for the UI. Recruited figures disappear from subsequent encounter lists. The complete-campaign integration test now physically travels to Mendoza, moves a tactical actor adjacent to San Martín and talks to recruit him; it has no registry bypass.

Friendly visits issue cartridges from finite reserve/local stock and return unused rounds. Tactical returns with validated snapshots may credit recovered enemy ammunition only against depleted corpse/unconscious-enemy sources; reports must agree with the actual tactical unit. Field-item counters tolerate legitimate loot exceeding a standard kit, while refill only fills deficits. Actual trained strength and strength-training progress persist without resetting on reentry.

## Individual mounts

`horseAction` adapts `game/horses.js` into the campaign using `{order:{type,horseId?,operativeId?,name?,sex?,days?,sireId?}}`. Funds and location come from authoritative campaign state, not caller claims. Buying, hiring, feeding and breeding deduct actual silver; assignment requires co-located horse and rider. Named mounts are distinct from the aggregate `resources.horses` remount pool used by transport logistics and strategic agreements.

The campaign clock advances feed, condition, rental expiry, gestation and maturity. Assigned mounts follow their squad when marching and spend stamina. Only individually assigned horses enter tactical loadouts; survivor mount stamina/condition return to the same persistent horse. Gestation takes330 days and maturity three years, preserving real temporal progression rather than creating instant adults. Older saves migrate without inventing individually owned mounts. Horse ownership, bounded health, calendar values and unique IDs are validated at load time.

### Foreign volunteer catalogue

Morel and Doyle are explicitly fictional paid volunteers with maritime gunner and sailor backgrounds. Their roles are a design inference from documented foreign and corsair service, not claims about real people or an organized mercenary marketplace. Historical context: https://sanmartiniano.cultura.gob.ar/noticia/aportes-a-las-acciones-maritimas-sanmartinianas/ . They use the existing finite stipend and provincial recruitment system, with their own attributes, personalities and seven Spanish speech events.

## Empty start, prepaid contracts and civic cities (2026-09-05 redesign)

`initialCampaign()` now starts with an empty hired roster and an empty first squad. It does not grant Cabral, Dorrego or Paroissien. Character creation accepts `{type:'createOfficer',name,answers,profile}`; profile is the version-2 class/portrait/550-point object validated by `character-profile.js`. The custom officer serves permanently. Old saves retain their actual roster and acquire explicit `legacy` service records without retroactive fees.

The paid desk roster consists of fictional civic volunteers; regional occupation does not hide their contract offers. `recruitCivic {id,term}` pays in advance for `day` (24 hours), `week` (168) or `month` (720). The default is a day. `contractQuote(state,operative,term)` returns availability, reason, price, hours and elite status. Daily rates round up from monthly baseline, with 10% increases per 100 combat XP. Explicit elite profiles, marksmanship 90+, or level 5+ accept one-day terms only. These are disclosed game-balance rules, not historical wage claims.

`renewContract {id,term}` extends the existing expiry using a fresh experience-dependent quote. `dismiss {id}` ends service without refund; the player's officer cannot be dismissed. At expiry, the volunteer leaves hired lists and squads, stops militia instruction and releases any assigned horse. Personal gear remains with that service record; rehiring does not refill supplies or create another loadout. No automatic renewal charges apply. Legacy service alone retains the old monthly-payroll model. Time is currently advanced strategically; an open tactical sector pauses strategic expiry.

Historical figures are physical NPC contacts, never paid desk hires. All thirteen now have encounter locations and retain their campaign/leadership prerequisites. Their new agreements are permanent `patriot` service. Remaining contacts added in this revision place Cabral at Retiro, Dorrego and Paroissien in Buenos Aires, Bouchard in Ensenada, Barcala in Mendoza and Quiroga in Córdoba. These meeting placements are game-design abstractions, not a dated historical itinerary.

Militia training additionally requires an eligible populated city: all its grouped sectors must be Patriot-controlled and average loyalty must reach 50%. Rural passes are ineligible. Courses pause when civic eligibility is lost. `cities.js` records stable quest and battle events once, applying regional loyalty changes for actual outcomes. Teacher speciality shortens training in addition to leadership and tactical-doctrine bonuses.

`tests/contracts-web.test.mjs` exercises the real empty-start/profile/hire/travel/visit/save flow. Older subsystem tests explicitly import `tests/legacy-campaign-fixture.mjs` to test continuity of established pre-redesign saves; that helper is not used by runtime code. Full-campaign legacy integration remains a separate regression, not proof that the new opening has been browser-accepted.

### Physical NPC errands

`quests.js:questForNPC(state,npcId)` exposes three authored requests: Retiro's sergeant needs 10 textiles, San Nicolás's postmaster needs 5 powder, and Macacha needs 5 muskets plus 2 reserve remounts after Salta and Jujuy are secured. These are individual narrative errands, separate from the global diplomacy flags.

An adjacent `talkNPC` with `approach:'quest'` first records an offer without consuming goods. A second physical conversation delivers exact goods only when the conditions and inventory suffice. Completion raises the associated city's loyalty by eight once, using a stable event identifier; repeat completion is rejected and cannot charge or reward again. `state.quests` preserves offered/completed stages and timestamps and is validated on restore. The dialogue options advertise `quest` while unfinished. Macacha's request should be completed before recruiting her, as recruited historical contacts leave the local NPC list. These are designed game errands rather than authenticated historical orders.

### Tactical militia garrisons

`garrison.js:prepareGarrison` reconciles trained regional militia with persistent local soldiers, using distinct rank statistics and stable numeric IDs starting at 20000. `pendingBattle.garrison` contains these allied units only when the destination is Patriot-controlled: friendly exploration and defense against a coastal blockade. Militia do not accompany an offensive squad to a different province. Up to 60 local soldiers can deploy; larger legacy counts remain strategic reserves.

`world.js:enterSector` places the garrison collision-free alongside the hired squad. These are actual player-side tactical combatants marked `militia:true`, with rank-specific morale and weapons, rather than map decorations. Initial cartridges are deducted from campaign stores; health, ammunition, condition and recovered inventory persist on return. `returnGarrison` requires a complete validated tactical snapshot, removes actual dead defenders from strategic counts and preserves surviving identities. Their corpses remain in persistent sectors for looting. Training promotions return unspent cartridges when replacing a rank; occupation disperses the local roster.

`tests/garrison-web.test.mjs` trains militia through actual orders, enters and returns twice without regenerating ammunition, runs a real enemy phase that kills defenders, then saves/re-enters and verifies those dead IDs do not become living soldiers. The three-rank doctrine remains a stat/equipment distinction; autonomous formation squares and a separate allied AI command system are not implemented.
