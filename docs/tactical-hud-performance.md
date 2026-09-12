# Tactical screen and inventory check — 2026-09-12

The default tactical strip displays six mercenary positions. Additional deployed
mercenaries are available in pages of six. Right-click a portrait, double-click
it, or use Equipo to inspect the selected mercenary. Inactive mercenaries can
be inspected; their equipment cannot be changed while they cannot act.

The inventory keeps stats, hands, outfit and four large/eight small pockets at
the bottom. Select an item for its actions. Equipment and accessories contains
hand selection and bayonet fitting/removal. Drag or select source/destination
to reorder pockets. Matching loose named objects combine up to the pocket limit;
weapons, tools, outfits and identified objects stay separate. Supplies already
consolidate automatically by type. This does not add crafting recipes.

Exploration movement spends energy and time, with no AP deduction. A regression
check enters peaceful Retiro, sets the selected soldier to zero AP, walks seven
cells, and confirms that AP remains zero while energy falls. Portrait AP meters
and the inventory AP row appear only in combat. Equipment cost labels and
bayonet/movement messages no longer imply a paid AP cost during exploration.

## Rendering

- Cull off-camera terrain, scenery, walls, floors and roofs with padded bounds.
- Quantize overscan to avoid rebuilding the scene for each camera pixel.
- Reuse unchanged ground nodes across movement animation and pointer updates.
- Track the exact cursor point only while aiming.
- Batch minimap terrain by color and cache unchanged ground geometry.
- Cache the HUD's order descriptors between unchanged animation frames.

Local browser measurements used the same peaceful Retiro night fixture, with
3,072 tiles, 20 buildings and three mercenaries. The prior renderer had about
28,369 SVG elements. The revised screen measured 9,081–11,829 depending on camera
position. React updates measured about 5–9 ms on average in the revised captures,
versus about 80 ms in the baseline capture. These are development-browser samples,
not a hardware-independent frame-rate guarantee; initial and simulation updates
can still exceed 200 ms. The existing bounded torch-animation test also passes.

## Validation

Typecheck and production build pass. Browser checks cover right-click inventory,
paging to mercs 7–9, pocket combining (3 + 2 becomes 1 + 4), bayonet fitting without
AP, camera movement, and 390 × 844 layout bounds. All six portrait positions,
12 pocket buttons and Listo fit within that viewport.

The broad run passed 1,596 of 1,597 tests before two further focused regression
checks were added. The sole failure is the existing automatic-defense fixture
expecting 54 elapsed seconds and receiving 18. It also fails with the unmodified
backend from b983108. This change does not alter that assertion or combat timing.
The subsequent focused checks pass, including item identity/quantity preservation.

After integration with the building-scale update (3182bb1), all 62 focused checks,
typecheck and production build also pass in the shared workspace, including the
concurrent sprite work. The unchanged automatic-defense fixture now fails its
reaction-participation assertion on that updated map; this was reproduced in an
archive of 3182bb1 without the HUD/gameplay patch. It remains a separate test gap.

## Preview artwork correction

The equipment demo initially imported the isolated HUD checkout and served its
public assets. That checkout contained the old 52-pixel sprite cells; it did not
include the sprite agent's ongoing illustrated artwork. This caused the coarse
Dorrego sprite reported after the HUD review. It was a preview source error.

The demo now imports the shared workspace and serves its matching public assets.
The Vite alias, allowed directories and Tailwind source use the same workspace.
After restarting the server, Dorrego was checked in the live tactical scene at
200% and 300% camera zoom. His illustrated source cell is 156 pixels at the same
52-pixel logical scale. Current idle and action selectors resolve to illustrated
assets without fallback. No sprite files, display scales or campaign saves were
changed for this correction.

Before showing a gameplay demo, verify that its components and public artwork
come from the same integrated workspace, and inspect a character in the browser.
An isolated test checkout can omit concurrent, uncommitted art. The rendering
measurements above describe the isolated HUD comparison with legacy sprites;
they are not measurements of the complete illustrated-sprite integration.

## Exploration input during civilian movement

The animation hook formerly marked the whole interface busy when any actor
moved. An ambient civilian routine could therefore block a portrait click and
show “Procesando órdenes” without a player order. Movement and input blocking
are now separate: civilian and enemy patrol animation can continue during
exploration; squad movement and all combat movement still block new orders.
Finished, absent, dead and departed actors cannot leave a stale input lock.

All 39 focused motion, HUD, civilian and torch checks pass. A live controlled
scene confirmed one civilian was moving at the instant Dorrego's portrait was
clicked: he became selected and the header remained “Exploración libre”.
Animation frames, paths and artwork were not changed.

The corrected live demo also exposed a separate art gap: Dorrego carries a
small firearm in his inventory, but his standing artwork shows a long gun.
The sprite task confirmed that standing weapon-family silhouettes remain open.
The legacy-preview correction does not establish full sprite consistency.
