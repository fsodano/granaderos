# AI supply handovers

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The original JA2 manual describes nearby inventory transfers and passing or throwing an item to a squad member on printed page 23 ([manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)). Granaderos already provides those player actions. Computer-controlled enemies and militia now use the same paid handover to supply an ally. The selection policy below is Granaderos tuning, not a claim about classic JA2's internal AI.

## Decisions and costs

A donor can give compatible reserve cartridges to a conscious ally whose held firearm and matching reserve are both empty. The donor retains enough cartridges of each caliber for the next full load of its primary and off-hand guns, accounting for their current loads. Each gift supplies at most one load of the recipient's firearm. A dropped or jammed recipient gun does not generate an ammunition request. Gifts use actual typed ammunition stacks and the ordinary transfer rules.

A donor can give one dressing to a medic with no dressings when an observed bleeding or critically wounded patient is within the medic's treatment reach. The recipient must have enough remaining AP to equip and apply it. A trained donor retains its last dressing. Existing immediate treatment, useful firing, melee and weapon maintenance retain their priority. A medic's own wound or a nearby unconscious patient's wound can generate the need. Critical health below the first-aid threshold still needs stabilization after bleeding has stopped; dead, absent, surrendered or routed people cannot receive supplies.

The donor uses the existing transfer preview and reducer. The ordinary handover costs four AP, preserves the exact item count, checks pack capacity and requires adjacency and a clear path. If a full load cannot fit, a smaller legal quantity can be selected. The recipient still pays separately to reload or prepare and use dressings. No free reload, treatment, inventory allowance, turn or AP is granted. The AI uses direct handovers; it does not yet choose risky throws.

Allies must be observed locally and within five tiles. During current contact, recent sight/sound memory, or an interrupt, the donor can supply only an adjacent ally. With no contact, it can take a short ordinary route of at most three steps and 24 AP, leaving four AP for the handover. Movement and transfer are separate orders. New contact, a changed recipient, an interruption or depleted supplies cause a fresh decision. No reservation or remote supply promise is stored.

Medical needs take precedence over ammunition gifts, then shorter routes and stable recipient IDs break ties. A completed gift removes that recipient's empty-supply condition, so another donor does not repeat it. Hired soldiers retain manual control; autonomous militia can supply them without moving or equipping them.

## Verification

Twenty focused tests cover real enemy turns, a separate recipient reload, dressing use, an unconscious third-party patient, donor reserves, AP, pack limits, hidden people, sight/sound memory, stable selection, multiple donors, militia support, an actual four-AP reaction and a saved movement interruption. Replayed snapshots produce the same results. Unseen enemy transfers stay out of the player's journal, and the public action boundary still rejects commands that attempt to control enemy donors.

The live check uses the production Battlefield component in a separate local demonstration. Initially, the hired soldier has no cartridges and the militia donor has one loaded plus three in reserve. Ending the turn gives the soldier one reserve cartridge and leaves the militia with one loaded plus two in reserve. Pressing R then loads that cartridge for 45 AP: the soldier changes from 120 to 75 AP and has one loaded, zero reserve. Saving and restoring the validated tactical snapshot preserves those values. The player's campaign is untouched.

The demonstration is available at `http://127.0.0.1:3007/` while its preview server is running. Its explanatory supply table and reset/save buttons are test controls. Actual turn handling, inventory state, keyboard input and tactical rendering use the game components. Live enemy handovers and medical supply trips remain simulation evidence rather than browser evidence.

The complete isolated suite passed **1,369/1,369 tests**, with type checking, the production build and whitespace checks also passing. The separate Mendoza continuation passed both actual battles and their replays, saved the retreat and rescue, and reached the foundry at hour 313, second 758 with the same 573 pesos.

The campaign check retains the existing actual Salta victory at seven turns and 128 player orders with unchanged losses. No campaign result, casualty, resource or clock assertion was weakened to accommodate supply sharing.

## Remaining scope

This adds local donor decisions for cartridges and dressings. Coordinated recipient requests, longer supply chains, firearm/tool handovers, risky throws, transported patients and broader equipment planning remain incomplete. The full AI, campaign completion and JA2 parity audit remain open.


## Critical-care supply correction — 21 September 2026

The donor originally checked bleeding alone, although the medic could already stabilize a living patient below 15 HP with no bleeding. That mismatch could leave an unconscious patient untreated while a nearby donor retained a usable dressing. Supply demand now calls the same critical-health predicate as ordinary first aid.

The new regression failed before the correction. An actual enemy turn now pays four donor AP for one dressing, pays the medic's equip/treatment/weapon-return costs, restores a 10-HP non-bleeding patient to 15 HP, and preserves the patient's weapon and ammunition without granting AP. Save replay is exact. A second regression rejects dead, stabilized, departed, routed, surrendered or unseen patients, and a medic who cannot afford treatment. All 22 supply-sharing tests, type checking and the production build pass. The full gameplay suite passed 2,713 of 2,714 tests. The continuous fresh-start route lost its first Tucumán assault after enemy medics gained this supply behavior. The correction remains uncommitted while the route tactics are investigated; the victory assertion is unchanged.
