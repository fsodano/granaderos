import { restoreSector, sectorPosition } from './infrastructure/world/sector-mapper.js';
import { RetainedSectorPresence } from './infrastructure/world/retained-sector-presence.js';
import { refreshResidentPositions } from './infrastructure/world/campaign-resident-positions.js';
import { validateResidentScavengingReceipts } from './resident-scavenging.js';
import { advanceMilitaryWoundClock } from './military-health.js';
import { advanceBattleClock } from './time.js';
import { returnEquipment, setCarriedLoading } from './equipment.js';
import { returnMedicalCare } from './medical-care.js';
import { rosterFor } from './recruitment.ts';
import { expandCellScene } from './cell-scene-storage.js';
import { CRITICAL_HEALTH, refreshMilitaryCondition } from './actor-condition.js';
import { Corpse } from './domain/world/corpse.ts';
import { ItemCustody, ItemCustodianKind } from './domain/world/item-custody.ts';
import { WorldTimeline, requireGameSecond } from './domain/world/world-timeline.ts';
import { AdvanceWorldTimeUseCase } from './application/world/advance-world-time/advance-world-time.use-case.ts';
import { SUPPLY_ITEMS, extractItemQuantity, itemQuantity } from './tactical-inventory.js';
import { wornBodyItems } from './outfits.ts';
import { syncUnitAmmunition } from './tactical-ammunition.js';
import {
  advanceResidentScavenging,
  acknowledgeRemovedResidents,
  advanceResidentConditions,
  acknowledgeResidentConditions,
} from './campaign-civilians.js';
import { advanceResidentRoutine } from './npc-ai.js';
import { ResidentRoutine } from './domain/world/resident-routine.ts';

function savedWorldSecond(snapshot, fallbackSecond) {
  if (snapshot.worldTimeline) {
    return snapshot.worldTimeline.currentSecond;
  }
  if (snapshot.savedHour !== undefined) {
    return snapshot.savedHour * 3600 + (snapshot.savedSecond ?? 0);
  }
  if (snapshot.startSeconds !== undefined) {
    return snapshot.startSeconds + (snapshot.elapsedSeconds ?? 0);
  }
  if (snapshot.enteredHour !== undefined) {
    return snapshot.enteredHour * 3600;
  }
  return fallbackSecond;
}

function recoverableEquipment(actor, kind = 'combatant') {
  let emptiedActor = structuredClone(actor);
  const equipment = [];
  if (kind === 'resident') {
    for (const [supply, quantity] of Object.entries(actor.civilianSupplies ?? {})) {
      if (!SUPPLY_ITEMS[supply] || quantity <= 0) {
        continue;
      }
      equipment.push({
        selection: `supply:${supply}`,
        stack: { item: supply, count: quantity, weight: SUPPLY_ITEMS[supply].weight },
      });
      emptiedActor.civilianSupplies[supply] = 0;
    }
    for (const slot of ['primary', 'blade']) {
      if (!actor.civilianWeapons?.[slot]) {
        continue;
      }
      equipment.push({
        selection: `weapon:${slot}`,
        stack: { item: 'weapon', ...structuredClone(actor.civilianWeapons[slot]) },
      });
      emptiedActor.civilianWeapons[slot] = null;
    }
    for (const [index, stack] of (actor.questGifts ?? []).entries()) {
      if (stack.count > 0) {
        equipment.push({ selection: `gift:${index}`, stack: structuredClone(stack) });
      }
    }
    emptiedActor.questGifts = [];
    return { emptiedActor, equipment };
  }
  const selections = [
    ...Object.keys(SUPPLY_ITEMS).filter((item) => item !== 'ammo' || actor.ammunitionVersion !== 2),
    ...(!actor.weaponDropped && actor.weapon ? ['primary'] : []),
    ...(actor.blade ? ['blade'] : []),
    ...(actor.offHand ? ['offhand'] : []),
    ...wornBodyItems(actor),
    ...(actor.equipmentCursor ? ['cursor'] : []),
    ...Object.keys(actor.inventory ?? {}).map((item) => `inventory:${item}`),
  ];
  for (const selection of selections) {
    const quantity = itemQuantity(emptiedActor, selection);
    if (!quantity) {
      continue;
    }
    const extracted = extractItemQuantity(emptiedActor, selection, quantity, {
      keepOtherHand: false,
    });
    equipment.push({ selection, stack: extracted.stack });
    emptiedActor = extracted.unit;
  }
  if (emptiedActor.ammunitionVersion === 2) {
    syncUnitAmmunition(emptiedActor);
  }
  return { emptiedActor, equipment };
}

class SnapshotAdvanceWorldTimeRepository {
  #snapshot;
  #targetSecond;
  #records = new Map();

  constructor(snapshot, targetSecond) {
    this.#snapshot = snapshot;
    this.#targetSecond = targetSecond;
  }

  load() {
    const snapshot = this.#snapshot;
    const previousSecond = savedWorldSecond(snapshot, this.#targetSecond);
    const timeline = snapshot.worldTimeline
      ? new WorldTimeline(snapshot.worldTimeline)
      : WorldTimeline.startAt(previousSecond);
    const corpses = [];
    const corpseEquipment = new Map();
    const sectorId = snapshot.sceneId ?? snapshot.sectorId;
    const actors = [
      ...(snapshot.units ?? []).map((actor) => ({ actor, kind: 'combatant' })),
      ...(snapshot.npcs ?? []).map((actor) => ({ actor, kind: 'resident' })),
    ];
    for (const { actor, kind } of actors) {
      if (kind === 'resident' && actor.hp !== 0) {
        continue;
      }
      if (actor.hp > 0 || actor.departure || actor.fled) {
        continue;
      }
      const corpse = actor.corpse
        ? new Corpse(actor.corpse)
        : Corpse.recordDeath(
            String(actor.id),
            sectorId,
            snapshot.worldTimeline ? this.#targetSecond : previousSecond,
          );
      if (!corpse.isPresent) {
        throw new Error('A removed corpse cannot still occupy a sector.');
      }
      const record = recoverableEquipment(actor, kind);
      const custody = record.equipment.map(
        ({ selection, stack }) =>
          new ItemCustody(stack.instanceId ?? `${corpse.id}:${selection}`, {
            kind: ItemCustodianKind.Corpse,
            id: corpse.id,
          }),
      );
      this.#records.set(corpse.id, { actor, kind, ...record });
      corpseEquipment.set(corpse.id, custody);
      corpses.push(corpse);
      timeline.schedule(corpse.removalEvent());
    }
    return { timeline, corpses, corpseEquipment };
  }

  commit(context, removedCorpseIds) {
    const snapshot = this.#snapshot;
    const removed = new Set(removedCorpseIds);
    const groundItems = structuredClone(snapshot.groundItems ?? []);
    const worldItemAvailability = { ...snapshot.worldItemAvailability };
    const deathHistory = structuredClone(snapshot.deathHistory ?? []);
    const groundIds = new Set(groundItems.map((item) => item.id));
    const sector = restoreSector(snapshot, context);
    for (const corpse of context.corpses) {
      const record = this.#records.get(corpse.id);
      if (!removed.has(corpse.id)) {
        continue;
      }
      if (deathHistory.some((death) => death.corpse.id === corpse.id)) {
        throw new Error('A death cannot be archived twice.');
      }
      const recoveredObjects = [];
      for (const [index, { selection, stack }] of record.equipment.entries()) {
        const id = `corpse:${corpse.id}:${selection}`;
        if (groundIds.has(id)) {
          throw new Error('Corpse equipment already has ground custody.');
        }
        groundIds.add(id);
        worldItemAvailability[id] = corpse.toSnapshot().removedAtSecond;
        recoveredObjects.push({
          id: `ground:${id}`,
          position: sectorPosition(record.actor),
          custodianId: `ground:${sector.id}`,
          itemIds: [context.corpseEquipment.get(corpse.id)[index].itemId],
        });
        groundItems.push({
          ...stack,
          id,
          type: 'item',
          x: record.actor.x,
          y: record.actor.y,
          ...(record.actor.tacticalLevel === undefined
            ? {}
            : { tacticalLevel: record.actor.tacticalLevel }),
          ...(record.actor.knownToPlayer === undefined
            ? {}
            : { knownToPlayer: record.actor.knownToPlayer }),
        });
      }
      sector.removeCorpse(corpse.id, context.corpseEquipment.get(corpse.id), recoveredObjects);
      delete record.emptiedActor.corpse;
      if (record.kind === 'resident') {
        record.emptiedActor.corpseRemovedAtSecond = corpse.toSnapshot().removedAtSecond;
      }
      deathHistory.push({
        corpse: corpse.toSnapshot(),
        kind: record.kind,
        actor: record.emptiedActor,
      });
    }
    const removedActorIds = new Set(removedCorpseIds.map((id) => this.#records.get(id).actor.id));
    snapshot.units = (snapshot.units ?? []).filter((actor) => !removedActorIds.has(actor.id));
    snapshot.npcs = (snapshot.npcs ?? []).filter((actor) => !removedActorIds.has(actor.id));
    for (const corpse of context.corpses) {
      if (corpse.isPresent) {
        this.#records.get(corpse.id).actor.corpse = corpse.toSnapshot();
      }
    }
    snapshot.groundItems = groundItems;
    snapshot.worldItemAvailability = worldItemAvailability;
    snapshot.deathHistory = deathHistory;
    snapshot.worldTimeline = context.timeline.toSnapshot();
  }
}

export function advanceSectorWorld(snapshot, targetSecond) {
  requireGameSecond(targetSecond);
  const useCase = new AdvanceWorldTimeUseCase(
    new SnapshotAdvanceWorldTimeRepository(snapshot, targetSecond),
  );
  return useCase.execute({ targetSecond });
}

export function advanceSectorWorldEvents(snapshot, targetSecond) {
  if (!snapshot.worldTimeline) {
    return;
  }
  const pendingEvents = snapshot.worldTimeline.pendingEvents;
  const unscheduledDeath = [...(snapshot.units ?? []), ...(snapshot.npcs ?? [])].some(
    (actor) =>
      actor.hp === 0 &&
      !actor.departure &&
      !actor.fled &&
      (!actor.corpse || !pendingEvents.some((event) => event.subjectId === actor.corpse.id)),
  );
  if (unscheduledDeath || (pendingEvents[0]?.atSecond ?? Infinity) <= targetSecond) {
    advanceSectorWorld(snapshot, targetSecond);
  }
}

export function advanceCampaignWorld(campaign) {
  const targetSecond = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
  const active = campaign.pendingBattle;
  const suspended = campaign.suspendedSectorSessions ?? [];
  for (const snapshot of [
    ...Object.values(campaign.sectorStates ?? {}),
    ...Object.values(campaign.sceneStates ?? {}),
  ]) {
    if (
      active &&
      snapshot.sectorId === active.sector &&
      (snapshot.sceneId ?? null) === (active.sceneId ?? null)
    ) {
      continue;
    }
    if (
      suspended.some(
        (session) =>
          session.snapshot.sectorId === snapshot.sectorId &&
          (session.snapshot.sceneId ?? null) === (snapshot.sceneId ?? null),
      )
    ) {
      continue;
    }
    advanceInactiveSectorWorld(campaign, snapshot, targetSecond);
  }
  for (const session of suspended) {
    advanceSuspendedSectorConditions(campaign, session, targetSecond);
  }
}

function advanceInactiveSectorWorld(campaign, snapshot, targetSecond, { suspended = false } = {}) {
  const previousSecond = savedWorldSecond(snapshot, targetSecond);
  advanceSectorWorld(snapshot, previousSecond);
  const expanded = expandCellScene(snapshot, campaign);
  const presence = suspended ? null : new RetainedSectorPresence(campaign);
  const physicalUnits = suspended
    ? snapshot.units
    : snapshot.units.filter((actor) => presence.includes(actor, snapshot));
  const routineField = { ...expanded, units: physicalUnits };
  refreshResidentPositions(campaign, routineField);
  routineField.residentRoutine ??= {
    startedAtSecond: snapshot.startSeconds ?? previousSecond,
    advancedThroughSecond: previousSecond,
  };
  let conditionsThroughSecond = previousSecond;
  const physicalIds = new Set(physicalUnits.map((actor) => actor.id));
  const synchronizeField = () => {
    for (const field of [
      'npcs',
      'groundItems',
      'worldItemAvailability',
      'worldTimeline',
      'deathHistory',
      'residentScavengingSecond',
      'residentScavengingReceipts',
      'residentConditionSecond',
      'militaryConditionSecond',
    ]) {
      if (snapshot[field] !== undefined) {
        routineField[field] = snapshot[field];
      }
    }
    routineField.units = snapshot.units.filter((actor) => physicalIds.has(actor.id));
  };
  const advanceConditionsTo = (atSecond) => {
    if (suspended) {
      advanceBattleClock(snapshot, atSecond - conditionsThroughSecond);
    }
    const actors = suspended
      ? snapshot.units
      : snapshot.units.filter(
          (actor) =>
            physicalIds.has(actor.id) &&
            (actor.side !== 'player' || actor.militia || actor.missionAlly),
        );
    advanceMilitaryWoundClock(snapshot, atSecond, {
      initialSecond: conditionsThroughSecond,
      actors,
    });
    advanceResidentConditions(campaign, snapshot, atSecond - conditionsThroughSecond, atSecond);
    conditionsThroughSecond = atSecond;
    synchronizeField();
  };
  advanceResidentRoutine(routineField, targetSecond, {
    beforeConditions: advanceConditionsTo,
    advanceWorldEvents(atSecond) {
      snapshot.npcs = routineField.npcs;
      advanceSectorWorldEvents(snapshot, atSecond);
      acknowledgeRemovedResidents(campaign, snapshot);
      synchronizeField();
    },
    afterPhase(atSecond) {
      snapshot.npcs = routineField.npcs;
      acknowledgeResidentConditions(campaign, snapshot, atSecond);
      advanceSectorWorldEvents(snapshot, atSecond);
      synchronizeField();
    },
    afterCollection(atSecond) {
      snapshot.groundItems = routineField.groundItems;
      snapshot.residentScavengingSecond = routineField.residentScavengingSecond;
      snapshot.residentScavengingReceipts = routineField.residentScavengingReceipts;
      if (snapshot.residentScavengingReceipts === undefined) {
        delete snapshot.residentScavengingReceipts;
      }
      advanceResidentScavenging(campaign, snapshot, atSecond);
    },
  });
  snapshot.residentRoutine = routineField.residentRoutine;
  refreshResidentPositions(campaign, snapshot);
  snapshot.civilianTurns = routineField.civilianTurns ?? snapshot.civilianTurns;
  if (snapshot.civilianTurns === undefined) {
    delete snapshot.civilianTurns;
  }
  if (Array.isArray(snapshot.tiles)) {
    snapshot.tiles = routineField.tiles;
  } else if (routineField.tiles.some((tile) => tile.type === 'door')) {
    snapshot.tiles = routineField.tiles;
  }
  advanceSectorWorld(snapshot, targetSecond);
  acknowledgeRemovedResidents(campaign, snapshot);
  advanceResidentScavenging(campaign, snapshot, targetSecond);
}

export function advanceSuspendedSectorConditions(campaign, session, targetSecond) {
  requireGameSecond(targetSecond);
  const snapshot = session.snapshot;
  const previousSecond = savedWorldSecond(snapshot, session.suspendedAtSeconds ?? targetSecond);
  if (targetSecond < previousSecond) {
    throw new Error('A suspended sector cannot move backwards in time.');
  }
  advanceInactiveSectorWorld(campaign, snapshot, targetSecond, { suspended: true });
  snapshot.syncedSeconds = snapshot.elapsedSeconds ?? 0;
  snapshot.savedHour = Math.floor(targetSecond / 3600);
  snapshot.savedSecond = targetSecond % 3600;
  session.request.syncedSeconds = snapshot.syncedSeconds;
  const roster = rosterFor(campaign);
  const issuedIds = new Set(
    [...(session.request.squad ?? []), ...(session.request.missionAllies ?? [])].map((actor) =>
      String(actor.id),
    ),
  );
  for (const actor of [...snapshot.units, ...removedSectorCharacters(snapshot)]) {
    if (actor.side !== 'player' || !issuedIds.has(String(actor.id))) {
      continue;
    }
    const character = roster.find((character) => String(character.id) === String(actor.id));
    const record = campaign.operativeState?.[actor.id];
    if (!character || !record) {
      continue;
    }
    returnMedicalCare(campaign, character.id, actor, character);
    returnEquipment(campaign, character.id, actor);
    Object.assign(record, {
      energy: actor.energy,
      fatigue: actor.fatigue,
      inventory: structuredClone(actor.inventory ?? {}),
      rations: actor.rations ?? 0,
      medkits: actor.medkits ?? 0,
      torches: actor.torches ?? 0,
      boleadoras: actor.boleadoras ?? 0,
    });
    if (actor.pocketOrder) {
      record.pocketOrder = structuredClone(actor.pocketOrder);
    } else {
      delete record.pocketOrder;
    }
    setCarriedLoading(record, actor);
    if (actor.hp === 0 && record.deathMinute === undefined) {
      const death =
        actor.corpse ?? snapshot.deathHistory.find((death) => death.actor.id === actor.id)?.corpse;
      record.deathMinute = Math.floor((death?.diedAtSecond ?? targetSecond) / 60);
    }
  }
}

/** @returns {import('./public/compatibility-types.ts').BattleUnit[]} */
export function removedSectorCharacters(snapshot) {
  return (snapshot.deathHistory ?? [])
    .filter((death) => death.kind !== 'resident')
    .map((death) => structuredClone(death.actor));
}

export function validateSectorWorld(snapshot) {
  if (snapshot) {
    validateResidentScavengingReceipts(snapshot);
  }
  if (!snapshot || (snapshot.worldTimeline === undefined && snapshot.deathHistory === undefined)) {
    return;
  }
  const timeline = new WorldTimeline(snapshot.worldTimeline);
  const simulatedSecond = Math.max(
    timeline.currentSecond,
    (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0),
  );
  if (snapshot.deathHistory !== undefined && !Array.isArray(snapshot.deathHistory)) {
    throw new Error('The sector death history must be a list.');
  }
  if (snapshot.residentRoutine !== undefined) {
    const routine = new ResidentRoutine(snapshot.residentRoutine);
    if (routine.toSnapshot().advancedThroughSecond > simulatedSecond) {
      throw new Error('Resident routines cannot exceed accepted world time.');
    }
  }
  if (snapshot.militaryConditionSecond !== undefined) {
    requireGameSecond(snapshot.militaryConditionSecond);
    if (snapshot.militaryConditionSecond > simulatedSecond) {
      throw new Error('Military conditions cannot exceed accepted world time.');
    }
  }
  if (snapshot.residentConditionSecond !== undefined) {
    requireGameSecond(snapshot.residentConditionSecond);
    if (snapshot.residentConditionSecond > simulatedSecond) {
      throw new Error('Resident conditions cannot exceed accepted world time.');
    }
  }
  if (snapshot.residentScavengingSecond !== undefined) {
    requireGameSecond(snapshot.residentScavengingSecond);
    if (snapshot.residentScavengingSecond > simulatedSecond) {
      throw new Error('Resident collection cannot exceed accepted world time.');
    }
  }
  for (const appearedAtSecond of Object.values(snapshot.worldItemAvailability ?? {})) {
    requireGameSecond(appearedAtSecond);
    if (appearedAtSecond > timeline.currentSecond) {
      throw new Error('Ground equipment cannot appear after accepted world time.');
    }
  }
  const identities = new Set();
  const completed = new Set(timeline.toSnapshot().completedEventIds);
  for (const death of snapshot.deathHistory ?? []) {
    const corpse = new Corpse(death.corpse);
    if (
      corpse.isPresent ||
      corpse.characterId !== String(death.actor?.originalUnitId ?? death.actor?.id) ||
      death.actor.hp !== 0 ||
      identities.has(corpse.id) ||
      !['combatant', 'resident'].includes(death.kind)
    ) {
      throw new Error('The sector death history is invalid.');
    }
    if (
      !completed.has(corpse.removalEvent().id) ||
      corpse.toSnapshot().removedAtSecond > timeline.currentSecond
    ) {
      throw new Error('The corpse removal has not completed on the world timeline.');
    }
    if (recoverableEquipment(death.actor, death.kind).equipment.length) {
      throw new Error('A removed corpse cannot retain equipment custody.');
    }
    identities.add(corpse.id);
  }
  for (const actor of [...(snapshot.units ?? []), ...(snapshot.npcs ?? [])]) {
    if (!actor.corpse) {
      continue;
    }
    const corpse = new Corpse(actor.corpse);
    if (
      !corpse.isPresent ||
      corpse.characterId !== String(actor.originalUnitId ?? actor.id) ||
      actor.hp !== 0 ||
      identities.has(corpse.id)
    ) {
      throw new Error('The physical corpse record is invalid.');
    }
    const event = timeline
      .toSnapshot()
      .pendingEvents.find((event) => event.id === corpse.removalEvent().id);
    if (
      !event ||
      event.subjectId !== corpse.id ||
      event.atSecond !== corpse.removalEvent().atSecond
    ) {
      throw new Error('The corpse removal schedule is missing.');
    }
    identities.add(corpse.id);
  }
}

export function previousDeploymentScene(campaign, request) {
  return expandCellScene(
    request.sceneId ? campaign.sceneStates[request.sceneId] : campaign.sectorStates[request.sector],
    campaign,
  );
}

// Keep dead bodies and incapacitated enemy casualties across visits. Only a
// new enemy garrison can reuse an identity. A casualty never becomes that recruit.
export function retainedMilitaryBodies(previous, deployed, sector) {
  const used = new Set([...deployed, ...(previous?.units ?? [])].map((u) => String(u.id)));
  return (previous?.units ?? [])
    .filter(
      (u) => u.hp <= 0 || (previous.sectorCleared && u.side === 'enemy' && u.hp < CRITICAL_HEALTH),
    )
    .map((raw) => {
      const body = structuredClone(raw),
        existing = deployed.find((u) => String(u.id) === String(raw.id));
      if (existing && existing.hp !== 0) {
        if (raw.side !== 'enemy') {
          throw Error('Un soldado fallecido no puede volver a entrar vivo.');
        }
        body.originalUnitId = raw.id;
        const base = `${raw.hp <= 0 ? 'corpse' : 'casualty'}:${previous.battleId ?? sector}:${raw.id}`;
        let id = base,
          suffix = 0;
        while (used.has(id)) {
          id = `${base}:${++suffix}`;
        }
        body.id = id;
        used.add(id);
      }
      return refreshMilitaryCondition(body);
    });
}

// The UI includes visible player bodies in its report. Exclude only deaths
// already stored in this scene and outside the current deployed roster.
export function withoutPreviousCasualties(previous, request, reports, snapshot) {
  if (
    !Array.isArray(reports) ||
    new Set(reports.map((r) => String(r?.id))).size !== reports.length
  ) {
    throw Error('El parte de la escuadra es inválido.');
  }
  const deployed = new Set(
    [...(request.squad ?? []), ...(request.garrison ?? []), ...(request.missionAllies ?? [])].map(
      (u) => String(u.id),
    ),
  );
  const historical = previous
    ? [...(previous.units ?? []), ...removedSectorCharacters(previous)]
    : [];
  const returned = snapshot
    ? [...(snapshot.units ?? []), ...removedSectorCharacters(snapshot)]
    : [];
  const bodies = new Set(
    historical
      .filter((u) => u.side === 'player' && u.hp === 0 && !deployed.has(String(u.id)))
      .map((u) => String(u.id)),
  );
  for (const unit of snapshot?.units ?? []) {
    if (bodies.has(String(unit.id)) && unit.hp !== 0) {
      throw Error('El parte modifica una baja ya confirmada.');
    }
  }
  return reports.filter((report) => {
    if (!report || typeof report !== 'object') {
      throw Error('El parte de la escuadra es inválido.');
    }
    if (!bodies.has(String(report.id))) {
      return true;
    }
    if (
      report.hp !== 0 ||
      !returned.some((u) => String(u.id) === String(report.id) && u.side === 'player' && u.hp === 0)
    ) {
      throw Error('El parte modifica una baja ya confirmada.');
    }
    return false;
  });
}
