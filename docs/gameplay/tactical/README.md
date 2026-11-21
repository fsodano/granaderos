# Tactical play

[Gameplay index](../README.md) · [Documentation index](../../README.md)

Current geometry and presentation: [shared wall edges](../../specification/wall-edges.md)
and visible firearm projectiles.

This folder indexes the tactical battlefield feature guides for both real-time
tactical exploration and turn-based combat. [JA2 parity requirements](../../requirements/ja2-parity.md)
record each handled or still-open parity row.

## Action-point display

The compact interface uses a base maximum of 25 PA, plus up to 5 PA carried
from the previous turn. A standing punch costs 3 PA before movement. Wounds
and fatigue still reduce the budget. Quarter-point costs are displayed exactly
with Spanish decimal commas; a cost of 2,75 PA does not become 3 PA.

The engine, saved battles and content packages retain their existing integer
units: four stored units equal one displayed PA. HUD values, cursor previews,
new journal messages and rejection messages use the compact scale. Weapon and
artillery editors convert both directions and accept steps of 0,25 PA. This
preserves old saves, authored equipment, partial reload work, enemy decisions
and the number of actions available per turn. The data API and stored records
still use integer units; old saved journal entries remain historical text.

The compact scale is a display convention, not a reload balance change. Base
firearm reloads remain 7–17,5 PA, before modifiers; a Brown Bess costs 11,25 PA. Reload progress and
available ammunition can reduce the cost of the next loading order.

Hit feedback uses the existing observed health-loss frames. The number rises
18 SVG units near the hit character and fades within 0,9 seconds. It disappears
when that impact frame ends, cannot replay from a save, and does not reveal
unobserved targets. Reduced-motion settings disable its movement and animation.

## Controls and information

Select a soldier, open **Artillería**, and select a cannon. A small indicator
shows the selected operator. Open that menu to see the nearby crew for the
next order and each member's PA cost. Crew members must be able to act and
reach the piece. The game selects them for each order; it does not keep a
permanent assignment.

Use **Arma personal** to prepare the selected soldier's primary weapon.
This does not move the soldier. The cannon occupies its cell. The gunner
must stay in a free adjacent cell, and can switch between a personal weapon
and cannon orders from there. PA, ammunition, crew and targeting rules still
apply. Leaving the cannon has no PA cost. Preparing a different held slot
pays the normal weapon switch cost shown by the button. **Dejar cañón**, inside the cannon menu,
returns to movement. Controls wait until the current action ends.

When an older saved game has a person on a cannon cell, loading places that
person in a free adjacent cell on the same level. The cannon stays in place.
Health, PA, ammunition and time stay the same. Loading fails if no adjacent
cell is available.

- [Keyboard controls](TACTICAL-HOTKEYS.md)
- [Interface and equipment target](ja2-interface-target.md)
- [Optional orders panel](lazy-orders-panel.md)
- [Roster hand indicators](roster-hand-status.md)
- [Observation and combat journal](tactical-journal.md)

## Exploration, movement, and interaction

- [Automatic return to exploration](automatic-exploration.md)
- [Patrols and the battle opening clock](exploration-patrols.md)
- [Movement and hidden occupants](movement-knowledge.md)
- [Larger tactical sectors](large-tactical-sectors.md)
- [Tactical elevation](tactical-elevation.md)
- [Tactical exit layouts](tactical-exit-layouts.md)
- [Crowded assault entrances](crowded-assaults.md)
- [Approach and use a held item](item-approach.md)
- [Approach a door or container](environment-approach.md)
- [Ground equipment and body searches](loot-approach.md)

## Aiming and firearm use

- [Pointer aiming](aim-cursor.md)
- [Weapon readiness](weapon-readiness.md)
- [Prepare a firearm with the look cursor](look-readiness.md)
- [Turning to fire](shot-turning.md)
- [Firearm range and sight](shot-range.md)
- [Fire at a location](location-fire.md)
- [Named-target shot paths](directed-projectiles.md)
- [Single-ball body penetration](body-penetration.md)
- [Finite physical shot loads](physical-shot-loads.md)
- [Projectile cover and concealment](projectile-cover.md)
- [Glancing shots against stone](stone-ricochet.md)

## Close combat and thrown weapons

- [Deliberate melee at a map cell](melee-point.md)
- [Stand before close combat](prone-melee-preparation.md)
- [Equipped knife throws](contextual-knife-throws.md)
- [Hand-thrown grenades](hand-grenades.md)
- [Take a held weapon](weapon-stealing.md)

## AI and allied units

- [AI shot selection](ai-shot-selection.md)
- [AI field aid and carried weapons](ai-field-equipment.md)
- [Recovering combat supplies](ai-scavenging.md)
- [AI supply handovers](ai-supply-sharing.md)
- [Autonomous artillery crews](artillery-ai.md)
- [Autonomous local militia](militia-autonomy.md)
