# TransferItem

Transfer an exact quantity from one item custodian to another. The request
identifies the two custodians, the source selection, the quantity, and an optional
source fingerprint. The narrow repository loads both inventories within the
current game transaction.

`Item` protects quantity and instance identity. A fitted weapon retains its load,
condition, fitting identities, and other metadata as one transferred object.
`Inventory` protects unique custody, held quantities, stack limits, and pocket
capacity. `PocketLayout` owns four large pockets, eight small pockets, explicit
partial stacks, and valid slot exchanges. A saved overload can discard items.
It cannot receive more equipment until its capacity permits the transfer.

`ItemTransferService` creates the complete source and destination result before
the repository commits either one. A stale selection, duplicate identity,
insufficient quantity, or capacity refusal leaves both original inventories
unchanged. Domain tests use real items and inventories.

The tactical adapters map hands, worn clothing, cursor custody, pockets, ground
stacks, containers, and corpses into these objects. Existing equipment field
names remain compatibility data at that boundary. Player passing, body loot,
ground pickup, container extraction, and corpse removal use the same quantity
and capacity rules. Tactical action points and reachability remain sector-session
rules and must be accepted before the outer command commits the transfer.

Canonical persistence uses the complete tactical inventory mapper. It removes
depleted hand, clothing, cursor, supply, and stored records; restores exact
metadata and held selections; and verifies the resulting inventory before the
transaction commits. Readback must preserve every positive item quantity and
identity. A cursor entry requires its existing admitted origin.
