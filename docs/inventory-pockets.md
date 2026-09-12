# Physical inventory pockets

Every soldier uses four large and eight small storage pockets. Long equipment occupies one large pocket. Compact equipment fits either size; supply stack limits remain enforced. A fifth large item cannot enter even when small pockets are empty.

Select an object and then its destination, or drag it. Compatible occupied destinations swap. Pocket organization costs no AP. Existing equipment changes retain their costs. Placement is a preference over actual item records, never a second inventory: moving a pocket cannot manufacture ammunition or replace a weapon. Loaded rounds, condition, fittings and identity remain in those records. Invalid or stale swaps are rejected before mutation. Overfull inventories display the excess for giving or dropping.

Ten new tests cover geometry, swaps, metadata, stale requests, bounded oversized quantities, validation, full campaign return/reentry and rendered pockets. The full 1,441-test suite, typecheck, build and diff check pass.

A separate live production-component demonstration displayed all twelve pockets, rejected small destinations for a Brown Bess, moved it to the fourth large pocket, and restored its position after saving/loading. Equipping it reduced AP from 100 to 94 and retained its prepared round, 63% gun condition and 73% bayonet condition. This is a controlled fixture, not a complete campaign playthrough.

The general two-hand system, outfit slot and explicit firearm/close-combat switch remain separate pending work.
