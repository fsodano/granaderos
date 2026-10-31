import {
  GroundSupply,
  ResidentSupplies,
  RECOVERABLE_RESIDENT_SUPPLIES,
  RESIDENT_SCAVENGING_INTERVAL_SECONDS,
} from './domain/world/resident-supplies.ts';
import { CollectResidentSupplyUseCase } from './application/world/collect-resident-supply/collect-resident-supply.use-case.ts';

class SnapshotCollectResidentSupplyRepository {
  #scene;
  #resident;
  #atSecond;

  constructor(scene, resident, atSecond) {
    this.#scene = scene;
    this.#resident = resident;
    this.#atSecond = atSecond;
  }

  load(characterId) {
    const resident = this.#resident;
    if (String(resident.operativeId) !== characterId) {
      throw new Error('The resident identity does not match the supply request.');
    }
    const groundSupplies = (this.#scene.groundItems ?? [])
      .filter((item) => {
        const kind = item.type === 'item' ? item.item : item.type;
        return (
          RECOVERABLE_RESIDENT_SUPPLIES.includes(kind) &&
          item.count > 0 &&
          (this.#scene.worldItemAvailability?.[item.id] ?? 0) <= this.#atSecond &&
          !item.heldBy &&
          !item.containerId &&
          !item.questId &&
          !item.questGift &&
          !item.questDelivery &&
          !item.ownerId &&
          !item.custodian &&
          (item.tacticalLevel ?? 0) === (resident.tacticalLevel ?? 0)
        );
      })
      .map(
        (item) =>
          new GroundSupply(
            item.id,
            item.type === 'item' ? item.item : item.type,
            item.count,
            item.x,
            item.y,
          ),
      );
    return {
      resident: new ResidentSupplies(
        characterId,
        resident.x,
        resident.y,
        resident.civilianSupplies,
      ),
      groundSupplies,
    };
  }

  commit(context) {
    for (const supply of context.groundSupplies) {
      if (!this.#scene.groundItems.some((item) => item.id === supply.id)) {
        throw new Error('The resident supply source no longer exists.');
      }
    }
    for (const supply of context.groundSupplies) {
      this.#scene.groundItems.find((item) => item.id === supply.id).count = supply.quantity;
    }
    this.#resident.civilianSupplies = { version: 1, ...context.resident.toSnapshot() };
  }
}

export function collectResidentSuppliesThrough(scene, targetSecond) {
  if (!Number.isSafeInteger(targetSecond) || targetSecond < 0) {
    throw new Error('The resident world time is invalid.');
  }
  const previousSecond =
    scene.residentScavengingSecond ??
    (scene.savedHour !== undefined
      ? scene.savedHour * 3600 + (scene.savedSecond ?? 0)
      : (scene.startSeconds ?? targetSecond));
  if (targetSecond < previousSecond) {
    throw new Error('Resident world time cannot move backwards.');
  }
  for (
    let second =
      (Math.floor(previousSecond / RESIDENT_SCAVENGING_INTERVAL_SECONDS) + 1) *
      RESIDENT_SCAVENGING_INTERVAL_SECONDS;
    second <= targetSecond;
    second += RESIDENT_SCAVENGING_INTERVAL_SECONDS
  ) {
    const residents = [...(scene.npcs ?? [])].sort((left, right) =>
      String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0,
    );
    for (const resident of residents) {
      if (
        resident.operativeId === undefined ||
        !resident.civilianSupplies ||
        resident.hp <= 0 ||
        resident.unconscious ||
        resident.departure ||
        resident.detention ||
        resident.escort ||
        resident.captured
      ) {
        continue;
      }
      const useCase = new CollectResidentSupplyUseCase(
        new SnapshotCollectResidentSupplyRepository(scene, resident, second),
      );
      const result = useCase.execute({ characterId: String(resident.operativeId) });
      if (result.collected) {
        scene.residentScavengingReceipts ??= [];
        scene.residentScavengingReceipts.push({
          id: `scavenging:${scene.sceneId ?? scene.sectorId}:${second}:${resident.operativeId}`,
          second,
          characterId: String(resident.operativeId),
          ...result.collected,
        });
      }
    }
  }
  scene.residentScavengingSecond = targetSecond;
}

export function validateResidentScavengingReceipts(scene) {
  if (scene.residentScavengingReceipts === undefined) {
    return;
  }
  if (!Array.isArray(scene.residentScavengingReceipts)) {
    throw new Error('Resident supply receipts must be a list.');
  }
  const identities = new Set();
  const lastSecond = Math.max(
    scene.worldTimeline?.currentSecond ?? 0,
    (scene.startSeconds ?? 0) + (scene.elapsedSeconds ?? 0),
  );
  for (const receipt of scene.residentScavengingReceipts) {
    const expectedId = `scavenging:${scene.sceneId ?? scene.sectorId}:${receipt.second}:${receipt.characterId}`;
    if (
      receipt.id !== expectedId ||
      identities.has(receipt.id) ||
      !Number.isSafeInteger(receipt.second) ||
      receipt.second < 0 ||
      receipt.second > lastSecond ||
      receipt.second % RESIDENT_SCAVENGING_INTERVAL_SECONDS !== 0 ||
      !RECOVERABLE_RESIDENT_SUPPLIES.includes(receipt.kind) ||
      ![receipt.characterId, receipt.groundId, receipt.itemId].every(
        (value) => typeof value === 'string' && value.length > 0,
      )
    ) {
      throw new Error('The resident supply receipt is invalid.');
    }
    identities.add(receipt.id);
  }
}
