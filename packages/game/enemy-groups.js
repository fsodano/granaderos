import { initializeUnitAmmunition } from './tactical-ammunition.js';
import { campaignSectors } from './campaign-definition.js';
import { scenarioFor, enemyCommandsFor, enemyGroupLegHoursFor } from './campaign-scenario.js';
import { oppositionFor, campaignEnemyCount } from './narrative.js';
import { operativeInTransit, operativeLocation, validatePersonalInventory } from './squads.js';
import { migrateEnemyReserves, validateEnemyReserves } from './enemy-reserves.js';
import {
  migrateEnemyIntelligence,
  validateEnemyIntelligence,
  clearEnemyReport,
} from './enemy-intelligence.ts';
import { roadLinks, worldCell } from './world-cells.ts';
import { travelLegHours } from './squad-travel.js';

// Manual p.44: threatened sectors offer tactical combat, auto-resolve, or a
// possible withdrawal. Route duration and group strength are period game tuning.
export { enemyGroupLegHours as GROUP_LEG_HOURS } from '../../content/campaigns/granaderos/scenario.js';
const groupLegHours = (s, theater) => enemyGroupLegHoursFor(s)[theater];
const sector = (id, state) => campaignSectors(state).find((s) => s.id === id);
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};
const copy = (value) => structuredClone(value);
const active = (unit) => unit.hp > 0 && !unit.routed && !unit.departure && !unit.surrendered;
export function migrateEnemyGroups(s) {
  s.enemyGroups ??= [];
  s.nextEnemyGroupId ??= 1;
  s.pendingEncounter ??= null;
  s.encounterHistory ??= [];
  for (const r of Object.values(s.operativeState ?? {})) {
    r.captured ??= false;
    r.capturedSector ??= null;
    r.capturedAt ??= null;
    r.capturedContract ??= null;
    r.captureSequence ??= Math.max(
      r.captured ? 1 : 0,
      ...Object.values(s.detentionRecords ?? {})
        .filter(
          (entry) =>
            entry.npc?.detention?.operativeId !== undefined &&
            s.operativeState[entry.npc.detention.operativeId] === r,
        )
        .map((entry) => entry.npc.detention.captureSequence ?? 1),
    );
  }
  migrateEnemyReserves(s);
  migrateEnemyIntelligence(s);
  return s;
}
/** @returns {number[]} */
export function localDefenderIds(s, at, { exclude = [] } = {}) {
  return s.recruited.filter(
    (id) =>
      s.operativeState[id]?.alive &&
      !operativeInTransit(s, id) &&
      operativeLocation(s, id) === at &&
      !exclude.includes(id),
  );
}
export function localDefenderCount(s, at, options) {
  return (
    localDefenderIds(s, at, options).length + s.sectors[at].militia.reduce((sum, n) => sum + n, 0)
  );
}
export function occupyingGroups(s, at) {
  return s.enemyGroups.filter((g) => g.target === at && g.status === 'stationed');
}
/** @returns {string[]} */
export function retreatDestinations(s, at) {
  return sector(at, s).neighbors.filter(
    (id) =>
      s.sectors[id].owner === 'patriot' &&
      !s.enemyGroups.some(
        (g) => g.target === id && ['waiting', 'engaged', 'stationed'].includes(g.status),
      ) &&
      s.pendingBattle?.sector !== id,
  );
}

export function launchEnemyGroup(s, theater, target, { immediate = false } = {}) {
  migrateEnemyGroups(s);
  need(groupLegHours(s, theater) && sector(target, s), 'La ruta de la incursión es inválida.');
  if (s.enemyGroups.filter((g) => !['defeated', 'withdrawn'].includes(g.status)).length >= 64) {
    return null;
  }
  if (
    !immediate &&
    s.enemyGroups.some(
      (g) => g.theater === theater && ['marching', 'waiting', 'engaged'].includes(g.status),
    )
  ) {
    return null;
  }
  const reserves = migrateEnemyReserves(s);
  validateEnemyReserves(s);
  const strength = Math.min(campaignEnemyCount(s), reserves.remaining[theater]);
  if (strength < 3) {
    return null;
  }
  const index = s.nextEnemyGroupId,
    id = `enemy-group-${index}`,
    { command, origin, route } = scenarioFor(s).enemyGroupPlan(s, theater, target);
  need(route.length > 0, 'La ruta de la incursión es inválida.');
  const seed = (Math.imul((s.seed ^ s.hour ^ index) >>> 0, 1664525) + 1013904223) >>> 0;
  const enemies = oppositionFor(
    { theater, squad: Array.from({ length: strength }), difficulty: 1 },
    s,
  ).enemies;
  const units = enemies.map((u, i) =>
    initializeUnitAmmunition({
      ...u,
      id: `${id}-${i}`,
      hp: 100,
      maxHp: 100,
      energy: 100,
      agility: 65,
      dexterity: 65,
      wisdom: 50,
      strength: 70,
      medical: 15,
      mechanical: 15,
      experienceLevel: 4,
      condition: 85,
      bladeCondition: 100,
      loaded: 1,
      ammo: 5,
      rations: 0,
      medkits: 0,
      boleadoras: 0,
      torches: 0,
      fatigue: 0,
      bleeding: 0,
      bandaged: 0,
      jammed: false,
      inventory: {},
    }),
  );
  const group = {
    id,
    theater,
    command,
    origin,
    target,
    route,
    routeIndex: immediate ? route.length : 0,
    launchedAt: s.hour,
    nextArrivalAt: s.hour + (immediate ? 0 : groupLegHours(s, theater)),
    arrivalAt: s.hour + (immediate ? 0 : route.length * groupLegHours(s, theater)),
    seed,
    initialStrength: strength,
    units,
    status: immediate ? 'waiting' : 'marching',
    resolvedAt: null,
  };
  s.nextEnemyGroupId++;
  reserves.remaining[theater] -= strength;
  s.enemyGroups.push(group);
  const resolved = s.enemyGroups.filter((g) => ['defeated', 'withdrawn'].includes(g.status));
  for (const old of resolved.slice(0, Math.max(0, resolved.length - 48))) {
    s.enemyGroups.splice(s.enemyGroups.indexOf(old), 1);
  }
  return group;
}

// JA2 keeps moving enemies in their departure sector until arrival. Opposing
// player routes delay that arrival so both groups cannot pass through each other.
// Off-map incursions have no surface departure sector to intercept.
const departureSector = (group) =>
  group.status === 'marching' && group.routeIndex > 0 ? group.route[group.routeIndex - 1] : null;
function crossingSquads(s, group) {
  const from = departureSector(group),
    to = group.route[group.routeIndex];
  if (!from) {
    return [];
  }
  const link = roadLinks(s).find(
    (link) => (link.from === to && link.to === from) || (link.from === from && link.to === to),
  );
  const corridor = link
    ? (link.from === to ? link.path : [...link.path].reverse()).map((id) => worldCell(id, s).id)
    : [];
  return (s.squads ?? []).filter((q) => {
    const j = q.journey;
    if (
      !q.members.length ||
      !['moving', 'ready'].includes(j?.status) ||
      j.returning ||
      j.path.indexOf(from) < 1
    ) {
      return false;
    }
    if (j.path[0] === to && j.path[1] === from) {
      return true;
    } // Stored town stages and assaults.
    const a = corridor.indexOf(worldCell(j.path[0], s)?.id),
      b = corridor.indexOf(worldCell(j.path[1], s)?.id);
    return a >= 0 && b === a + 1;
  });
}
const hoursToDeparture = (s, q, group) => {
  const j = q.journey,
    index = j.path.indexOf(departureSector(group));
  return (
    Math.max(0, j.legHours - j.elapsed - (j.elapsedSecond ?? 0) / 3600) +
    j.path
      .slice(2, index + 1)
      .reduce((hours, to, i) => hours + travelLegHours(j.path[i + 1], to, j.mode, s), 0)
  );
};
export function delayCrossingEnemyGroups(s, { elapsedHour = 0, travelLeg = null } = {}) {
  for (const group of s.enemyGroups) {
    const now = s.hour + (s.secondOfHour ?? 0) / 3600;
    const arrivals = crossingSquads(s, group).map(
      (q) => now + Math.max(0, hoursToDeparture(s, q, group) - elapsedHour),
    );
    if (
      travelLeg &&
      departureSector(group) === travelLeg.to &&
      group.route[group.routeIndex] === travelLeg.from
    ) {
      arrivals.push(travelLeg.arrivalAt);
    }
    if (!arrivals.length) {
      continue;
    }
    // One campaign hour replaces JA2's short minute-scale delay. A ready assault
    // column continues to hold the crossing until it enters or turns back.
    const delayedUntil = Math.ceil(Math.max(now, Math.min(...arrivals))) + 1,
      delay = Math.max(0, delayedUntil - group.nextArrivalAt);
    group.nextArrivalAt += delay;
    group.arrivalAt += delay;
  }
}
export function haltEnemyGroupsAt(s, at, status = 'waiting') {
  const groups = s.enemyGroups.filter((group) => departureSector(group) === at);
  for (const group of groups) {
    group.route = group.route.slice(0, group.routeIndex);
    group.target = at;
    group.nextArrivalAt = s.hour;
    group.arrivalAt = s.hour;
    group.status = status;
    group.resolvedAt = status === 'stationed' ? s.hour : null;
  }
  return groups;
}

export function advanceEnemyGroups(s) {
  const arrivals = [];
  for (const group of s.enemyGroups.filter((g) => g.status === 'marching')) {
    while (group.nextArrivalAt <= s.hour) {
      const at = group.route[group.routeIndex++];
      if (s.sectors[at].owner === 'patriot' || group.routeIndex === group.route.length) {
        group.route = group.route.slice(0, group.routeIndex);
        group.target = at;
        group.arrivalAt = group.nextArrivalAt;
        group.status = 'waiting';
        arrivals.push(group);
        break;
      }
      group.nextArrivalAt += groupLegHours(s, group.theater);
    }
  }
  return arrivals;
}

export function queueEnemyEncounter(s) {
  if (s.pendingBattle || s.pendingEncounter) {
    return null;
  }
  const group = s.enemyGroups
    .filter((g) => g.status === 'waiting')
    .sort((a, b) => a.arrivalAt - b.arrivalAt || a.id.localeCompare(b.id))[0];
  if (!group) {
    return null;
  }
  s.pendingEncounter = { groupId: group.id, sector: group.target, arrivedAt: group.arrivalAt };
  return group;
}

export function enemyGroupStatus(s, group) {
  const command = enemyCommandsFor(s).find((c) => c.id === group.command),
    at =
      group.routeIndex > 0
        ? group.route[Math.min(group.routeIndex - 1, group.route.length - 1)]
        : null;
  return {
    ...group,
    commander: command?.commander ?? 'Mando adversario',
    name: command?.name ?? 'Grupo adversario',
    strength: group.units.filter(active).length,
    location: at ? sector(at, s).name : scenarioFor(s).enemyOriginName(group.origin),
    destination: sector(group.target, s).name,
    remaining: Math.max(0, group.arrivalAt - s.hour),
    crossingAt: crossingSquads(s, group).length ? at : null,
  };
}

export function recordEnemyGroupResult(s, groupId, battle, outcome) {
  const group = s.enemyGroups.find((g) => g.id === groupId);
  need(
    group && ['engaged', 'stationed'].includes(group.status),
    'El grupo enemigo ya no corresponde al combate.',
  );
  const reports = group.units.map((u) =>
    battle.units.find((v) => v.side === 'enemy' && String(v.id) === String(u.id)),
  );
  need(reports.every(Boolean), 'El parte del grupo enemigo está incompleto.');
  group.units = reports.map(copy);
  group.status = outcome === 'victory' ? 'defeated' : 'stationed';
  group.resolvedAt = s.hour;
  if (outcome === 'victory') {
    clearEnemyReport(s, group.id);
  }
  return group;
}

export function validateEnemyGroups(s, roster) {
  migrateEnemyGroups(s);
  const object = (v) => v && typeof v === 'object' && !Array.isArray(v),
    integer = (v, a, b) => Number.isInteger(v) && v >= a && v <= b,
    number = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
  need(
    Array.isArray(s.enemyGroups) &&
      s.enemyGroups.length <= 128 &&
      integer(s.nextEnemyGroupId, 1, 1e9),
    'Los grupos enemigos guardados son inválidos.',
  );
  const ids = new Set();
  for (const g of s.enemyGroups) {
    need(
      object(g) &&
        typeof g.id === 'string' &&
        /^enemy-group-[1-9][0-9]*$/.test(g.id) &&
        Number(g.id.slice(12)) < s.nextEnemyGroupId &&
        !ids.has(g.id) &&
        groupLegHours(s, g.theater) &&
        typeof g.command === 'string' &&
        typeof g.origin === 'string' &&
        sector(g.target, s) &&
        Array.isArray(g.route) &&
        g.route.length > 0 &&
        g.route.length <= campaignSectors(s).length &&
        g.route.every((id) => sector(id, s)) &&
        g.route.at(-1) === g.target &&
        integer(g.routeIndex, 0, g.route.length) &&
        integer(g.launchedAt, 0, s.hour) &&
        integer(g.nextArrivalAt, g.launchedAt, 1e9) &&
        integer(g.arrivalAt, g.launchedAt, 1e9) &&
        integer(g.seed, 0, 4294967295) &&
        integer(g.initialStrength, 3, 30) &&
        ['marching', 'waiting', 'engaged', 'stationed', 'defeated', 'withdrawn'].includes(
          g.status,
        ) &&
        (g.resolvedAt === null || integer(g.resolvedAt, g.launchedAt, s.hour)),
      'La ruta del grupo enemigo es inválida.',
    );
    ids.add(g.id);
    const plan = scenarioFor(s).enemyGroupPlan(s, g.theater, g.target);
    need(
      g.command === plan.command &&
        g.origin === plan.origin &&
        JSON.stringify(g.route) === JSON.stringify(plan.route),
      'El itinerario enemigo es inválido.',
    );
    need(
      g.status === 'marching'
        ? g.routeIndex < g.route.length
        : g.routeIndex === g.route.length && g.arrivalAt <= s.hour,
      'La llegada del grupo enemigo es inválida.',
    );
    need(
      Array.isArray(g.units) &&
        g.units.length === g.initialStrength &&
        new Set(g.units.map((u) => u?.id)).size === g.units.length,
      'La fuerza del grupo enemigo es inválida.',
    );
    for (const u of g.units) {
      need(
        object(u) &&
          typeof u.id === 'string' &&
          u.id.startsWith(`${g.id}-`) &&
          typeof u.name === 'string' &&
          u.name.length <= 200 &&
          number(u.maxHp, 1, 100) &&
          number(u.hp, 0, u.maxHp) &&
          (u.weapon === 0 || integer(u.weapon, 1800, 1813)) &&
          (u.blade === undefined || u.blade === 0 || integer(u.blade, 1809, 1813)),
        'El soldado enemigo guardado es inválido.',
      );
      for (const key of [
        'energy',
        'condition',
        'bladeCondition',
        'morale',
        'marksmanship',
        'agility',
        'dexterity',
        'wisdom',
        'strength',
        'medical',
        'mechanical',
        'fatigue',
        'bleeding',
      ]) {
        need(number(u[key] ?? 0, 0, 100), 'El estado del enemigo guardado es inválido.');
      }
      need(
        number(u.bandaged ?? 0, 0, u.maxHp - u.hp) &&
          integer(u.loaded ?? 0, 0, 2) &&
          integer(u.ammo ?? 0, 0, 100000),
        'Los pertrechos enemigos guardados son inválidos.',
      );
      validatePersonalInventory(u.inventory ?? {});
    }
  }
  validateEnemyReserves(s);
  validateEnemyIntelligence(s);
  for (const op of roster) {
    const r = s.operativeState[op.id];
    need(
      integer(r.captureSequence, 0, 1e9) &&
        (!r.captured || r.captureSequence > 0) &&
        typeof r.captured === 'boolean',
      'El cautiverio guardado es inválido.',
    );
    if (r.captured) {
      const c = r.capturedContract;
      need(
        r.alive &&
          r.hp > 0 &&
          !s.recruited.includes(op.id) &&
          !s.squads.some((q) => q.members.includes(op.id)) &&
          sector(r.capturedSector, s) &&
          integer(r.capturedAt, 0, s.hour) &&
          (r.capturedAtSecond === undefined ||
            (integer(r.capturedAtSecond, 0, 3599) &&
              r.capturedAt * 3600 + r.capturedAtSecond <= s.hour * 3600 + (s.secondOfHour ?? 0))) &&
          object(c) &&
          ['paid', 'patriot', 'legacy'].includes(c.kind) &&
          ['day', 'week', 'fortnight', 'month'].includes(c.term) &&
          integer(c.started, 0, r.capturedAt) &&
          (r.capturedAtSecond === undefined ||
            c.started * 3600 + (c.startedSecond ?? 0) <=
              r.capturedAt * 3600 + r.capturedAtSecond) &&
          (c.startedSecond === undefined || integer(c.startedSecond, 0, 3599)) &&
          (c.expiresSecond === undefined || integer(c.expiresSecond, 0, 3599)) &&
          (c.expiresAt === null
            ? c.kind !== 'paid' && c.expiresSecond === undefined
            : integer(c.expiresAt, 0, 1e9)) &&
          integer(c.paid, 0, 1e9),
        'El prisionero guardado es inválido.',
      );
    } else {
      need(
        r.capturedSector === null &&
          r.capturedAt === null &&
          (r.capturedAtSecond === undefined || r.capturedAtSecond === null) &&
          r.capturedContract === null,
        'El cautiverio guardado es inválido.',
      );
    }
  }
  const b = s.pendingBattle;
  if (b?.defenseGroupId) {
    const g = s.enemyGroups.find((g) => g.id === b.defenseGroupId);
    need(
      g?.status === 'engaged' &&
        g.target === b.sector &&
        b.wasRoyalist === (s.sectors[b.sector].owner === 'royalist') &&
        b.defenseFort === (b.wasRoyalist ? 0 : s.sectors[b.sector].fort) &&
        integer(b.defenseFort, 0, 3) &&
        Array.isArray(b.enemies) &&
        JSON.stringify(b.enemies) === JSON.stringify(g.units) &&
        !b.exploration &&
        !b.occupationGroupIds,
      'La defensa guardada es inválida.',
    );
  }
  if (b?.occupationGroupIds) {
    need(
      Array.isArray(b.occupationGroupIds) &&
        b.occupationGroupIds.length > 0 &&
        new Set(b.occupationGroupIds).size === b.occupationGroupIds.length,
      'La ocupación guardada es inválida.',
    );
    const groups = b.occupationGroupIds.map((id) => s.enemyGroups.find((g) => g.id === id));
    need(
      groups.every((g) => g?.status === 'stationed' && g.target === b.sector) &&
        Array.isArray(b.enemies) &&
        JSON.stringify(b.enemies) === JSON.stringify(groups.flatMap((g) => g.units)),
      'El contraataque guardado es inválido.',
    );
  }
  need(
    s.enemyGroups.filter((g) => g.status === 'engaged').every((g) => b?.defenseGroupId === g.id),
    'Un grupo en combate necesita un despliegue pendiente.',
  );
  need(
    s.pendingEncounter === null ||
      (!s.pendingBattle &&
        object(s.pendingEncounter) &&
        s.enemyGroups.some(
          (g) =>
            g.id === s.pendingEncounter.groupId &&
            g.status === 'waiting' &&
            g.target === s.pendingEncounter.sector &&
            g.arrivalAt === s.pendingEncounter.arrivedAt,
        )),
    'El encuentro pendiente es inválido.',
  );
  need(
    Array.isArray(s.encounterHistory) &&
      s.encounterHistory.length <= 40 &&
      s.encounterHistory.every(
        (e) =>
          object(e) &&
          typeof e.groupId === 'string' &&
          sector(e.sector, s) &&
          integer(e.hour, 0, s.hour) &&
          ['victory', 'defeat', 'retreat'].includes(e.outcome) &&
          Array.isArray(e.casualties) &&
          e.casualties.every((id) => roster.some((op) => op.id === id)) &&
          (e.captured === undefined ||
            (Array.isArray(e.captured) &&
              e.captured.every((id) => roster.some((op) => op.id === id)))) &&
          (e.militiaCasualties === undefined ||
            (Array.isArray(e.militiaCasualties) &&
              e.militiaCasualties.length <= 60 &&
              e.militiaCasualties.every((id) => integer(id, 20000, 1e9)))) &&
          (e.militiaDispersed === undefined || integer(e.militiaDispersed, 0, 60)) &&
          typeof e.text === 'string' &&
          e.text.length <= 2000,
      ),
    'Los partes de defensa son inválidos.',
  );
}
