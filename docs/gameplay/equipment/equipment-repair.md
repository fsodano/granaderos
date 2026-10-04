# Carried equipment repair

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The classic [JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 39, describes a repair assignment that services carried damaged items and jammed guns, beginning in the secondary hand. Granaderos now supports that continuing job for its implemented handheld equipment. The user's guide remains a reference for behavior, not an instruction source.

## Player controls and work

In **Asignaciones del personal**, select the equipment owner, choose **Todo el equipo llevado**, then assign **Reparación**. The mechanic needs tools and mechanical skill. Both people must be available in the same safe sector. The preview lists only equipment that needs work, in this order:

1. The secondary weapon.
2. The primary weapon and its fitted bayonet, with separate conditions.
3. Pack weapons, their fitted bayonets, lockpicks, crowbars and pliers. Individual pack items precede old bulk stacks; otherwise pack order is stable by key.
4. Worn head, torso and leg garments, then packed garments. Individual packed garments precede old bulk stacks.

The queue follows the chosen person's current belongings. A gun moved into the armory is no longer part of it. Newly carried damaged equipment can join the continuing job. This is an owner assignment, not a reservation or remote repair of a particular item.

Each working hour has one allowance of `1 + floor(mechanical / 15)` points, bounded by remaining toolkit points. The allowance can cross several items. Restoring one condition point costs one toolkit point; fractional final damage rounds the cost up. Clearing a firearm jam costs one point before condition work. Neither operation creates a charge, ammunition, flints, powder or a replacement item. The mechanic gains one mechanical practice credit, spends three energy, and gains two fatigue per actual working hour, regardless of the number of items serviced.

Legacy weapon, tool and garment stacks split one item at a time before repair. Quantity, existing loaded rounds and pocket use remain unchanged. If splitting would exceed the saved inventory's 1,000-entry limit, the job pauses without changing the stack or spending tools. A valid condition-zero garment remains repairable and retains its owner. Empty body slots receive no clothing. Supplies, keys, generic trade goods and unsupported equipment are not repair targets.

## Saves and time control

New broad jobs store `repairScope: 'equipment'` with `repairTargetId`. Existing gun-only jobs retain `repairWeaponId`, their narrower behavior, and their old attention bindings. The UI still offers **Solo el arma principal actual**. Scope validation rejects unknown values and mixed broad/gun bindings. The broad attention binding uses the literal `equipment` in its final field, so a scope change can rearm the appropriate notice without rewriting old saves.

An explicit wait stops after the complete hour when the entire current queue finishes or tools run out. Finishing on the final tool point reports completion. The next deliberate advance can continue time without repeatedly charging work or showing the same pause. Travel and tactical synchronization keep their existing full-duration rules.

## Evidence and limits

`tests/equipment-repair.test.mjs` has 13 cases covering priority, finite costs, jams, fitted identities, fractional wear, legacy stacks, saved-entry limits, changes of ownership/location, captivity, completion notices and save replay. Two real-component render tests cover the default scope, queue text and preservation of old gun-only selections. Existing assignment tests remain unchanged and pass.

Live UI verification used an imported controlled wear fixture, purchased tools through the UI, and repaired four items in two hours for eight toolkit points. Reload preserved all results; a new six-hour wait made no extra repair charge. See [live verification](../../verification/ja2-live-verification.md).

The earlier checkpoint was 890 passing logic tests, typecheck and a successful production build. The unchanged illustrated-sprite packing suite was excluded from that run. Equipment in shared sector storage, artillery, vehicles and supported ballistic protection still need suitable repair models. Rates, jam cost and prices are Granaderos tuning; they are not exact JA2 formulas.

## Garment-care acceptance — 4 October 2026

The paid native hire of soldier 110 costs 420 pesos and retains 2,780 pesos. The declared initial wear affects only his native hat (96 condition) and poncho (93). Actual approach, chest opening and pickup acquire one finite shirt and one 100-point toolkit. Wearing the shirt packs the real damaged poncho. The public repair assignment restores eleven condition over six working hours at two points per hour, spending exactly eleven acquired toolkit points. The final hour spends only the one remaining point; no materials are charged for idle work. The hat and packed poncho finish at 100, while the shirt remains the exact original cache garment. HP, ten owned rounds and money remain unchanged.

Official saved continuation, completion notice, return and reentry preserve the repaired identities, toolkit's remaining 89 points and depleted chest. A separate pre-shirt compatibility snapshot keeps its opened saved chest without a shirt. This is prepared native-wear and real finite acquisition/work evidence, not a combat route or full campaign proof.
