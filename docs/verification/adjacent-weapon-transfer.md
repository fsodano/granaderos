# Adjacent recovered weapon handover

Runtime/test source: `23397f74ed197beea0b6603a1b568196aea9e198`.

The production inventory lets the player choose a companion and hand over one
stored recovered firearm or blade. Shared preview/execution checks require a
conscious squad member beside the sender, without blocking terrain, furniture
or a closed diagonal corner. Autonomous militia, unavailable or incapacitated
recipients cannot receive the order. The sender spends four combat AP or one
exploration second and lowers the held weapon. The recipient spends no AP.

Exactly one source piece moves into a distinct recipient record. Other equipment
is retained even if its key collides. The authored definition, image, weight,
condition, jam, loaded rounds and unfinished reload stay with the transferred
piece. Invalid gear, insufficient sender AP and the existing 1000-record save
limit reject before custody changes. The UI displays the engine's actual refusal.
The registered tactical order performs the same fresh checks.

## Verification

Five simulations and two mounted production-game cases pass **7/7**. Related
transfer, drop, recovery, equip and campaign clock checks pass **30/30**.
Complete regression passes **1151/1151**, zero failures or skips, in 268,899 ms.
Types, production export (722 files, 632 asset references), 36 reference baseline
comparisons and documentation audit (252 requirements, 91 evidence records) pass.

The main fixture buys two actual contracts and enters an actual attack with its
issued weapons in declared compact geometry. Actual melee death and body loot
supply the authored blade. The piece goes to the paid adjacent companion,
retains its weight and custody through full save, retreat and reentry, and equips
there. A second recovered firearm uses explicitly prepared wear, jam and partial
loading to test preservation. It does not claim those values came from firing.
Prepared stack/collision, exploration, invalid-recipient, insufficient-AP,
record-limit, wall, diagonal-corner and furniture cases verify finite transfer
and atomic rejection. The mounted tests use the real recipient selector, transfer
button, squad selection and equip button; normal persisted saves keep ownership.
A distant recipient remains disabled and a direct registered order also rejects.

Initial rejection fixtures needed consistent derived condition and enemy patrol
state. The double-barrel pistol's two-round load is valid, so its over-capacity
boundary was corrected to three. The registered tool correctly throws rejected
orders without committing; its test now checks that existing contract. These
fixture corrections did not weaken the engine restrictions.

This accepts adjacent handover of stored recovered weapons. Held weapons,
supplies, arbitrary quantities, relays, throwing/catching, finite pocket layout,
and physical medical delivery remain separate. The 1000-record guard is a saved
state limit, not acceptance of pocket capacity. These are simulations and mounted
DOM checks, not live-browser, balance or performance acceptance. Exact-head CI
remains required before publication.
