import { residentPositionPoints } from './infrastructure/world/campaign-resident-positions.js';
import {
  SectorDeployment,
  DeploymentRefusal,
  DeploymentRefusalCode,
} from './domain/sector-sessions/sector-deployment.ts';
import {
  readSectorSession,
  writeSectorSession,
} from './infrastructure/sector-sessions/sector-session-mapper.js';

const deploymentMessages = {
  [DeploymentRefusalCode.InvalidPlan]: 'La colocación de llegada no es válida.',
  [DeploymentRefusalCode.InvalidSelection]: 'Elegí combatientes que estén llegando.',
  [DeploymentRefusalCode.InvalidEntryPoint]: 'Elegí un paso del borde de llegada indicado.',
  [DeploymentRefusalCode.EntryFull]: 'No queda lugar para colocar ese grupo.',
  [DeploymentRefusalCode.Incomplete]: 'Colocá a todos los combatientes antes de entrar.',
  [DeploymentRefusalCode.EntryBlocked]:
    'El borde de llegada está cerrado. El despliegue sigue pendiente.',
};
function deploymentOf(state) {
  return SectorDeployment.restore(
    {
      participants: state.deployment.units.map((unit) => ({
        characterId: unit.id,
        entryEdge: unit.edge,
      })),
      placements: state.deployment.placements,
    },
    entryMap(state),
  );
}
import { entryTerrainCells, exteriorComponent } from './sector-entry.js';
import { initializeBattlePerception } from './tactical.js';
import { validEntry } from './tactical-exits.js';
import { tacticalLevel } from './tactical-space.js';

const EDGES = ['N', 'E', 'S', 'W'];
const key = (p) => `${p.x},${p.y}`;
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const need = (ok, message = 'La colocación de llegada no es válida.') => {
  if (!ok) {
    throw Error(message);
  }
};
const arrival = (u) =>
  u.side === 'player' &&
  u.hp > 0 &&
  !u.militia &&
  !u.missionAlly &&
  !u.departure &&
  !u.fled &&
  u.entryReason === 'arrival';
function rows(state, request) {
  return state.units
    .filter(arrival)
    .filter((u) => request.squad.some((raw) => String(raw.id) === u.id))
    .map((u) => {
      const squad = request.assaultSquads?.find((q) => q.members.some((id) => String(id) === u.id));
      return {
        id: u.id,
        edge: u.entryEdge,
        squadId: squad?.id ?? 'arrival',
        squadName: squad?.name ?? squad?.id ?? 'Escuadra',
      };
    });
}

// Called only during a new world handoff, before sight or initiative runs.
export function beginSectorDeployment(state, request) {
  if (request.exploration || request.resumeSnapshot || state.deploymentComplete) {
    return false;
  }
  const units = rows(state, request);
  if (!units.length) {
    return false;
  }
  state.deployment = {
    version: 1,
    units,
    placements: {},
    ...(request.defenseGroupId && request.defenseFort > 0
      ? { defenseFort: request.defenseFort }
      : {}),
  };
  state.sectorSession = readSectorSession(state).snapshot();
  validateSectorDeployment(state, request);
  return true;
}

function entryMap(state) {
  const sample = state.units.find(arrival),
    component = exteriorComponent(state, sample);
  return Object.fromEntries(
    EDGES.map((edge) => [
      edge,
      entryTerrainCells(state, sample, edge, component).map((t) => ({ x: t.x, y: t.y })),
    ]),
  );
}

export function validateSectorDeployment(state, request) {
  if (state.deploymentComplete !== undefined) {
    need(state.deploymentComplete === true);
  }
  const d = state.deployment;
  if (d === undefined) {
    return;
  }
  need(
    !state.deploymentComplete &&
      object(d) &&
      d.version === 1 &&
      Object.keys(d)
        .filter((key) => key !== 'defenseFort')
        .sort()
        .join(',') === 'placements,units,version',
  );
  if (Object.hasOwn(d, 'defenseFort')) {
    need(Number.isInteger(d.defenseFort) && d.defenseFort >= 1 && d.defenseFort <= 3);
  }
  need(
    state.turn === 1 &&
      state.phase === 'player' &&
      state.mode === 'exploration' &&
      state.status === 'active' &&
      !state.elapsedSeconds &&
      !state.syncedSeconds &&
      !state.roundTimeCharged &&
      !state.enemyTurns &&
      !state.contactThisRound &&
      !state.contactInitiative &&
      !state.interrupt &&
      !state.enemyTurn &&
      !state.alliedTurn &&
      !state.reactionStack?.length,
  );
  need(
    Array.isArray(d.units) && d.units.length > 0 && d.units.length <= 48 && object(d.placements),
  );
  const ids = new Set();
  for (const row of d.units) {
    const unit = state.units.find((u) => u.id === row?.id);
    need(
      object(row) &&
        Object.keys(row).sort().join(',') === 'edge,id,squadId,squadName' &&
        unit &&
        arrival(unit) &&
        !ids.has(row.id) &&
        row.edge === unit.entryEdge &&
        validEntry(unit.entryEdge, unit.entryAnchor) &&
        tacticalLevel(unit) === 0 &&
        typeof row.squadId === 'string' &&
        row.squadId.length > 0 &&
        row.squadId.length <= 80 &&
        typeof row.squadName === 'string' &&
        row.squadName.length > 0 &&
        row.squadName.length <= 100,
    );
    ids.add(row.id);
  }
  need(state.units.filter(arrival).every((u) => ids.has(u.id)));
  if (request) {
    need(
      !request.exploration &&
        !request.resumeSnapshot &&
        JSON.stringify(rows(state, request)) === JSON.stringify(d.units),
    );
    need(
      d.defenseFort ===
        (request.defenseGroupId && request.defenseFort > 0 ? request.defenseFort : undefined),
      'La fortificación de llegada no corresponde a la defensa.',
    );
    for (const row of d.units) {
      const actual = state.units.find((u) => u.id === row.id),
        issued = request.squad.find((u) => String(u.id) === row.id);
      need(
        issued &&
          issued.entryEdge === actual.entryEdge &&
          issued.entryAnchor?.x === actual.entryAnchor?.x &&
          issued.entryAnchor?.y === actual.entryAnchor?.y,
      );
    }
  }
  const entries = entryMap(state),
    occupied = new Set();
  for (const [id, point] of Object.entries(d.placements)) {
    const row = d.units.find((u) => u.id === id);
    need(
      ids.has(id) &&
        object(point) &&
        Object.keys(point).sort().join(',') === 'x,y' &&
        Number.isInteger(point.x) &&
        Number.isInteger(point.y) &&
        entries[row.edge].some((p) => p.x === point.x && p.y === point.y) &&
        !occupied.has(key(point)),
    );
    occupied.add(key(point));
  }
}

// This model deliberately reads no opposing positions, contents or current sight.
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @returns {import('./public/player-known-types.ts').KnownDeployment|null} */
export function sectorDeploymentModel(state) {
  const d = state.deployment;
  if (!d) {
    return null;
  }
  const units = d.units.map((row) => {
    const u = state.units.find((u) => u.id === row.id);
    return {
      ...row,
      name: u.name,
      nickname: u.nickname ?? u.name,
      position: d.placements[row.id] ? { ...d.placements[row.id] } : null,
    };
  });
  return {
    sectorName: state.sectorName,
    width: state.width,
    height: state.height,
    units,
    cells: state.tiles.map(({ x, y, type, blocked }) => ({ x, y, type, blocked })),
    entryCells: entryMap(state),
    ready: units.every((u) => u.position),
    remaining: units.filter((u) => !u.position).length,
  };
}

export function sectorDeploymentAction(state, action) {
  const next = structuredClone(state);
  next.lastError = null;
  try {
    need(state.deployment, 'La colocación de llegada ya terminó.');
    validateSectorDeployment(state);
    const d = next.deployment,
      deployment = deploymentOf(next);
    if (action.type === 'clearDeployment') {
      deployment.clear(action.unitIds ?? d.units.map((unit) => unit.id));
    } else if (action.type === 'placeDeployment') {
      deployment.place(action.unitIds, { x: action.x, y: action.y });
    } else if (action.type === 'spreadDeployment') {
      deployment.spread();
    } else if (action.type === 'confirmDeployment') {
      const ids = new Set(d.units.map((unit) => unit.id));
      const occupied = [
        ...next.units.filter((unit) => !ids.has(unit.id) && !unit.departure && !unit.fled),
        ...(next.npcs ?? []),
        ...residentPositionPoints(next),
        ...(next.artillery ?? []),
      ].filter((unit) => tacticalLevel(unit) === 0);
      const committed = deployment.confirm(occupied);
      for (const row of d.units) {
        const point = committed[row.id];
        const unit = next.units.find((u) => u.id === row.id);
        Object.assign(unit, point, { facing: { N: 4, E: 6, S: 0, W: 2 }[row.edge] });
        if (d.defenseFort) {
          const tile = next.tiles.find((t) => t.x === point.x && t.y === point.y);
          tile.cover = Math.max(tile.cover ?? 0, d.defenseFort * 10);
        }
      }
      const session = readSectorSession(next);
      session.confirmDeployment();
      delete next.deployment;
      next.deploymentComplete = true;
      writeSectorSession(next, session);
      return initializeBattlePerception(next);
    } else {
      throw Error('Terminá de colocar el destacamento antes de dar órdenes tácticas.');
    }
    d.placements = deployment.snapshot().placements;
    validateSectorDeployment(next);
    return next;
  } catch (error) {
    const rejected = structuredClone(state);
    rejected.lastError =
      error instanceof DeploymentRefusal ? deploymentMessages[error.code] : error.message;
    return rejected;
  }
}
