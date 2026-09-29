# Leave personal supply bundles in a sector

Runtime/test source: `b47d13b542e0801a9794cc8f91619bfa56e2e34b`.

The production inventory selects priming, flints, rations, torches, dressings or
bolas and an exact whole quantity. **Dejar suministros en el suelo** moves that
bundle to the current cell for four combat AP or one exploration second. The
field shows its existing ground-item marker. Normal collection takes the whole
bundle for eight combat AP or one exploration second, including when another
soldier stands on the cell. The owner or a nearby companion can collect it.

The source remainder, ground quantity and later collector remain finite through
full saves, campaign exit and reentry. Collected bundles stay empty. A new bundle
cannot overwrite another ground object with a colliding identifier. Stock,
quantity, actor, AP and field-record checks run before custody changes. Collecting
supported supplies also checks the receiving campaign-compatible numeric limit
before spending AP or removing the bundle. Entangled bolas remain unavailable.

## Verification

Five simulations and one mounted production-game case pass **6/6**; the related
supply handover and held/stored weapon placement group passes **25/25**. Complete
regression passes **1188/1188**, zero failures or skips, in 279,484 ms. Types,
production export (722 files, 632 asset references), 36 reference comparisons
and documentation audit (257 requirements, 96 evidence records) pass.

The actual campaign uses authored starting allocations and paid arrivals. One
soldier leaves six distinct supply bundles, saves, exits and returns. A different
soldier collects each bundle through actual orders. A further saved exit/reentry
retains both personal remainders and empty field records. Prepared combat fields
check all six supply types, the four/eight AP costs and unchanged held weapons.
Exploration checks one-second placement and a preexisting identifier collision.
Invalid quantities, fields, actors, exhausted stock, insufficient AP and the
2000-entry field bound preserve custody. Collection boundaries cover receiving
numeric limits and held bolas.

The mounted Home flow chooses a quantity, leaves actual dressings, reads the
saved ground record and visible marker, selects another soldier and uses normal
collection on the original owner's occupied cell. It verifies both holders,
the empty ground record and the removed marker through the normal persisted
save. Shared quantity labels now describe supplies without restricting them to
handover. These are mounted DOM checks, not live-browser acceptance.

The ordinary collection takes the whole chosen bundle. Partial pickup selection,
cartridge placement, physical pocket capacity and weight, container inventories,
remote inventory and broader campaign acceptance remain open. Exact-head CI
remains required before publication.
