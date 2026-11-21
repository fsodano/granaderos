# AdvanceWorldTime

## Intention

Advance `WorldTimeline` to a target game second and apply all due scheduled world events (including `Corpse` removal and equipment release into ground `ItemCustody`) in deterministic chronological order within one transaction.

## Actor and trigger

Strategic travel, sector operations, and world progression coordinators invoke this use case with an explicit `targetSecond` bounded by the next unresolved `ArrivalDecision`. Read-only use cases never invoke `AdvanceWorldTime`.

## Request

`AdvanceWorldTimeRequest` contains:

- `targetSecond`: the nonnegative safe integer game second to which `WorldTimeline` should advance.

## Response

`AdvanceWorldTimeResult` contains:

- `acceptedSecond`: the `WorldTimeline.currentSecond` reached after applying due events.
- `removedCorpseIds`: ordered identifiers of `Corpse` records removed during this advance (`readonly string[]`).

## Refusals

Invalid timeline, corpse, or custody states throw `RangeError` or `Error` before `AdvanceWorldTimeRepository.commit` runs:

- `RangeError('Game time must be a non-negative safe integer.')`: `targetSecond` or an event timestamp is negative or not a safe integer.
- `Error('World time cannot move backwards.')`: `targetSecond` is earlier than `timeline.currentSecond`.
- `Error('A corpse identity cannot be duplicated.')`: `context.corpses` contains duplicate corpse identifiers.
- `Error('The world event kind has no registered domain handler.')`: a due event in `WorldTimeline` has a `kind` other than `CORPSE_REMOVAL_EVENT` (`'corpse-removal'`).
- `Error('The world event refers to an unknown corpse.')`: a due `corpse-removal` event references a `subjectId` absent from `context.corpses`.
- `Error('A corpse cannot be removed twice.')` / `Error('The corpse removal time has not been reached.')`: a corpse is already removed or its `removalAtSecond` exceeds the event timestamp.
- `Error('Corpse equipment must have unique and current custody.')` / `Error('The item is no longer held by the expected custodian.')`: an item listed in `corpseEquipment` has duplicate `itemId` entries or is no longer held by `{ kind: ItemCustodianKind.Corpse, id: corpse.id }`.

## Invariants

- `WorldTimeline.advanceTo` is the single domain operation that advances game time. It processes due events in chronological order (`atSecond`) with deterministic identifier tie-breaking (`id`), moves each applied event from `pendingEvents` to `completedEventIds`, and stops before any event that returns `'pause'`.
- Splitting a time advance across multiple intermediate targets and advancing to `targetSecond` in one step produce the same applied events, `acceptedSecond`, and `completedEventIds`.
- `CorpseRemovalPolicy` schedules removal 72 game hours (`DEFAULT_CORPSE_LIFETIME_SECONDS = 259200` seconds) after `diedAtSecond`. Legacy snapshots without a recorded death timestamp start that 72-hour lifetime at the saved world timestamp.
- Removing a `Corpse` via `corpse.removeAt` preserves the `Character` death record and transfers every remaining item in `corpseEquipment` from `ItemCustodianKind.Corpse` to `{ kind: ItemCustodianKind.Ground, id: sectorId }` exactly once. Items already looted by another character are no longer in the corpse's custody list and are untouched.
- In the broader world lifecycle slice, `Sector` enforces unique physical character and object presence and validates ground settlement via `Sector.removeCorpse`, while `ResidentRoutine` advances local 6-second movement and hourly supply scavenging ([CollectResidentSupply](../collect-resident-supply/README.md)) across visible, retained, and suspended sectors using `ResidentPositionReference` and `Health`. Real time outside the game never advances `WorldTimeline`.

## Repository

This README describes only the `AdvanceWorldTime` contract. `AdvanceWorldTimeUseCase` owns `AdvanceWorldTimeRepository`, which exposes `load(): AdvanceWorldTimeContext` and `commit(context, removedCorpseIds)`. It does not share a repository interface with [CollectResidentSupply](../collect-resident-supply/README.md) or [TransferItem](../../inventory/transfer-item/README.md).

## Domain objects and related terms

- `WorldTimeline` owns monotonic game time, deterministic event ordering, and completion receipts.
- `Corpse` and `CorpseRemovalPolicy` own physical remains lifetime and death-record separation.
- `ItemCustody` and `ItemCustodianKind` enforce single-custodian ownership across characters, containers, ground, and corpses.
- `Sector`, `ResidentRoutine`, `ResidentPositionReference`, and `Health` govern sector presence and ongoing world evolution.
- Related contracts: [CollectResidentSupply](../collect-resident-supply/README.md) and [TransferItem](../../inventory/transfer-item/README.md).
