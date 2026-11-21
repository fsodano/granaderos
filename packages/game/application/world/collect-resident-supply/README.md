# CollectResidentSupply

## Intention

Transfer one unit of an eligible, adjacent, unattended `GroundSupply` to a free, living resident (`ResidentSupplies`) whose personal stock of that supply kind is zero.

## Actor and trigger

The hourly world scavenging schedule inside `ResidentRoutine` invokes this use case once per game hour (`RESIDENT_SCAVENGING_INTERVAL_SECONDS = 3600`) for each eligible free resident in visible, retained, and suspended sectors. Read-only queries never invoke this use case.

## Request

`CollectResidentSupplyRequest` contains:

- `characterId`: the persistent `Character` identifier of the resident candidate.

## Response

`CollectResidentSupplyResult` contains:

- `collected`: `{ itemId: string; groundId: string; kind: ResidentSupplyKind }` when a supply unit was transferred, or `null` when no eligible `GroundSupply` matched `ScavengingPolicy`.

## Refusals

Invalid domain states throw an `Error` or `InventoryRefusal` before `CollectResidentSupplyRepository.commit` runs:

- `Error('A resident needs an identity and local position.')` / `Error('Resident supply quantities must be non-negative integers.')`: `ResidentSupplies` is constructed with an invalid identity, coordinates, or negative supply count.
- `Error('A ground supply needs a valid identity, quantity, type, and position.')` / `Error('The ground supply is empty.')`: a `GroundSupply` record has an invalid kind, negative quantity, or zero quantity at transfer time.
- `Error('The scavenging policy requires valid distance and quantity limits.')`: `ScavengingPolicy` is configured with a negative distance or non-positive target quantity.
- `InventoryRefusal`: `ItemTransferService` refuses an invalid quantity or custodian conflict during `collectOneFrom`.

## Invariants

- `ScavengingPolicy.selectSupply` sorts candidate `GroundSupply` objects in ascending identifier order (`id`) and selects the first supply with `quantity > 0`, resident stock below `targetQuantity` (default `1`, meaning personal stock is `0`), and Chebyshev distance `Math.max(|dx|, |dy|) <= maximumDistance` (default `1` tile on each axis).
- Eligible supply kinds (`RECOVERABLE_RESIDENT_SUPPLIES`) are limited to `'rations'`, `'medkits'`, `'torches'`, and `'boleadoras'`. Money, weapons, closed containers, corpses, quest gifts, and held items are excluded.
- When `selectSupply` returns `null`, `CollectResidentSupplyUseCase` returns `{ collected: null }` without calling `repository.commit`.
- When a supply is selected, `GroundSupply.transferOneTo` creates an `ItemCustody` receipt (`${groundId}:${quantity}`), transfers 1 unit from the ground `Inventory` to the resident `Inventory` through `ItemTransferService`, switches `ItemCustody` from `ItemCustodianKind.Ground` to `{ kind: ItemCustodianKind.Character, id: resident.characterId }`, and commits both updated quantities together.
- `ResidentRoutine` runs 6-second movement before hourly collection when both fall on the same second. Serving, captured, unconscious, departed, detained, or escorted characters are excluded from scavenging by the routine adapter.

## Repository

This README describes only the `CollectResidentSupply` contract. `CollectResidentSupplyUseCase` owns `CollectResidentSupplyRepository`, which exposes `load(characterId): CollectResidentSupplyContext` and `commit(context: CollectResidentSupplyContext): void`. It does not share a repository interface with [AdvanceWorldTime](../advance-world-time/README.md) or [TransferItem](../../inventory/transfer-item/README.md).

## Domain objects and related terms

- `ResidentSupplies`, `GroundSupply`, and `ScavengingPolicy` own resident stock, unattended ground stock, and deterministic adjacency selection.
- `ItemTransferService`, `Inventory`, and `ItemCustody` enforce atomic single-unit custody transfer.
- `ResidentRoutine` schedules hourly collection opportunities across visible and inactive sectors.
- Related contracts: [AdvanceWorldTime](../advance-world-time/README.md) and [TransferItem](../../inventory/transfer-item/README.md).
