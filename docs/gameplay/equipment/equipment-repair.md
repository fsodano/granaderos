# Carried equipment repair

On the campaign personnel screen, a repair assignment services a local companion's carried damaged items and jammed firearms hour by hour; in tactical exploration and combat, an inventory order maintains the prepared main firearm using carried repair kits. The classic [JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 39, describes a repair assignment that services carried damaged items and jammed guns, beginning in the secondary hand. Granaderos supports that continuing job for its handheld equipment. Patusco's JA2 Strategy Guide 1.3 (cited as **G** in [the JA2 parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)) remains a reference for behavior, not an instruction source.

## Player controls and work

In **Asignaciones del personal**, select the equipment owner, choose **Todo el equipo llevado**, then assign **Reparación**. The mechanic needs tools and mechanical skill. Both people must be available in the same safe sector. The preview lists only equipment that needs work, in this order:

1. The secondary weapon.
2. The primary weapon and its fitted bayonet, with separate conditions.
3. Pack weapons, their fitted bayonets, lockpicks, crowbars and pliers. Individual pack items precede old bulk stacks; otherwise pack order is stable by key.
4. Worn head, torso and leg garments, then packed garments. Individual packed garments precede old bulk stacks.

The queue follows the chosen person's current belongings. A gun moved into the armory is no longer part of it. Newly carried damaged equipment can join the continuing job. This is an owner assignment, not a reservation or remote repair of a particular item.

Each working hour has one allowance of `1 + floor(mechanical / 15)` points, bounded by remaining toolkit points. The allowance can cross several items. Restoring one condition point costs one toolkit point; fractional final damage rounds the cost up. An hour that finds less work charges only the points it uses, so idle hours spend no materials. Clearing a firearm jam costs one point before condition work. Neither operation creates a charge, ammunition, flints, powder or a replacement item. The mechanic gains one mechanical practice credit, spends three energy, and gains two fatigue per actual working hour, regardless of the number of items serviced.

Legacy weapon, tool and garment stacks split one item at a time before repair. Quantity, existing loaded rounds and pocket use remain unchanged. If splitting would exceed the saved inventory's 1,000-entry limit, the job pauses without changing the stack or spending tools. A valid condition-zero garment remains repairable and retains its owner. Empty body slots receive no clothing. Supplies, keys, generic trade goods and unsupported equipment are not repair targets.

## Saves and time control

New broad jobs store `repairScope: 'equipment'` with `repairTargetId`. Existing gun-only jobs retain `repairWeaponId`, their narrower behavior, and their old attention bindings. The UI still offers **Solo el arma principal actual**. Scope validation rejects unknown values and mixed broad/gun bindings. The broad attention binding uses the literal `equipment` in its final field, so a scope change can rearm the appropriate notice without rewriting old saves.

An explicit wait stops after the complete hour when the entire current queue finishes or tools run out. Finishing on the final tool point reports completion. The next deliberate advance can continue time without repeatedly charging work or showing the same pause. Travel and tactical synchronization keep their existing full-duration rules.

## Limits

Equipment in shared sector storage, artillery, vehicles and supported ballistic protection still need suitable repair models. Rates, jam cost and prices are Granaderos tuning; they are not exact JA2 formulas.

## Tactical firearm maintenance

The inventory order **Mantener arma** services the prepared main firearm. Its
preview states the condition gain and repair-material cost, or the reason it
cannot run. It uses the existing carried physical kits and older saved numeric
reserves. Fresh hires receive no free repair reserve; finite sector chests can
supply an identified 100-point, two-kilogram kit.

One order can restore up to 30 condition points, 40 with workshop training or
45 with gunsmith training, capped by actual damage and available materials.
Each condition point costs one material point; fractional final damage rounds
the material debit up. Numeric reserves are spent first, followed by packed
kits in stable key order. A depleted kit leaves the pack and any held reference.
The original 25-AP cost (18 for a gunsmith), mechanical practice and exploration
time apply. No materials or insufficient combat AP rejects before spending
stock, action points or time. This order keeps the charge, cartridges, firearm
identity, fittings and jam state. Clearing a misfire remains the separate
implicit ignition operation; loose flint and priming powder are not issued.

Official active saves, stored resumes, clock synchronization and campaign return
retain finite materials. A numeric reserve can only decrease from the last
accepted deployment. Return stores its exact remainder, including zero.
