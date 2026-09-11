# AI field aid and carried weapons

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

## Evidence and remaining work

- Nine care tests cover real paid enemy treatment, finite dressings, critical patients, urgency, invalid patients, rescue paths, visibility, saved movement interruptions and the command boundary.
- Nine equipment tests cover real swap/fire, disarmed recovery, full packs, unsupported equipment, deterministic choice, hand selection, failed ignition, actual bayonet fitting and a nested saved reaction after unpacking and firing.
- The seed-8 opening campaign passes with actual orders: San Nicolás in 11 turns/131 orders and San Lorenzo in seven turns/97 orders. Dead IDs 123 and 107 in the first battle and 110 and 115 in the second remain dead. Care, replacement contracts, recovered supplies and reserves use existing campaign actions. The test driver now excludes jammed weapons from fire and reload orders; the production rules are unchanged by that correction.
- [Browser verification](ja2-live-verification.md) records a controlled enemy aid/spare-weapon encounter and a restored save. Enemy private equipment and supply counts remain model-test evidence.

Medical transport, longer coordinated rescue, cross-soldier supply requests, scavenging, enemy-initiated weapon theft, general tool choice and a complete loadout optimizer remain absent. Exposure still estimates incoming torso chance. This increment does not implement autonomous tactical militia or complete the full campaign/parity audit.
