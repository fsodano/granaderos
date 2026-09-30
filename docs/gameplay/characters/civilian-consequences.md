# Civilian combat and campaign consequences

Implemented 19 September 2026. This advances S09 and civilian collision coverage. Civilian factions, morale and quest consequences are still partial.

## Controls and physical damage

Civilian residents now enter assaults and defenses as well as peaceful visits. A firearm aim click on a visible civilian fires at that person's ground point. Right-click changes aim; left-click fires or attempts the existing empty-weapon reload. The point has fixed height, no body selector and no claim of a confirmed hit chance. Movement and talk modes retain ordinary conversation. Knives and grenades also use a ground point; an unrelated soldier with the same ID cannot redirect the action.

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

The affected town uses its control at the first acknowledgment. Unknown sources and rural locations have no civic modifier. A local trap without a known attacker does not invent player blame. Anonymous campaign messages do not disclose an unseen person's name, coordinates or attacker. A later victory adds the existing victory reward; capture no longer forces loyalty up to 50 and erases previous losses.

Named contacts use their actual lower health and energy when hired. A validated service transfer prevents an old civilian record from demanding that the person reappear after dismissal or a soldier casualty. A true civilian death cannot use that exception to discard the corpse.

Civilian first aid is now available through equipped bandages, with persistent bleeding, dressings and delayed death attribution. See [civilian first aid](civilian-first-aid.md) for controls, validation and remaining medical differences.

## Reference and limits

The implementation reference is Stracciatella commit `a06f4896c43c76396529e415a29a8ca26b00f9f1`. [Soldier_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Control.cc#L5836-L5844) records player-caused wounds to named contacts. [Strategic_Town_Loyalty.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Strategic/Strategic_Town_Loyalty.cc#L351-L590) distinguishes death responsibility, territorial control and accidental attacks. [Soldier_Ani.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Ani.cc#L2840-L2911) gates death consequences so they occur once.

Remaining gaps include armed civilian faction hostility, militia retaliation, witness-based false attribution, effects on other towns by distance, civilian-killing morale events, theft and medical-aid reputation, direct NPC melee, and complete failed-quest branches. The local numeric weights and fixed point controls are adaptations. This change does not establish full JA2 civilian parity.

## Verification

Tests cover physical collision and cover, attribution, finite knives and grenades, hidden-state independence, refusal, paid recruitment, repeated wounds, death, report rejection, save migration, reentry and service transfer. The campaign grenade test starts from a stated late-Cuyo checkpoint, then uses ordinary paid hire, travel, purchase and equip orders.

Live verification used a compact open Retiro field with paid Acosta recruitment and the actual issued resident roster. Right-click opened the point cursor, two further clicks selected aim level 2, and left-click reduced Cabral from 100 to 39 HP. The firearm went from one loaded charge to zero. Reload/resume retained the injury. Exploration retained 91 AP; the approach consumed energy. This field is a control test, not a full campaign playthrough or art review.

A separate post-shot display fixture placed the same wounded contact beside the soldier. After reload/resume, the conversation showed only “Me heriste. No voy a ayudarte.” as its response, with no stale friendly greeting or approach command. This adjacency was prepared for display; it was not presented as an earned movement result.

The final isolated tree passed all 2,479 tests with no skips, TypeScript checks and the production build (960 exported files and 856 checked asset references). The combined main checkout then passed TypeScript and 158 focused gameplay/UI tests. The 51 pre-existing pending files were preserved; no artwork changes enter this commit.
