# Tactical play

[Gameplay index](../README.md) · [Documentation index](../../README.md)

These notes cover published systems and separate development-workspace work.
Read [published progress](../../verification/published-progress.md) for accepted
features on `main`. Notes marked *workspace* describe unpublished integration;
the [workspace acceptance record](../../verification/gameplay-completion.md) and
[parity audit](../../verification/ja2-parity-audit.md) record that separate scope.

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
and the number of actions available per turn. The data API and historical
verification records still use stored units; old saved journal entries remain
historical text.

This is a scale change, not a reload balance change. Base firearm reloads remain
7–17,5 PA, before modifiers; a Brown Bess costs 11,25 PA. Reload progress and
available ammunition can reduce the cost of the next loading order.

Hit feedback uses the existing observed health-loss frames. The number rises
18 SVG units near the hit character and fades within 0,9 seconds. It disappears
when that impact frame ends, cannot replay from a save, and does not reveal
unobserved targets. Reduced-motion settings disable its movement and animation.

## Controls and information

- [Keyboard controls](TACTICAL-HOTKEYS.md)
- [Interface and equipment target](ja2-interface-target.md) *(workspace)*
- [Optional orders panel](lazy-orders-panel.md) *(workspace)*
- [Roster hand indicators](roster-hand-status.md) *(workspace)*
- [Observation and combat journal](tactical-journal.md) *(workspace)*

## Exploration, movement, and interaction

- [Automatic return to exploration](automatic-exploration.md) *(workspace)*
- [Patrols and the battle opening clock](exploration-patrols.md) *(workspace)*
- [Movement and hidden occupants](movement-knowledge.md) *(workspace)*
- [Larger tactical sectors](large-tactical-sectors.md)
- [Tactical elevation](tactical-elevation.md) *(workspace)*
- [Tactical exit layouts](tactical-exit-layouts.md) *(workspace)*
- [Crowded assault entrances](crowded-assaults.md) *(workspace)*
- [Approach and use a held item](item-approach.md) *(workspace)*
- [Approach a door or container](environment-approach.md) *(workspace)*
- [Ground equipment and body searches](loot-approach.md) *(workspace)*

## Aiming and firearm use

- [Pointer aiming](aim-cursor.md) *(workspace)*
- [Weapon readiness](weapon-readiness.md) *(workspace)*
- [Prepare a firearm with the look cursor](look-readiness.md) *(workspace)*
- [Turning to fire](shot-turning.md) *(workspace)*
- [Firearm range and sight](shot-range.md) *(workspace)*
- [Fire at a location](location-fire.md) *(workspace)*
- [Named-target shot paths](directed-projectiles.md) *(workspace)*
- [Projectile cover and concealment](projectile-cover.md) *(workspace)*
- [Glancing shots against stone](stone-ricochet.md) *(workspace)*

## Close combat and thrown weapons

- [Deliberate melee at a map cell](melee-point.md) *(workspace)*
- [Stand before close combat](prone-melee-preparation.md) *(workspace)*
- [Equipped knife throws](contextual-knife-throws.md) *(workspace)*
- [Hand-thrown grenades](hand-grenades.md) *(workspace)*
- [Take a held weapon](weapon-stealing.md) *(workspace)*

## AI and allied units

- [AI shot selection](ai-shot-selection.md) *(workspace)*
- [AI field aid and carried weapons](ai-field-equipment.md) *(workspace)*
- [Recovering combat supplies](ai-scavenging.md) *(workspace)*
- [AI supply handovers](ai-supply-sharing.md) *(workspace)*
- [Autonomous artillery crews](artillery-ai.md) *(workspace)*
- [Autonomous local militia](militia-autonomy.md) *(workspace)*
