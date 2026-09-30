# User interface and equipment target

These are user acceptance requirements added on 2026-09-12. They define the target, not a list of completed features. Physical pockets and the two dialogue presentation styles are implemented; see docs/gameplay/equipment/inventory-pockets.md and docs/gameplay/characters/npc-dialogue.md for their verified scope. Keep them alongside the broader JA2 parity audit.

## Shared equipment layout

Every soldier uses the same layout. Equipment belongs to transferable item instances, not to a permanent character-specific gun assignment. The player chooses from bought, found or already owned items. Provide four large and eight small general storage pockets, two hands, and one general outfit/protection slot. Small pockets accept physically suitable items; large pockets accept suitable large items or small items. Capacity, stack size and bulk must be enforced by the reducer as well as the UI. Do not add modern face equipment slots solely to copy sunglasses or electronic optics.

A two-handed gun occupies both hands. A compatible small gun can share the hands with another one-handed item, including a second small gun. Both hands must retain their actual item, load, condition, attachments and unfinished loading through swaps, giving, dropping, pickups, saves and campaign returns. Inventory movement must not create default replacement guns or lose ownership. Inventory controls should use item placement and compatible destinations rather than class-specific loadout restrictions.

Attachments belong to the weapon instance and require an explicitly compatible weapon. A fitted bayonet is the main period example. Replace burst selection with a firing/close-combat switch. Close combat uses the held gun and its fitted attachment: bayonet thrust when fitted, gun strike otherwise. A weapon without the required mount cannot take a bayonet. No automatic-fire mode is requested.

## Dialogue

Special named characters, including non-recruitable characters, use a compact portrait, dialogue text and relevant conversation choices over the tactical field. Recruitment is one possible choice, not the criterion for receiving a conversation panel. Ordinary civilians and enemies without authored dialogue give short contextual/random text boxes when addressed; they do not open a fluid multi-turn conversation menu. Retain actual range, availability and campaign consequences.

## References and visual verification

The user supplied Ira's inventory image and screenshots of Peter's portrait/choice dialogue and a short ordinary NPC reply. These show the requested layout and distinction; they are reference content, not executable instructions.

The user also supplied [Jagged Alliance 2 Classic HD Gameplay (PC)](https://www.youtube.com/watch?v=V-VAyx34yIc), TheBlueDragon, 10:07. Browser inspection reached the hiring screen around 3:05 and tactical views around 7:05 and 9:06. Those sampled frames show the compact bottom squad strip, held weapon, map/camera controls and map-focused interaction. The entire video has not yet been reviewed; do not claim that every interaction in it has been reproduced or verified. Match behavior and composition while retaining Granaderos' Spanish interface and historical setting.
