# Ground equipment and body searches

The classic JA2 manual, printed page 25, describes selecting an item with the hand cursor, moving into range and choosing from the available items. Granaderos now follows that sequence for visible ground equipment and bodies.

## Player flow

Select a ground equipment marker or a dead body. The existing pickup cursor (I) also selects bodies and piles; Ctrl-targeting a body searches it. A conscious opponent retains the existing contested weapon-grab rules. Deliberate fire, medical targeting, held torches, Alt movement and explicit exploration group movement retain their targeting priorities.

The target preview shows the approach cost and states that pickup costs another 8 AP. The soldier walks through the normal movement resolver. Only after a completed approach does a focused picker show the available items and quantities. Body inventories are not disclosed from a distance, including whether a body has already been emptied. Closing the picker leaves the completed movement paid. It does not spend pickup AP.

The picker lists each source separately, with a checkbox and exact quantity for each row. **Seleccionar todos** selects every available stack at its full quantity; **Limpiar selección** clears the selection. Capacity and quantity errors appear before pickup. Loaded rounds, failed ignition, condition and fitted bayonets remain attached to the actual weapon record. Pickup stores equipment in the pack; it does not equip a weapon for free. Only checked rows and their indicated quantities are taken. Each confirmed selection from one tile costs 8 AP in total, consistent with the existing whole-body pickup action. This is Granaderos tuning, not a claim to reproduce an exact JA2 AP formula. If any selected item fails validation, no item moves and no pickup AP is spent.

Visible ground stacks share a marker per tile. Empty, taken, entangled and unseen stacks do not produce markers. Markers support pointer targeting, keyboard focus and Enter/Space activation. The native dialog contains keyboard focus, closes with Escape, and pauses the ambient exploration clock while choosing. Its item list scrolls within the dialog while the selection controls and confirmation remain available.

## Simulation and persistence

`approachLoot` with `unitId`, `x` and `y` performs only the approach. It neither transfers items nor creates a saved pending pickup. Its preview uses visible source presence without examining a distant body's inventory. A local search leaves AP and time unchanged. `approachCompleted` checks the actual destination and rejects opening the picker after contact, collapse or an opposing reaction, including a reaction that returns to the same phase.

An explicit `loot` action with a known item and quantity also supports a combined paid approach and pickup through `lootApproachPreview`. It validates capacity and quantity before movement, then rechecks them after movement. The local `lootPreview` and internal transfer resolver remain the authority for item ownership. No new save fields are needed. Tools that use WebMCP can issue `approachLoot` before inspecting the existing nearby loot projection.

`lootBatch` accepts an `items` array of one to 1,000 selections. Each entry names exactly one source (`targetId`, `groundId` or `dropIndex`) and an explicit positive integer `count`; body entries also name the actual `item`. All sources must be visible, adjacent and on the same tile. Repeated sources, including `weapon`/`primary` aliases, stale quantities, departed bodies and mixed-tile requests are rejected. Capacity is checked for the complete selection on private copies before any source or receiver changes. The batch then spends one pickup cost and one exploration duration. It cannot change another soldier's hand or silently substitute a missing selection. Existing single-item commands remain supported.

## Verification

Ten simulation cases cover movement/pickup equivalence, finite partial stacks, full-pack search, concealed body inventory, fitted weapon identity, rejected orders, exploration time, collapse, reactions, saved player interrupts and marker visibility. Two component cases cover marker keyboard events, quantity controls and disabled capacity checks. The shared TSX test loader now fails on compiler syntax diagnostics; it no longer accepts recovered output from malformed source.

The live controlled fixture spent 24 AP to reach a body and two ground stacks. It then spent 8 AP each on three ground cartridges, four body cartridges and one loaded, jammed musket with a fitted bayonet. Cabral finished with 52 AP, seven cartridges and the recovered weapon in his pack. Nine ground cartridges and fifteen body cartridges remained. The musket retained 41% condition, one loaded round and its ignition failure; its bayonet retained 39% condition. Canceling the picker spent no AP. A fresh tab restored identical public units, ground stacks, nearby loot and the six-second clock. See [the live record](../../verification/ja2-live-verification.md).

Eleven batch tests add mixed body/ground quantities, complete-set capacity, late-failure rollback, source/alias validation, stale selections, Select All, legacy dropped weapons, single exploration duration, a real saved interrupt and a campaign-bound save. The component check now covers the checkbox/quantity picker and disabled full-pack confirmation.

The live Select All check took five full stacks after approach for one 8 AP payment, leaving Cabral with 68 AP, 31 cartridges, three dressings and two distinct loaded muskets. The source body and ground were empty after reload. A second live fixture with 220 carried cartridges rejected Select All without changing inventory or spending pickup AP. Clearing it and selecting four body cartridges plus three ground cartridges succeeded for 8 AP and preserved every unselected item.

Live interrupted searches remain unverified; their rules have simulation coverage. Strategic sector-inventory access remains a separate gap in the [parity audit](../../verification/ja2-parity-audit.md).
