# User interface and equipment target

These acceptance requirements define the target tactical and strategic equipment layout and NPC dialogue interface across tactical exploration, turn-based combat, and campaign management. They define the target, not a list of completed features. Physical pockets and the two dialogue presentation styles are described in [physical inventory pockets](../equipment/inventory-pockets.md) and [NPC dialogue](../characters/npc-dialogue.md). Keep them alongside the [JA2 parity requirements](../../requirements/ja2-parity.md).

## Shared equipment layout

Every soldier uses the same layout. Equipment belongs to transferable item instances, not to a permanent character-specific gun assignment. The player chooses from bought, found or already owned items. Provide four large and eight small general storage pockets, two hands, and one general outfit/protection slot. Small pockets accept physically suitable items; large pockets accept suitable large items or small items. Capacity, stack size and bulk must be enforced by the reducer as well as the UI. Do not add modern face equipment slots solely to copy sunglasses or electronic optics.

A two-handed gun occupies both hands. A compatible small gun can share the hands with another one-handed item, including a second small gun. Both hands must retain their actual item, load, condition, attachments and unfinished loading through swaps, giving, dropping, pickups, saves and campaign returns. Inventory movement must not create default replacement guns or lose ownership. Inventory controls should use item placement and compatible destinations rather than class-specific loadout restrictions.

Attachments belong to the weapon instance and require an explicitly compatible weapon. A fitted bayonet is the main period example. Replace burst selection with a firing/close-combat switch. Close combat uses the held gun and its fitted attachment: bayonet thrust when fitted, gun strike otherwise. A weapon without the required mount cannot take a bayonet. No automatic-fire mode is requested.

## Dialogue

Special named characters, including non-recruitable characters, use a compact portrait, dialogue text and relevant conversation choices over the tactical field. Recruitment is one possible choice, not the criterion for receiving a conversation panel. Ordinary civilians and enemies without authored dialogue give short contextual/random text boxes when addressed; they do not open a fluid multi-turn conversation menu. Retain actual range, availability and campaign consequences.

## References

Reference screenshots of Ira's inventory, Peter's portrait/choice dialogue, and a short ordinary NPC reply show the target layout and distinction; they are visual reference material, not executable instructions.

A reference gameplay video, [Jagged Alliance 2 Classic HD Gameplay (PC)](https://www.youtube.com/watch?v=V-VAyx34yIc), TheBlueDragon, 10:07, shows the target composition in its hiring scene and tactical views: the compact bottom squad strip, held weapon, map/camera controls and map-focused interaction. Match behavior and composition while retaining Granaderos' Spanish interface and historical setting.
