# TransferItem

## Intention

Transfer an exact quantity of an `Item` from one `Inventory` custodian to another within one transaction.

## Actor and trigger

The player or a tactical sector operation invokes this use case during equipment exchange, ground pickup, container extraction, body looting, or item passing between custodians.

## Request

`TransferItemRequest` contains:

- `sourceId`: the source custodian identifier.
- `destinationId`: the destination custodian identifier.
- `selectionId`: the entry selection identifier inside the source `Inventory`.
- `quantity`: the positive integer quantity to transfer.
- `expectedSource`: optional serialized fingerprint of the source selection to detect stale selections before removal.

## Response

`TransferItemUseCase.execute` returns:

- `item`: the transferred `ItemSnapshot` (`{ kind: string; quantity: number; instanceIds: readonly string[]; metadata: Readonly<Record<string, unknown>> }`).

## Refusals

Expected refusals throw `InventoryRefusal` with a typed `InventoryRefusalCode`:

- `InventoryRefusalCode.SameCustodian`: `source.custodianId` and `destination.custodianId` refer to the same custodian.
- `InventoryRefusalCode.StaleSelection`: `expectedSource` is provided and does not match `source.fingerprint(selectionId)`.
- `InventoryRefusalCode.InsufficientQuantity`: `selectionId` is absent from the source `Inventory`, or `quantity` is not a positive safe integer within the entry's available quantity.
- `InventoryRefusalCode.InvalidItem`: an item or inventory entry has an invalid kind, quantity, stack limit, slot size, pocket order, or unmergeable stack.
- `InventoryRefusalCode.DuplicateIdentity`: an identified item instance (`instanceIds`) appears more than once in an inventory, has `quantity > 1`, or is already present in the destination `Inventory`.
- `InventoryRefusalCode.CapacityExceeded`: the destination `Inventory` is already overloaded or its `PocketLayout` cannot hold the incoming item units.

UI adapters translate `InventoryRefusalCode` into Spanish player-facing messages.

## Invariants

- Every `Item` has one authoritative custodian (`ItemCustody`). `ItemTransferService.prepare` clones both source and destination `Inventory` objects, takes the requested quantity from the source copy, and receives it into the destination copy before `TransferItemRepository.commit` writes either side.
- Any refusal in `take` or `receive` aborts before `commit`, leaving both original `Inventory` custodians unchanged.
- An identified item (such as a fitted firearm with loaded charges, condition, and fitting identities in `metadata` and `instanceIds`) transfers as one intact instance and cannot merge with another stack.
- `PocketLayout` enforces personal pocket capacity (four large pockets and eight small pockets). An existing overloaded `Inventory` can release items via `take`, but `receive` refuses incoming items while `overloaded` is true.

## Repository

This README describes only the `TransferItem` contract. `TransferItemUseCase` owns `TransferItemRepository`, which exposes `load(sourceId, destinationId, selectionId)` and `commit(transfer)`. It does not share a repository interface with world scavenging or corpse removal use cases; tactical inventory adapters in infrastructure map hands, clothing, pockets, ground stacks, containers, and corpses into `Inventory` snapshots.

## Domain objects and related terms

- `ItemTransferService` prepares atomic custody and capacity changes across two `Inventory` instances.
- `Item`, `Inventory`, `PocketLayout`, and `ItemCustody` enforce quantity, unique instance identity, and pocket allocation invariants.
- `InventoryRefusal` and `InventoryRefusalCode` represent typed inventory refusals.
- Related contracts: [CollectResidentSupply](../../world/collect-resident-supply/README.md) and [AdvanceWorldTime](../../world/advance-world-time/README.md).
