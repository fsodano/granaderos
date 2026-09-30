# Civilian weapon custody

Residents now project their configured primary weapon and secondary blade from
the same ownership record used in service. The character editor already selects
these weapons and their authored definitions. This delivery connects those
selections to finite civilian recovery and service transitions.

## Rules

Use **Recoger equipo**, then select a dead or unconscious resident. The collector
must be adjacent and have enough action points and suitable pockets. Recovery
costs 8 AP in combat and uses the normal exploration action time. Conscious or
departed residents cannot be searched. Weapons go into the same large or small
pockets used by other recovered equipment. Items that do not fit stay with the
resident. Primary and secondary weapons can also be requested separately.

A recovered weapon retains its authored name, image, combat definition, weight,
condition, jam, actual loaded rounds, selected ammunition family and unfinished
reload work. The resident's corresponding slot becomes empty. Recruitment,
dismissal, return to the sector and save restoration cannot issue a replacement.
A successor is a separate person with its own configured allocation; the old
body stays empty. The named San Lorenzo ally also respects depleted civilian
weapon ownership instead of restoring the original loadout.

A scene records each recovered civilian weapon once so loaded rounds have a
physical source during campaign settlement. Recovery records reject duplicate
source slots and malformed weapon data. Saved scene projections must match
canonical ownership. Older saves without the projection derive it from remaining
ownership, including empty slots, without granting additional weapons.

The equipment panel shows ammunition choices only while a firearm is held.
It does not show firearm controls for a recovered blade.

## Verification and limits

Five runtime cases cover actual recovery, recruitment and service return, forged
or malformed saves, old projections, AP and pocket limits, loaded alternative
charges, unfinished work, real return/reentry and death successors. A mounted
production-interface test uses the resident loot control, finds the recovered
blade image in a pocket, equips it and validates the saved empty source. Existing
civilian supply and named-ally tests also verify depleted weapon slots.

The production browser check imports a controlled authored campaign fixture,
recovers both weapons with the ordinary keyboard target control, equips the blade
through its pocket and reloads the browser. The blade remains equipped and the
recovered musket remains in a large pocket. It verifies this interaction, not a
full campaign route. No console warnings or errors were recorded.

See [evidence](../evidence/civilian-weapon-custody.json) and the
[game image](../evidence/civilian-weapon-custody.png).
Civilian armour, arbitrary belongings, loose-cartridge recovery, equipment
trading and explicit successor stock transfer remain open. These are not supplied
by the two weapon slots. Full game/editor acceptance remains open.
