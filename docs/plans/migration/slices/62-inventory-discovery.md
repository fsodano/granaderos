# Slice 62: inventory discovery rules

The domain owns the policy for what counts as discovered. Tactical code still
supplies visibility, interior visibility, and the footprint cells of props.
This boundary keeps geometry in tactical code and makes the discovery policy
testable with explicit map facts.

## Rule ownership

[`inventory-discovery.ts`](../../../../packages/game/domain/perception/inventory-discovery.ts)
owns observer eligibility, point-seen checks, and the rules for finding loose
equipment, dropped weapons, bodies, and open chests.

- An observer must be a player-side combatant with positive health. Unconscious,
  departing, routed, or surrendered combatants do not count.
- A point counts as seen only when its interior is visible and an eligible
  observer sees it. A body also requires an observer at hand: on the same
  surface and within a default straight-line range of 1.5 cells defined by
  [`atHand`](../../../../packages/game/domain/sector-sessions/tactical-planning-space.ts).
- Loose ground equipment is found when its count is positive, it has no holder,
  and its point is seen. A dropped weapon is found when it has not been taken
  and its point is seen. A body is found when it is dead, has not departed, and
  is seen at hand. An open chest is found when any cell of its footprint is
  seen.
- Discovery does not reveal a living combatant's carried inventory or an
  unopened container, and distant sight alone does not reveal a body.

Existing callers use `discoverInventory` in the retained
[`inventory-discovery.js`](../../../../packages/game/inventory-discovery.js).
That entry point supplies sight and interior-visibility results from tactical
code and obtains prop footprint cells. It applies positive discovery results by
setting `knownToPlayer`; losing sight does not clear that flag. The domain
decides what the supplied map facts mean and computes the at-hand distance; it
does not query visibility, interior state, or prop geometry. Without the
interior check, an object in an unknown room could be marked as found; without
the sight query, an object outside the observers' view could be exposed.

## Example

The test fixture in
[`inventory-discovery.test.ts`](../../../../packages/game/domain/perception/inventory-discovery.test.ts)
places an eligible player observer at `(0, 2)` and marks `(3, 2)` as a visible
point in a visible interior. A ground item there with count `1` qualifies; the
domain rule returns found. The current wrapper sets `knownToPlayer` for that
item, and the flag remains set if sight is later lost. The same fixture marks
`(10, 2)` as a hidden interior, so an item there does not qualify. These
observer, item, and sight values are test data; discovery conditions come from
the domain module, and the persistent `knownToPlayer` update comes from the
retained module.

## Behavior checks

[`inventory-discovery.test.ts`](../../../../packages/game/domain/perception/inventory-discovery.test.ts)
covers observer eligibility, visible and hidden ground items, held or empty
equipment, taken weapons, bodies at hand, and open-chest footprint visibility.
These are domain tests; tactical sight and prop-cell queries remain in the
retained module.
