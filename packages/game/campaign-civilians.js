import { advanceResidentWoundClock } from './npc-ai.js';
import {
  hasPendingDetentionHealth,
  acknowledgeDetentionHealth,
  validateCampaignDetention,
} from './campaign-detention.js';
import {
  civilianWeaponsFor,
  acknowledgeCivilianWeapons,
  validateCivilianWeaponRecoveries,
} from './civilian-weapons.js';
import { validateMovementScene } from './dialogue-movement.js';
import { validWorldLocation, locationId } from './world-cells.ts';
import { characterForOperative, isContractOperative } from './content-character-ids.ts';
import { rosterFor } from './recruitment.ts';
import { encounterDefinitions } from './encounters.js';
import { scenarioFor, sceneAnchorFor, isCampaignScene } from './campaign-scenario.js';
import { authoredOperative } from './content-roster.ts';
import {
  civilianMaxHp,
  civilianRestoredHp,
  seedCivilianHealth,
  migrateCivilianHealth,
} from './civilian-health.js';
import {
  civilianIncidents,
  validateCivilianWounds,
  advanceCivilianWoundTime,
} from './civilian-harm.js';
import { recordCityLoyalty, cityForSector, validCityLoyaltyEvents } from './cities.js';
import { failQuestsForDeadContact } from './quests.js';
import {
  CIVILIAN_SUPPLY_FIELDS,
  civilianSuppliesFor,
  validCivilianSupplies,
} from './civilian-supplies.js';
import { collectResidentSuppliesThrough } from './resident-scavenging.js';

function unacknowledgedSupplyReceipts(campaign, scene, resident) {
  const accepted =
    campaign.civilianState?.people?.[civilianKey(resident)]?.scavengingReceiptIds ?? [];
  return (scene.residentScavengingReceipts ?? []).filter(
    (receipt) =>
      receipt.characterId === String(operativeId(resident, campaign)) &&
      !accepted.includes(receipt.id),
  );
}

export function advanceResidentScavenging(campaign, scene, targetSecond) {
  collectResidentSuppliesThrough(scene, targetSecond);
  if (!campaign.civilianState) {
    return;
  }
  for (const resident of scene.npcs ?? []) {
    const id = operativeId(resident, campaign);
    if (
      !campaign.operativeState?.[id] ||
      campaign.recruited.includes(id) ||
      !unacknowledgedSupplyReceipts(campaign, scene, resident).length
    ) {
      continue;
    }
    remember(campaign, resident, scene);
    for (const projection of residentScenes(campaign)) {
      for (const actor of projection.npcs ?? []) {
        if (operativeId(actor, campaign) === id) {
          actor.civilianSupplies = structuredClone(resident.civilianSupplies);
        }
      }
    }
  }
}

export function acknowledgeRemovedResidents(campaign, snapshot) {
  for (const death of snapshot.deathHistory ?? []) {
    if (death.kind !== 'resident') {
      continue;
    }
    const actor = death.actor;
    const record = campaign.civilianState?.people?.[civilianKey(actor)];
    if (!record || record.corpseRemovedAtSecond !== undefined) {
      continue;
    }
    need(record.health.hp === 0, 'No se puede retirar el cuerpo de un habitante vivo.');
    record.corpseRemovedAtSecond = death.corpse.removedAtSecond;
    const id = operativeId(actor, campaign);
    if (campaign.operativeState?.[id]) {
      for (const field of CIVILIAN_SUPPLY_FIELDS) {
        campaign.operativeState[id][field] = actor.civilianSupplies?.[field] ?? 0;
      }
      if (campaign.loadouts?.[id]) {
        campaign.loadouts[id] = { ...campaign.loadouts[id], weapon: 0, blade: 0 };
      }
      campaign.operativeState[id].carriedLoaded = 0;
      delete campaign.operativeState[id].carriedReloadProgress;
    }
  }
}

function residentScenes(campaign) {
  return [
    ...Object.values(campaign.sectorStates ?? {}),
    ...Object.values(campaign.sceneStates ?? {}),
    campaign.pendingBattle,
    ...(campaign.suspendedSectorSessions ?? []).flatMap((session) => [
      session.request,
      session.snapshot,
    ]),
  ].filter(Boolean);
}

function reportedResidents(snapshot, expected) {
  const historical = (snapshot.deathHistory ?? [])
    .filter(
      (death) =>
        death.kind === 'resident' && expected.some((resident) => resident.id === death.actor.id),
    )
    .map((death) => death.actor);
  return [...(snapshot.npcs ?? []), ...historical].filter(
    (resident) => resident.detention === undefined,
  );
}

const need = (ok, message = 'El estado de los habitantes no coincide con la campaña.') => {
  if (!ok) {
    throw Error(message);
  }
};
const fields = [
  'civilianHealthVersion',
  'maxHp',
  'hp',
  'energy',
  'unconscious',
  'civilianWoundVersion',
  'civilianWoundSeconds',
  'bleeding',
  'bandaged',
  'bleedSource',
  'civilianHarm',
  'civilianFirstAid',
];
const physical = (n) =>
  Object.fromEntries(
    fields.filter((k) => n[k] !== undefined).map((k) => [k, structuredClone(n[k])]),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const operativeId = (n, s = null) => scenarioFor(s).missionCivilianOperativeId(n);
function supplies(s, n) {
  if (s.operativeState[operativeId(n, s)]?.serviceEquipmentReturn) {
    return civilianSuppliesFor(null);
  }
  const id = operativeId(n, s),
    result = civilianSuppliesFor(s.operativeState[id]);
  const prior = Object.values(s.missionAllies ?? {}).find((ally) => Number(ally.id) === id);
  if (
    prior &&
    s.operativeState[id]?.missionSuppliesVersion !== 1 &&
    !s.civilianState?.people[`person-${id}`]
  ) {
    const carried = civilianSuppliesFor(prior);
    for (const k of CIVILIAN_SUPPLY_FIELDS) {
      result[k] = Math.min(result[k], carried[k]);
    }
  }
  return result;
}
export const civilianKey = (n) =>
  operativeId(n) !== undefined ? `person-${operativeId(n)}` : `npc-${n.id}`;
const civicSector = (s, r) => sceneAnchorFor(s, r.sector);
const deathEventIds = (key, r, death) => [
  `civilian:${key}`,
  `civilian:${JSON.stringify([r.sector, r.sceneId, r.npcId])}:${death.sequence}`,
];
function deathKind(death, owner) {
  const kind =
    death.side === 'player'
      ? death.militia
        ? 'civilianMilitia'
        : 'civilianPlayerIntentional'
      : owner === 'patriot'
        ? 'civilianEnemyPatriot'
        : 'civilianEnemyRoyalist';
  return death.intentional
    ? kind
    : kind === 'civilianPlayerIntentional'
      ? 'civilianPlayerAccidental'
      : `${kind}Accidental`;
}
function validateDeathEffects(s) {
  const events = (s.cityLoyaltyEvents ?? []).filter((e) => e.kind?.startsWith('civilian')),
    used = new Set();
  need(validCityLoyaltyEvents(events, s), 'El registro de lealtad civil no es válido.');
  for (const [key, r] of Object.entries(s.civilianState.people)) {
    const death = civilianIncidents(r.health).find((e) => e.kind === 'death');
    if (!death || death.side === 'unknown' || !cityForSector(civicSector(s, r), s)) {
      continue;
    }
    const ids = deathEventIds(key, r, death),
      matches = events.filter((e) => ids.includes(e.eventId));
    need(matches.length === 1, 'Falta el efecto de una muerte civil, o está repetido.');
    const event = matches[0];
    // Control can change after the death. The recorded civic kind preserves
    // that earlier control; it must still match the recorded responsibility.
    need(
      event.sectorId === civicSector(s, r) &&
        event.hour <= s.hour &&
        ['patriot', 'royalist'].some((owner) => deathKind(death, owner) === event.kind),
      'El efecto civil no corresponde a la muerte registrada.',
    );
    used.add(event.key);
  }
  need(
    used.size === events.length,
    'El registro de lealtad tiene un efecto civil sin una muerte registrada.',
  );
}
function definition(s, n) {
  const original = [...encounterDefinitions(s), ...scenarioFor(s).missionNPCs].find(
    (v) => v.id === n.id,
  );
  need(
    original && original.operativeId === n.operativeId,
    'El habitante no pertenece a este mundo.',
  );
  return original;
}
function service(s, n) {
  const id = operativeId(n, s),
    base = rosterFor(s).find((o) => o.id === id);
  if (!base) {
    return undefined;
  }
  const current = { ...authoredOperative(s, base), ...s.operativeState[id] },
    prior = Object.values(s.missionAllies ?? {}).find((ally) => Number(ally.id) === id);
  // Old saves kept mission wounds only on the retained ally. Until a civilian
  // receipt exists, that earlier injury must not be replaced by a full roster HP.
  if (prior && !s.civilianState?.people[`person-${id}`]) {
    current.hp = Math.min(current.hp, prior.hp);
    current.energy = Math.min(current.energy ?? 100, prior.energy ?? 100);
    current.bleeding = Math.max(current.bleeding ?? 0, prior.bleeding ?? 0);
  }
  return current;
}
export function campaignCivilian(s, n, { fromService = false } = {}) {
  const record = s.civilianState?.people[civilianKey(n)],
    id = operativeId(n, s);
  const metadata = { ...n };
  for (const k of fields) {
    delete metadata[k];
  }
  if (record && !fromService && !record.inService && !s.recruited.includes(id)) {
    return {
      ...metadata,
      ...structuredClone(record.health),
      civilianSupplies: supplies(s, n),
      civilianWeapons: civilianWeaponsFor(s, id),
    };
  }
  const seeded = seedCivilianHealth(metadata, service(s, n));
  if (record?.health.civilianHarm && seeded.hp > 0 && record.health.hp > 0) {
    seeded.civilianHarm = structuredClone(record.health.civilianHarm);
  }
  return {
    ...seeded,
    civilianSupplies: supplies(s, n),
    civilianWeapons: civilianWeaponsFor(s, id),
  };
}
export function civilianDiedHere(s, n, sector, sceneId = null) {
  const record = s.civilianState?.people[civilianKey(n)];
  return Boolean(
    record?.health.hp === 0 &&
    record.corpseRemovedAtSecond === undefined &&
    !record.inService &&
    record.sector === sector &&
    record.sceneId === sceneId &&
    record.npcId === n.id,
  );
}
function applyDeath(s, n, record, atHour = s.hour) {
  const death = civilianIncidents(n).find((e) => e.kind === 'death');
  if (death && death.side !== 'unknown') {
    const ids = deathEventIds(civilianKey(n), record, death);
    // Earlier saves used the scene identity. Preserve the existing effect
    // instead of applying the same death again under the current identity.
    if (!(s.cityLoyaltyEvents ?? []).some((e) => ids.includes(e.eventId))) {
      const result = recordCityLoyalty(s, {
        sectorId: civicSector(s, record),
        kind: deathKind(death, s.sectors[civicSector(s, record)]?.owner),
        eventId: ids[0],
      });
      if (result.applied) {
        s.log.unshift({
          hour: atHour,
          text: `La muerte de un habitante modifica el apoyo local (${result.delta > 0 ? '+' : ''}${result.delta}).`,
        });
      }
    }
  }
  for (const text of failQuestsForDeadContact(s, record.sector, record.sceneId, n.id, atHour)) {
    s.log.unshift({ hour: atHour, text });
  }
  s.log = s.log.slice(0, 80);
  scenarioFor(s).onCivilianDeath(s, n, record, atHour);
}
function remember(s, n, scene, deathSecond) {
  const key = civilianKey(n),
    before = s.civilianState.people[key];
  const removedAt = n.corpseRemovedAtSecond ?? before?.corpseRemovedAtSecond;
  const receiptIds = [
    ...new Set([
      ...(before?.scavengingReceiptIds ?? []),
      ...unacknowledgedSupplyReceipts(s, scene, n).map((receipt) => receipt.id),
    ]),
  ];
  const record = {
    npcId: n.id,
    sector: scene.sectorId ?? scene.sector,
    sceneId: scene.sceneId ?? null,
    health: physical(n),
    ...(removedAt === undefined ? {} : { corpseRemovedAtSecond: removedAt }),
    ...(receiptIds.length ? { scavengingReceiptIds: receiptIds } : {}),
  };
  s.civilianState.people[key] = record;
  const id = operativeId(n, s);
  if (id !== undefined && !s.recruited.includes(id)) {
    Object.assign(s.operativeState[id], {
      hp: Math.ceil(n.hp),
      alive: n.hp > 0,
      energy: n.energy,
      bleeding: n.bleeding ?? 0,
      bandaged: n.bandaged ?? 0,
    });
    if (n.civilianSupplies !== undefined) {
      need(
        validCivilianSupplies(n.civilianSupplies),
        'Los suministros del habitante no son válidos.',
      );
      if (!s.operativeState[id].serviceEquipmentReturn) {
        for (const k of CIVILIAN_SUPPLY_FIELDS) {
          s.operativeState[id][k] = n.civilianSupplies[k];
        }
      }
    }
  }
  if (n.hp === 0 && before?.health.hp !== 0) {
    if (deathSecond !== undefined && id !== undefined) {
      s.operativeState[id].deathMinute = Math.floor(deathSecond / 60);
    }
    applyDeath(s, n, record, deathSecond === undefined ? s.hour : Math.floor(deathSecond / 3600));
  }
}
function compareHistory(previous, n) {
  const old = civilianIncidents(previous),
    now = civilianIncidents(n);
  need(
    now.length >= old.length && old.every((e, i) => same(e, now[i])),
    'Se perdió el historial de heridas del habitante.',
  );
  const restored = civilianRestoredHp(n) - civilianRestoredHp(previous);
  need(
    restored >= 0 && n.hp <= previous.hp + restored,
    'La salud del habitante aumentó sin atención médica.',
  );
  need(previous.hp > 0 || n.hp === 0, 'Un habitante muerto no puede reaparecer vivo.');
  need(civilianMaxHp(n) === civilianMaxHp(previous), 'La salud máxima del habitante cambió.');
}
function civilianReport(s, snapshot) {
  const request = s.pendingBattle;
  need(
    request &&
      snapshot.sectorId === request.sector &&
      (snapshot.sceneId ?? null) === (request.sceneId ?? null) &&
      (!snapshot.battleId || snapshot.battleId === request.id),
  );
  validateMovementScene(s, snapshot);
  const expected = request.npcs ?? [],
    residents = reportedResidents(snapshot, expected),
    seen = new Set(),
    plans = [];
  need(residents.length === expected.length, 'Faltan habitantes en el parte del sector.');
  hasPendingDetentionHealth(s, snapshot);
  for (const n of residents) {
    need(!seen.has(n.id), 'El parte repite a un habitante.');
    seen.add(n.id);
    definition(s, n);
    validateCivilianWounds(n, snapshot);
    const prior = expected.find((v) => v.id === n.id);
    need(
      prior &&
        prior.operativeId === n.operativeId &&
        prior.contentId === n.contentId &&
        prior.presenceRevision === n.presenceRevision &&
        !s.recruited.includes(operativeId(n, s)),
    );
    const previous = campaignCivilian(s, prior);
    compareHistory(previous, n);
    // Validate the report before changing campaign custody or health.
    const carried = n.civilianSupplies ?? previous.civilianSupplies;
    const collected = unacknowledgedSupplyReceipts(s, snapshot, n);
    need(
      validCivilianSupplies(carried) &&
        CIVILIAN_SUPPLY_FIELDS.every(
          (k) =>
            carried[k] <=
            previous.civilianSupplies[k] + collected.filter((receipt) => receipt.kind === k).length,
        ),
      'Los suministros del habitante aumentaron sin una entrega.',
    );
    for (const e of civilianIncidents(n).slice(civilianIncidents(previous).length)) {
      if (e.side !== 'unknown') {
        const actor = [
            ...snapshot.units,
            ...(snapshot.deathHistory ?? [])
              .filter((record) => record.kind === 'combatant')
              .map((record) => record.actor),
          ].find((u) => String(u.id) === e.attackerId),
          source = previous.bleedSource;
        need(
          (actor && actor.side === e.side && Boolean(actor.militia) === e.militia) ||
            (e.kind === 'death' &&
              source &&
              ['attackerId', 'side', 'militia', 'intentional'].every((k) => source[k] === e[k])),
          'El responsable de la nueva herida no está en el sector.',
        );
      }
    }
    plans.push({ n, previous, carried });
  }
  return plans;
}
export function hasPendingCivilians(s, snapshot) {
  const plans = civilianReport(s, snapshot);
  return (
    hasPendingDetentionHealth(s, snapshot) ||
    plans.some(
      ({ n, previous, carried }) =>
        !s.civilianState?.people[civilianKey(n)] ||
        !same(physical(n), physical(previous)) ||
        !same(carried, previous.civilianSupplies) ||
        !same(n.civilianWeapons, previous.civilianWeapons),
    )
  );
}
export function acknowledgeCivilians(s, snapshot) {
  const plans = civilianReport(s, snapshot),
    request = s.pendingBattle;
  s.civilianState ??= { version: 1, people: {} };
  acknowledgeDetentionHealth(s, snapshot);
  for (const { n, previous, carried } of plans) {
    acknowledgeCivilianWeapons(s, operativeId(n, s), previous, n);
    n.civilianSupplies ??= structuredClone(carried);
    remember(s, n, snapshot);
  }
  acknowledgeRemovedResidents(s, snapshot);
  for (const ally of [
    ...snapshot.units,
    ...(snapshot.deathHistory ?? [])
      .filter((record) => record.kind === 'combatant')
      .map((record) => record.actor),
  ].filter((u) => u.missionAlly)) {
    const id = Number(ally.id);
    if (!request.missionAllies?.some((u) => Number(u.id) === id)) {
      continue;
    }
    need(s.operativeState[id], 'Falta la hoja de servicio del aliado.');
    Object.assign(s.operativeState[id], {
      hp: Math.ceil(ally.hp),
      alive: ally.hp > 0,
      energy: ally.energy,
      bleeding: ally.bleeding ?? 0,
      bandaged: ally.bandaged ?? 0,
    });
    const carried = civilianSuppliesFor(ally);
    for (const k of CIVILIAN_SUPPLY_FIELDS) {
      s.operativeState[id][k] = carried[k];
    }
    s.operativeState[id].missionSuppliesVersion = 1;
    const record = s.civilianState.people[`person-${id}`];
    if (record) {
      record.inService = true;
    }
    if (ally.hp === 0) {
      for (const scene of [...Object.values(s.sectorStates), ...Object.values(s.sceneStates)]) {
        scene.npcs = (scene.npcs ?? []).filter((n) => operativeId(n, s) !== id);
      }
    }
  }

  refreshCivilianScenes(s);
}
function refreshCivilianScenes(s) {
  // A retained tactical scene is only a cache. Keep its physical state in step
  // with the single identity, including the currently loaded request.
  for (const scene of residentScenes(s)) {
    for (const n of scene.npcs ?? []) {
      if (n.detention !== undefined) {
        continue;
      }
      const record = s.civilianState.people[civilianKey(n)];
      if (
        (record || scenarioFor(s).missionNPCs.some((original) => original.id === n.id)) &&
        !s.recruited.includes(operativeId(n, s))
      ) {
        const actor = campaignCivilian(s, n),
          current = physical(actor);
        if (!same(physical(n), current)) {
          for (const k of fields) {
            delete n[k];
          }
          Object.assign(n, current);
        }
        n.civilianSupplies = actor.civilianSupplies;
        n.civilianWeapons = actor.civilianWeapons;
      }
    }
  }
  for (const scene of residentScenes(s)) {
    scene.npcs = (scene.npcs ?? []).filter(
      (n) =>
        n.detention !== undefined ||
        n.hp > 0 ||
        civilianDiedHere(s, n, scene.sectorId ?? scene.sector, scene.sceneId ?? null),
    );
  }
}
// Start authored wounds when a living resident actually enters the world.
// Bulletin candidates and dormant successors have no physical clock here.
function placedResidents(s) {
  if (!s.contentPresence) {
    return [];
  }
  return encounterDefinitions(s).flatMap((n) => {
    const id = operativeId(n, s),
      c = id !== undefined && characterForOperative(s, id),
      person = c && s.contentPresence.people[c.id];
    if (
      !person?.alive ||
      !person.appeared ||
      person.suspended ||
      person.recruited ||
      s.recruited.includes(id) ||
      isContractOperative(s, { id }) ||
      s.operativeState[id]?.captured ||
      s.pendingBattle?.missionAllies?.some((u) => Number(u.id) === id)
    ) {
      return [];
    }
    const sector = locationId(person.sector, s);
    return sector ? [{ n, id, sector }] : [];
  });
}
export function synchronizeResidentWounds(s) {
  if (!s.civilianState) {
    return;
  }
  for (const { n, id, sector } of placedResidents(s)) {
    const record = s.civilianState.people[civilianKey(n)];
    if (record) {
      // A mobile living identity carries its wounds to the new cell. A corpse
      // retains the place of death, even if its former placement was mobile.
      if (record.npcId === n.id && !record.inService && record.health.hp > 0) {
        record.sector = sector;
        record.sceneId = null;
      }
    } else if (s.operativeState[id].bleeding > 0) {
      remember(s, campaignCivilian(s, n), { sector, sceneId: null });
    }
  }
}
export function migrateResidentWounds(s) {
  if (s.civilianState.version !== 1) {
    return false;
  }
  // Start older unseen wounds from saved health and time, without damage for
  // elapsed hours that the old version never simulated.
  s.civilianState.version = 2;
  synchronizeResidentWounds(s);
  return true;
}
function unloadedWounds(s) {
  const excluded = new Set([
    ...(s.pendingBattle?.npcs ?? []).map(civilianKey),
    ...s.recruited.map((id) => `person-${id}`),
  ]);
  return Object.entries(s.civilianState?.people ?? {}).filter(
    ([key, r]) => !excluded.has(key) && !r.inService && r.health.hp > 0 && r.health.bleeding > 0,
  );
}
export function nextUnloadedCivilianDeath(s) {
  return Math.min(
    Infinity,
    ...unloadedWounds(s).map(
      ([, r]) =>
        Math.ceil(r.health.hp / r.health.bleeding) * 6 - (r.health.civilianWoundSeconds ?? 0),
    ),
  );
}
// The campaign clock advances residents outside the loaded scene. Its endpoint
// is already on s; loaded actors are advanced only by the tactical clock.
export function advanceUnloadedCivilians(s, seconds) {
  need(Number.isSafeInteger(seconds) && seconds >= 0, 'El tiempo de los habitantes no es válido.');
  if (!seconds || !s.civilianState) {
    return;
  }
  const start = s.hour * 3600 + (s.secondOfHour ?? 0) - seconds;
  let changed = false;
  for (const [, record] of unloadedWounds(s)) {
    const original =
      encounterDefinitions(s).find((n) => n.id === record.npcId) ??
      scenarioFor(s).missionNPCs.find((n) => n.id === record.npcId);
    need(original, 'El habitante no pertenece a este mundo.');
    if (s.recruited.includes(operativeId(original, s))) {
      continue;
    }
    if (
      residentScenes(s).some(
        (scene) =>
          scene !== s.pendingBattle &&
          (scene.sectorId ?? scene.sector) === record.sector &&
          (scene.sceneId ?? null) === record.sceneId &&
          scene.npcs?.some((resident) => resident.id === record.npcId),
      )
    ) {
      continue;
    }
    const n = { ...original, ...structuredClone(record.health) };
    const deathSecond = start + Math.ceil(n.hp / n.bleeding) * 6 - (n.civilianWoundSeconds ?? 0);
    advanceCivilianWoundTime({}, n, seconds);
    remember(s, n, record, n.hp === 0 ? deathSecond : undefined);
    changed = true;
    if (n.hp === 0) {
      s.log.unshift({
        hour: Math.floor(deathSecond / 3600),
        text: `${n.name} murió por sus heridas mientras la escuadra estaba fuera del sector.`,
      });
      s.log = s.log.slice(0, 80);
    }
  }
  if (changed) {
    refreshCivilianScenes(s);
  }
}

export function acknowledgeResidentConditions(campaign, scene, atSecond) {
  if (!campaign.civilianState) {
    return;
  }
  for (const resident of scene.npcs ?? []) {
    if (resident.detention || campaign.recruited.includes(operativeId(resident, campaign))) {
      continue;
    }
    const canonical = campaignCivilian(campaign, resident);
    if (!same(physical(resident), physical(canonical))) {
      remember(
        campaign,
        resident,
        scene,
        resident.hp === 0 ? (resident.corpse?.diedAtSecond ?? atSecond) : undefined,
      );
    }
  }
}

export function advanceResidentConditions(campaign, scene, seconds, atSecond) {
  need(
    Number.isSafeInteger(seconds) &&
      seconds >= 0 &&
      Number.isSafeInteger(atSecond) &&
      atSecond >= seconds,
    'El tiempo de los habitantes no es válido.',
  );
  advanceResidentWoundClock(scene, atSecond, { initialSecond: atSecond - seconds });
  acknowledgeResidentConditions(campaign, scene, atSecond);
}

// The service sheet is authoritative until departure. Resume a previously
// encountered world identity once, using its current wounds and finite stock.
// The active request is never populated here; reentry admits the returning NPC.
export function resumeCivilianServiceReturns(s) {
  if (!s.civilianState || !s.contentPresence) {
    return false;
  }
  let changed = false;
  for (const [key, record] of Object.entries(s.civilianState.people)) {
    if (!record.inService) {
      continue;
    }
    const original = encounterDefinitions(s).find((n) => civilianKey(n) === key),
      id = original && operativeId(original, s),
      serviceRecord = s.operativeState[id];
    if (
      id === undefined ||
      isContractOperative(s, { id }) ||
      s.recruited.includes(id) ||
      s.pendingBattle?.missionAllies?.some((u) => Number(u.id) === id) ||
      !serviceRecord?.alive ||
      serviceRecord.hp <= 0 ||
      serviceRecord.captured
    ) {
      continue;
    }
    const character = characterForOperative(s, id),
      person = character && s.contentPresence.people[character.id],
      sector = person && locationId(person.sector, s);
    if (!person?.alive || person.recruited || !person.appeared || !sector) {
      continue;
    }
    need(record.health.hp > 0, 'Un habitante muerto no puede volver del servicio.');
    const current = campaignCivilian(s, original, { fromService: true });
    remember(s, current, { sector, sceneId: null });
    changed = true;
  }
  if (changed) {
    refreshCivilianScenes(s);
  }
  return changed;
}

export function transferCivilian(s, n) {
  const key = civilianKey(n);
  if (s.civilianState?.people[key]) {
    s.civilianState.people[key].inService = true;
  }
  for (const scene of residentScenes(s)) {
    scene.npcs = (scene.npcs ?? []).filter((v) => civilianKey(v) !== key);
  }
}
export function validateCivilianScene(s, scene, { active = false } = {}) {
  if (active) {
    const residents = reportedResidents(scene, s.pendingBattle.npcs ?? []);
    need(
      residents.length === (s.pendingBattle.npcs ?? []).length &&
        (s.pendingBattle.npcs ?? []).every((n) => residents.some((v) => v.id === n.id)),
      'Faltan habitantes en el sector guardado.',
    );
  }
  for (const n of scene.npcs ?? []) {
    if (n.detention !== undefined) {
      continue;
    }
    definition(s, n);
    validateCivilianWounds(n, scene);
    const record = s.civilianState?.people[civilianKey(n)];
    need(!s.recruited.includes(operativeId(n, s)));
    const expected = campaignCivilian(s, n);
    need(same(physical(n), physical(expected)));
    need(
      same(n.civilianWeapons, expected.civilianWeapons),
      'Las armas guardadas del habitante no coinciden con su ficha.',
    );
    need(
      validCivilianSupplies(n.civilianSupplies) &&
        CIVILIAN_SUPPLY_FIELDS.every((k) => n.civilianSupplies[k] === expected.civilianSupplies[k]),
      'Los suministros guardados del habitante no coinciden con su ficha.',
    );
    if (n.hp === 0) {
      need(civilianDiedHere(s, n, scene.sectorId ?? scene.sector, scene.sceneId ?? null));
    }
    if (record && !record.inService) {
      need(record.health.hp === n.hp);
    }
  }
}
export function validateCampaignCivilians(s) {
  validateCampaignDetention(s);
  validateCivilianWeaponRecoveries(s);
  const ledger = s.civilianState;
  need(
    ledger &&
      [1, 2].includes(ledger.version) &&
      ledger.people &&
      typeof ledger.people === 'object' &&
      !Array.isArray(ledger.people),
  );
  need(
    Object.keys(ledger).length === 2 &&
      Object.keys(ledger.people).length <=
        encounterDefinitions(s).length + scenarioFor(s).missionNPCs.length,
  );
  for (const [key, r] of Object.entries(ledger.people)) {
    const n = definition(s, {
      id: r.npcId,
      operativeId: encounterDefinitions(s).find((n) => n.id === r.npcId)?.operativeId,
    });
    need(
      civilianKey(n) === key &&
        Object.keys(r).every((k) =>
          [
            'npcId',
            'sector',
            'sceneId',
            'health',
            'inService',
            'corpseRemovedAtSecond',
            'scavengingReceiptIds',
          ].includes(k),
        ),
    );
    if (r.corpseRemovedAtSecond !== undefined) {
      need(
        r.health.hp === 0 &&
          Number.isSafeInteger(r.corpseRemovedAtSecond) &&
          r.corpseRemovedAtSecond >= 0 &&
          r.corpseRemovedAtSecond <= s.hour * 3600 + (s.secondOfHour ?? 0),
      );
    }
    need(
      (validWorldLocation(r.sector, s) || isCampaignScene(s, r.sector)) &&
        (r.sceneId === null ||
          (isCampaignScene(s, r.sceneId) && sceneAnchorFor(s, r.sceneId) === r.sector)) &&
        r.health &&
        Object.keys(r.health).every((k) => fields.includes(k)),
    );
    validateCivilianWounds(r.health);
    const id = operativeId(n, s);
    need(r.inService === undefined || (r.inService === true && id !== undefined));
    if (r.scavengingReceiptIds !== undefined) {
      need(
        Array.isArray(r.scavengingReceiptIds) &&
          new Set(r.scavengingReceiptIds).size === r.scavengingReceiptIds.length &&
          r.scavengingReceiptIds.every(
            (id) => typeof id === 'string' && id.startsWith('scavenging:'),
          ),
      );
    }
    need(!r.inService || r.health.hp > 0, 'Un habitante muerto no puede trasladarse al servicio.');
    if (id !== undefined && !r.inService && !s.recruited.includes(id)) {
      need(
        s.operativeState[id].hp === r.health.hp && s.operativeState[id].alive === r.health.hp > 0,
      );
    }
  }
  validateDeathEffects(s);
  if (ledger.version === 2) {
    for (const { n, id, sector } of placedResidents(s)) {
      const record = ledger.people[civilianKey(n)];
      if (s.operativeState[id].bleeding > 0) {
        need(record, 'Falta el reloj de un habitante herido.');
      }
      if (record?.npcId === n.id && !record.inService && record.health.hp > 0) {
        need(
          record.sector === sector && record.sceneId === null,
          'La herida no corresponde a la ubicación del habitante.',
        );
      }
    }
  }
  for (const scene of [
    ...Object.values(s.sectorStates),
    ...Object.values(s.sceneStates),
    ...(s.pendingBattle ? [s.pendingBattle] : []),
  ]) {
    validateCivilianScene(s, scene);
  }
}
// Pre-ledger saves are admitted once. Preserve the worst known health across
// copies and translate the old 100-point civilian scale without healing.
export function migrateCampaignCivilians(s) {
  if (s.civilianState !== undefined) {
    return;
  }
  s.civilianState = { version: 1, people: {} };
  const scenes = [
    ...Object.values(s.sectorStates),
    ...Object.values(s.sceneStates),
    ...(s.pendingBattle ? [s.pendingBattle] : []),
  ];
  for (const scene of scenes) {
    scene.npcs = (scene.npcs ?? []).filter((n) => !s.recruited.includes(operativeId(n, s)));
  }
  for (const scene of scenes) {
    for (const n of scene.npcs ?? []) {
      if (n.detention !== undefined) {
        continue;
      }
      definition(s, n);
      migrateCivilianHealth(n, service(s, n));
      const old = s.civilianState.people[civilianKey(n)];
      if (!old || n.hp < old.health.hp) {
        remember(s, n, scene);
      }
    }
  }
  for (const scene of scenes) {
    for (const n of scene.npcs ?? []) {
      if (n.detention === undefined) {
        Object.assign(n, structuredClone(s.civilianState.people[civilianKey(n)].health));
      }
    }
    scene.npcs = (scene.npcs ?? []).filter(
      (n) =>
        n.detention !== undefined ||
        n.hp > 0 ||
        civilianDiedHere(s, n, scene.sectorId ?? scene.sector, scene.sceneId ?? null),
    );
  }
  return true;
}
export function migrateActiveCivilians(s, battle, { legacy = false } = {}) {
  for (const n of (battle.npcs ?? []).filter((n) => n.detention === undefined)) {
    n.civilianWeapons ??= civilianWeaponsFor(s, operativeId(n, s));
  }
  for (const n of (battle.npcs ?? []).filter((n) => n.detention === undefined)) {
    if (n.civilianSupplies === undefined) {
      n.civilianSupplies = supplies(s, n);
    }
  }
  for (const n of (battle.npcs ?? []).filter((n) => n.detention === undefined)) {
    if (n.civilianHealthVersion === undefined) {
      migrateCivilianHealth(n, service(s, n));
      const expected = campaignCivilian(s, n);
      if (legacy) {
        continue;
      }
      need(n.hp === expected.hp, 'La herida civil anterior no coincide con la campaña.');
      Object.assign(n, physical(expected));
    }
  }
  if (legacy) {
    acknowledgeCivilians(s, battle);
  }
}
export function migrateCampaignCivilianSupplies(s) {
  for (const scene of [
    ...Object.values(s.sectorStates),
    ...Object.values(s.sceneStates),
    ...(s.pendingBattle ? [s.pendingBattle] : []),
  ]) {
    for (const n of scene.npcs ?? []) {
      if (n.detention !== undefined) {
        continue;
      }
      n.civilianWeapons ??= civilianWeaponsFor(s, operativeId(n, s));
      if (n.civilianSupplies === undefined) {
        n.civilianSupplies = supplies(s, n);
      }
    }
  }
}
