# AI supply handovers

During turn-based combat, computer-controlled enemies and autonomous local militia can approach and hand over reserve cartridges or a medical dressing to a nearby ally who has run out. The original JA2 manual describes nearby inventory transfers and passing or throwing an item to a squad member on printed page 23 ([M23](../../requirements/ja2-parity.md#scope-and-evidence), [manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)). The same paid handover supplies an ally for player, enemy and militia donors. The selection policy below is Granaderos tuning, not a claim about classic JA2's internal AI.

## Decisions and costs

A donor can give compatible reserve cartridges to a conscious ally whose held firearm and matching reserve are both empty. The donor retains enough cartridges of each caliber for the next full load of its primary and off-hand guns, accounting for their current loads. Each gift supplies at most one load of the recipient's firearm. A dropped or jammed recipient gun does not generate an ammunition request. Gifts use actual typed ammunition stacks and the ordinary transfer rules.

A donor can give one dressing to a medic with no dressings when an observed bleeding or critically wounded patient is within the medic's treatment reach. The recipient must have enough remaining AP to equip and apply it. A trained donor retains its last dressing. Existing immediate treatment, useful firing, melee and weapon maintenance retain their priority. A medic's own wound or a nearby unconscious patient's wound can generate the need. Critical health below the first-aid threshold still needs stabilization after bleeding has stopped; dead, absent, surrendered or routed people cannot receive supplies.

The donor uses the existing transfer preview and reducer. The ordinary handover costs four AP, preserves the exact item count, checks pack capacity and requires adjacency and a clear path. If a full load cannot fit, a smaller legal quantity can be selected. The recipient still pays separately to reload or prepare and use dressings. No free reload, treatment, inventory allowance, turn or AP is granted. The AI uses direct handovers; risky throws are not part of the policy.

Allies must be observed locally and within five tiles. During current contact, recent sight/sound memory, or an interrupt, the donor can supply only an adjacent ally. With no contact, it can take a short ordinary route of at most three steps and 24 AP, leaving four AP for the handover. Movement and transfer are separate orders. New contact, a changed recipient, an interruption or depleted supplies cause a fresh decision. No reservation or remote supply promise is stored.

Medical needs take precedence over ammunition gifts, then shorter routes and stable recipient IDs break ties. A completed gift removes that recipient's empty-supply condition, so another donor does not repeat it. Hired soldiers retain manual control; autonomous militia can supply them without moving or equipping them.

## Critical care demand

Supply demand calls the same critical-health predicate as ordinary first aid. A
patient who is bleeding, or who is living and below 15 HP, generates a dressing
request, so a non-bleeding unconscious patient below the threshold is not left
untreated while a nearby donor retains a usable dressing. The donor pays the
ordinary four-AP handover; the recipient still pays to equip and apply the
dressing.

## Remaining scope

Donor decisions cover local cartridges and dressings. Coordinated recipient
requests, longer supply chains, firearm and tool handovers, risky throws,
transported patients and broader equipment planning remain open. The wider
[JA2 parity requirements](../../requirements/ja2-parity.md) track the rest.
