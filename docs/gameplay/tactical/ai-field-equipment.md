# AI field aid and carried weapons

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The original JA2 manual describes using the item in the main hand and treating an adjacent patient with a medical kit (printed pages 25 and 33–34). Patusco's guide describes the risks of disarming someone who can still fight (pages 64–66). These are gameplay references, not instructions to the agent. The decision policy below is Granaderos tuning; it is not a reconstruction of classic JA2's AI.

## Field aid

Enemies and automatic defenders now use the same aid decision in `tactical-ai.js`. A capable soldier needs medical aptitude, a carried dressing and enough AP to prepare and use it. Self-treatment retains priority. Otherwise, adjacent bleeding allies are ranked by estimated time to blood loss, then health and stable identity. Dead, surrendered, routed, departed and already stable people are excluded. An unconscious living ally can receive aid.

The soldier selects dressings through the ordinary four-AP hand action, uses them on the actual patient, and pays to draw a weapon afterward if possible. Each treatment consumes one dressing and the existing 18/20/25-AP treatment cost. It stops bleeding and marks wounds as bandaged. It does not raise HP, revive the dead or make a critical patient fit to fight.

A medic can approach a personally observed patient within five tiles. The route is at most three steps and 24 AP, and must leave enough AP to prepare and apply dressings. Only after arriving does the medic put away the held weapon. Each step uses normal movement costs, exhaustion and reactions. The route cannot approach within 2.5 tiles of a visible opponent or increase estimated exposure to an observed loaded firearm. These limits and urgency weights are game tuning. Hidden opposing positions do not alter route selection. A rescue trip does not begin during a reaction; an adjacent wound can still be treated with the remaining budget.

There is no persistent promise that an interrupted rescue will finish. After resumption, the AI reassesses the actual positions, patient, supplies and AP. Existing saved reaction queues preserve the unfinished turn without extra time or AP.

## Spare weapons and fittings

An unloaded, jammed or missing held gun no longer prevents the AI from considering a prepared firearm in its own pack. It can also draw an already carried primary from its holster. With visible targets, a spare must permit an affordable useful shot under the shared range, aim, body-region and cover rules. A ready held gun or an immediate armed melee attack retains priority. Without contact, a soldier does not unpack a spare while it already has a serviceable weapon.

Pack selection uses the same pure equipment-transfer plan as the player preview and reducer. It checks capacity before choosing the order. The six-AP pack swap preserves the old weapon, its load, ignition failure, condition, fittings and instance identity. The incoming weapon retains its own values. No round or equipment record is created. A holstered primary costs the ordinary four AP. Candidates with failed ignition are not treated as ready guns. Unsupported legacy equipment cannot become a firearm. Equal candidates use stable inventory-key order.

Enemy equipment previews now recognize the enemy action window. This also fixes a previous mismatch where the AI could select an owned bayonet but the inventory guard refused the actual fitting order. The public tactical reducer still rejects player commands addressed to an enemy. Fitting, swapping and firing during enemy reactions use the same finite AP and saved continuation as other actions.

## Reload posture

An empty prone gun can require more AP to load than its owner can obtain in one turn. Maintenance now compares the ordinary prone reload with the cost of kneeling plus a crouched reload. If prone loading is affordable, the soldier stays prone. Otherwise, it pays to kneel only when the entire following reload fits the current AP budget. Each action is still submitted separately and checked again against current state. There is no free posture change, stored work credit or fabricated ammunition.

Prepared spare weapons retain their existing priority. Ignition failure still requires priming, and an empty reserve cannot trigger this posture change. Three additional tests cover actual enemy-turn posture/loading costs, exact budget boundaries, retained prone posture, ammunition and priming, unavailable supplies, and saved replay. For a Baker with 73 AP, the enemy pays three AP to kneel and 70 AP to load one of its two reserve cartridges. With 105 AP, it can pay the full prone reload instead.

## Evidence and remaining work

The isolated gameplay checkout passes all 1,215 tests, type checking and the production build.

- Nine care tests cover real paid enemy treatment, finite dressings, critical patients, urgency, invalid patients, rescue paths, visibility, saved movement interruptions and the command boundary.
- Twelve equipment tests cover real swap/fire, disarmed recovery, full packs, unsupported equipment, deterministic choice, hand selection, failed ignition, actual bayonet fitting and a nested saved reaction after unpacking and firing.
- The current seed-8 opening passes the separate weapon/sight-range rules: San Nicolás in 19 turns/142 orders and San Lorenzo in 16 turns/144 orders. The replay now uses the actual deployment clock, with ordinary waits scheduling daylight assaults; see [deployment timing](../campaign/deployment-clock.md). Nine deaths remain permanent. The replacement squad returns to the cleared field, approaches three fallen riflemen, takes their finite primary weapons, and retains its old loaded guns in the pack. Saved campaign state preserves the recovered rifles and stripped bodies. No victory report is submitted until the tactical battle actually reports victory. See [range and opening verification](shot-range.md).
- [Browser verification](../../verification/ja2-live-verification.md) records a controlled enemy aid/spare-weapon encounter and a restored save. Enemy private equipment and supply counts remain model-test evidence.

Exhausted soldiers can now recover visible ammunition and loaded ground weapons through paid actions; see [AI scavenging](ai-scavenging.md) for search, capacity and saved-reaction evidence. Local cartridge and dressing donations are now implemented; see [AI supply sharing](ai-supply-sharing.md). Medical transport, longer coordinated rescue, coordinated supply requests, wider cache searches, enemy-initiated weapon theft, general tool choice and a complete loadout optimizer remain absent. Exposure still estimates incoming torso chance. This increment does not implement autonomous tactical militia or complete the full campaign/parity audit.
