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
