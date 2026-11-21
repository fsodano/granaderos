# AI field aid and carried weapons

During turn-based combat, computer-controlled enemies and autonomous defenders can apply carried medical dressings to themselves or bleeding allies, draw spare weapons from their packs or holsters, fit owned bayonets, and kneel when a prone firearm reload would exceed their action-point budget. The [original JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf) describes using the item in the main hand and treating an adjacent patient with a medical kit (printed pages 25 and 33–34). Patusco's guide ([G64–66](../../requirements/ja2-parity.md#scope-and-evidence)) describes the risks of disarming someone who can still fight. These are gameplay references. The decision policy below is Granaderos tuning; it is not a reconstruction of classic JA2's AI.

## Field aid

Enemies and automatic defenders use the same aid decision in `tactical-ai.js`. A capable soldier needs medical aptitude, a carried dressing and enough AP to prepare and use it. Self-treatment retains priority. Otherwise, adjacent bleeding allies are ranked by estimated time to blood loss, then health and stable identity. Dead, surrendered, routed, departed and already stable people are excluded. An unconscious living ally can receive aid.

The soldier selects dressings through the ordinary four-AP hand action, uses them on the actual patient, and pays to draw a weapon afterward if possible. Each treatment consumes one dressing and the existing 18/20/25-AP treatment cost. It stops bleeding and marks wounds as bandaged. It does not raise HP, revive the dead or make a critical patient fit to fight.

A medic can approach a personally observed patient within five tiles. The route is at most three steps and 24 AP, and must leave enough AP to prepare and apply dressings. Only after arriving does the medic put away the held weapon. Each step uses normal movement costs, exhaustion and reactions. The route cannot approach within 2.5 tiles of a visible opponent or increase estimated exposure to an observed loaded firearm. These limits and urgency weights are game tuning. Hidden opposing positions do not alter route selection. A rescue trip does not begin during a reaction; an adjacent wound can still be treated with the remaining budget.

There is no persistent promise that an interrupted rescue will finish. After resumption, the AI reassesses the actual positions, patient, supplies and AP. Existing saved reaction queues preserve the unfinished turn without extra time or AP.

## Spare weapons and fittings

An unloaded, jammed or missing held gun does not prevent the AI from considering a prepared firearm in its own pack. It can also draw an already carried primary from its holster. With visible targets, a spare must permit an affordable useful shot under the shared range, aim, body-region and cover rules. A ready held gun or an immediate armed melee attack retains priority. Without contact, a soldier does not unpack a spare while it already has a serviceable weapon.

Pack selection uses the same pure equipment-transfer plan as the player preview and reducer. It checks capacity before choosing the order. The six-AP pack swap preserves the old weapon, its load, ignition failure, condition, fittings and instance identity. The incoming weapon retains its own values. No round or equipment record is created. A holstered primary costs the ordinary four AP. Candidates with failed ignition are not treated as ready guns. Unsupported legacy equipment cannot become a firearm. Equal candidates use stable inventory-key order.

Enemy equipment previews recognize the enemy action window, so an AI bayonet selection and the inventory guard agree on the fitting order. The public tactical reducer still rejects player commands addressed to an enemy. Fitting, swapping and firing during enemy reactions use the same finite AP and saved continuation as other actions.

## Reload posture

An empty prone gun can require more AP to load than its owner can obtain in one turn. Maintenance compares the ordinary prone reload with the cost of kneeling plus a crouched reload. If prone loading is affordable, the soldier stays prone. Otherwise, it pays to kneel only when the entire following reload fits the current AP budget. Each action is still submitted separately and checked again against current state. There is no free posture change, stored work credit or fabricated ammunition.

Prepared spare weapons retain their existing priority. Ignition failure still requires priming, and an empty reserve cannot trigger this posture change. For a Baker with 73 AP, the enemy pays three AP to kneel and 70 AP to load one of its two reserve cartridges. With 105 AP, it can pay the full prone reload instead.

## Limits

Enemy decisions still estimate incoming torso chance for exposure. Medical transport,
longer coordinated rescue, coordinated supply requests, wider cache searches,
enemy-initiated weapon theft, general tool choice and a complete loadout
optimizer remain outside this policy. Autonomous tactical militia are separate.

Exhausted soldiers can recover visible ammunition and loaded ground weapons
through paid actions; see [AI scavenging](ai-scavenging.md). Local cartridge and
dressing donations are handled by [AI supply sharing](ai-supply-sharing.md).
