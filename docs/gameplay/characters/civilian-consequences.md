# Civilian combat and campaign consequences

On the tactical battlefield and strategic campaign ledger, civilian residents can take physical damage from attacks, refuse cooperation when wounded by player soldiers, and change local town support when killed. See [parity requirements](../../requirements/ja2-parity.md) S09 (civilians and quests affecting civic support and territorial cooperation). Civilian factions, morale and quest consequences remain partial.

## Controls and physical damage

Civilian residents enter assaults and defenses as well as peaceful visits. A firearm aim click on a visible civilian fires at that person's ground point. Right-click changes aim; left-click fires or attempts the existing empty-weapon reload. The point has fixed height, no body selector and no claim of a confirmed hit chance. Movement and talk modes retain ordinary conversation. Knives and grenades also use a ground point; an unrelated soldier with the same ID cannot redirect the action.

Bullets, thrown knives, blunderbuss pellets, solid cannon shot, canister and grenade blasts can strike civilian bodies. Physical collision includes hidden residents; public previews include only observed people. The damage path does not create soldier inventory, award hit or casualty experience, or add militia kills. Knives that strike civilians return to supported ground as the same finite item. Corpses and departed residents do not take another hit. Civilian reactions cannot change posture before the initiating impact reaches them.

The first surviving wound caused by a player soldier makes the contact refuse conversation and requested gifts. It does not itself reduce town loyalty. Later health and energy loss still reaches a named recruit's service record. Death prevents recruitment. A harmed contact who enters service retains that history through dismissal, contract expiry and later death as a soldier.

## Civic effects and persistence

The campaign acknowledges each person's first player wound and death at most once. Sector, scene and person identify the record. Reports and saves must preserve issued residents and existing incidents. A rejected report changes no campaign state. Legacy injuries without an incident do not receive retroactive blame.

These are integer **Granaderos balance values**, not JA2's internal numeric scale:

| Responsible party | Intentional death | Accidental death |
| --- | ---: | ---: |
| Player soldier | -10 | -5 |
| Allied militia | -7 | -4 |
| Enemy in a patriot-held town | -3 | -1 |
| Enemy in a royalist-held town | +10 | +5 |

The affected town uses its control at the first acknowledgment. Unknown sources and rural locations have no civic modifier. A local trap without a known attacker does not invent player blame. Anonymous campaign messages do not disclose an unseen person's name, coordinates or attacker. A later victory adds the existing victory reward; capture does not force loyalty up to 50 or erase previous losses.

Named contacts use their actual lower health and energy when hired. A validated service transfer prevents an old civilian record from demanding that the person reappear after dismissal or a soldier casualty. A true civilian death cannot use that exception to discard the corpse.

Civilian first aid is available through equipped bandages, with persistent bleeding, dressings and delayed death attribution. See [civilian first aid](civilian-first-aid.md) for controls, validation and remaining medical differences.

## Reference and limits

The reference is the JA2 Stracciatella source. [Soldier_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Control.cc#L5836-L5844) records player-caused wounds to named contacts. [Strategic_Town_Loyalty.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Strategic/Strategic_Town_Loyalty.cc#L351-L590) distinguishes death responsibility, territorial control and accidental attacks. [Soldier_Ani.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Ani.cc#L2840-L2911) gates death consequences so they occur once.

Remaining gaps include armed civilian faction hostility, militia retaliation, witness-based false attribution, effects on other towns by distance, civilian-killing morale events, theft and medical-aid reputation, direct NPC melee, and complete failed-quest branches. The local numeric weights and fixed point controls are adaptations. Full JA2 civilian parity remains open.
