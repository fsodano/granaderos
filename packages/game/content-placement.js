import { isContractCharacter } from './content-character-ids.ts';
import { contentCellIds } from './content-map.js';
import { campaignSectors, campaignWorld } from './campaign-definition.js';
import { resolveContent, CONTENT_LIMIT } from './content-package.js';
import { ResidentPresence, ResidentMovementPolicy } from './domain/world/resident-presence.ts';
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};
function draw(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function choose(s, values) {
  return values[Math.floor(draw(s) * values.length)];
}
function spawn(s, p, destination) {
  const person = new ResidentPresence(s.people[p.character]);
  if (isContractCharacter(s.content.characters.find((c) => c.id === p.character))) {
    return;
  }
  if (!person.canAppear) {
    return;
  }
  person.arriveAt(destination ?? (p.mode === 'fixed' ? p.sectors[0] : choose(s, p.sectors)));
  s.people[p.character] = person.toSnapshot();
}
/** @param {unknown} content @param {number} [seed] @returns {import("./public/content-placement-types.ts").ContentPlacementSession} */
export function createContentSession(content, seed = 18130203) {
  need(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Semilla inválida.');
  const definitions = resolveContent(content);
  const state = {
    version: 1,
    content: definitions,
    rng: seed,
    initialSeed: seed,
    history: [],
    minute: 0,
    nextDaily: 240,
    people: Object.fromEntries(
      definitions.characters.map((c) => [
        c.id,
        {
          alive: true,
          recruited: false,
          suspended: false,
          appeared: false,
          revision: 0,
          sector: null,
          hp: c.attributes.maxHp,
        },
      ]),
    ),
    events: [],
    receipts: [],
  };
  for (const p of definitions.placements) {
    if (p.afterDeath === null) {
      spawn(state, p);
    }
  }
  return state;
}
// Pure transitions make saved random state and queued decisions replayable.
/** @template {import("./public/content-placement-types.ts").ContentPlacementState} State
 * @param {State} state @param {number} minute @param {string|null} [loadedSector] @returns {State} */
export function advancePlacementState(state, minute, loadedSector = null, maximumMinute = 525600) {
  need(
    loadedSector === null ||
      campaignSectors(state.content).some((s) => s.id === loadedSector) ||
      campaignWorld(state.content).cells.some((c) => c.id === loadedSector),
    'Sector inválido.',
  );
  need(
    Number.isSafeInteger(minute) && minute >= state.minute && minute <= maximumMinute,
    'La prueba admite hasta un año de campaña.',
  );
  const s = structuredClone(state);
  const blocked = (event) =>
    s.people[s.content.placements.find((p) => p.id === event.placement).character].suspended;
  while (true) {
    const due = s.events.reduce(
      (n, e) => (blocked(e) ? n : Math.min(n, Math.max(s.minute, e.at))),
      Infinity,
    );
    const next = Math.min(due, s.nextDaily);
    if (next > minute) {
      break;
    }
    s.minute = next;
    const arrivals = s.events.filter((e) => e.at <= next && !blocked(e));
    s.events = s.events.filter((e) => !arrivals.includes(e));
    for (const event of arrivals) {
      const p = s.content.placements.find((p) => p.id === event.placement);
      const person = s.people[p.character];
      if (!person.alive || person.recruited) {
        continue;
      }
      event.destination ??= p.mode === 'fixed' ? p.sectors[0] : choose(s, p.sectors);
      if (blocked(event)) {
        s.events.push(event);
      } else {
        spawn(s, p, event.destination);
      }
    }
    if (next === s.nextDaily) {
      for (const p of s.content.placements) {
        const person = new ResidentPresence(s.people[p.character]);
        if (
          isContractCharacter(s.content.characters.find((c) => c.id === p.character)) ||
          p.mode !== 'daily' ||
          !person.canMove
        ) {
          continue;
        }
        const normalized = new ResidentPresence({
          ...person.toSnapshot(),
          sector: contentCellIds([person.sector], s.content)[0],
        });
        const destination = new ResidentMovementPolicy().chooseDestination(
          normalized,
          contentCellIds(p.sectors, s.content),
          p.moveChance,
          p.selection,
          () => draw(s),
        );
        if (destination !== null) {
          const configuredDestination = p.sectors.find(
            (sector) => contentCellIds([sector], s.content)[0] === destination,
          );
          person.moveTo(configuredDestination);
          s.people[p.character] = person.toSnapshot();
        }
      }
      s.nextDaily += 1440;
    }
  }
  s.minute = minute;
  return s;
}
/** @template {import('./public/content-placement-types.ts').ContentPlacementState} State
 * @param {State} state @param {string} id
 * @param {import('./public/content-placement-types.ts').ContentPersonStatus} status
 * @param {string|null} [loadedSector] @returns {State} */
export function changePlacementStatus(state, id, status, loadedSector = null) {
  need(Object.hasOwn(state.people, id), 'El personaje no existe.');
  need(['dead', 'recruited', 'released'].includes(status), 'Estado inválido.');
  const s = structuredClone(state),
    person = new ResidentPresence(s.people[id]);
  if (status === 'dead') {
    if (!person.toSnapshot().alive) {
      return s;
    }
    person.recordDeath();
    s.people[id] = person.toSnapshot();
    for (const p of s.content.placements.filter((p) => p.afterDeath === id)) {
      if (s.receipts.some((receipt) => receipt.placement === p.id)) {
        continue;
      }
      const delay = p.delayMin + Math.floor(draw(s) * (p.delayMax - p.delayMin + 1));
      s.receipts.push({ placement: p.id, trigger: id, minute: s.minute, at: s.minute + delay });
      s.events.push({ placement: p.id, at: s.minute + delay });
    }
  } else {
    person.changeService(status === 'recruited');
    s.people[id] = person.toSnapshot();
  }
  return advancePlacementState(s, s.minute, loadedSector, 52560000);
}

function recorded(state, next, event) {
  need(state.history.length < 1000, 'La prueba alcanzó 1000 pasos. Iniciá una nueva prueba.');
  next.history = [...state.history, event];
  return next;
}
/** @param {import("./public/content-placement-types.ts").ContentPlacementSession} state @param {number} minute @param {string | null} [loadedSector] @returns {import("./public/content-placement-types.ts").ContentPlacementSession} */
export function advanceContentSession(state, minute, loadedSector = null) {
  return recorded(state, advancePlacementState(state, minute, loadedSector), {
    type: 'advance',
    minute,
    loadedSector,
  });
}
/** @param {import("./public/content-placement-types.ts").ContentPlacementSession} state @param {string} id @param {import("./public/content-placement-types.ts").ContentPersonStatus} status @returns {import("./public/content-placement-types.ts").ContentPlacementSession} */
export function setContentPersonStatus(state, id, status) {
  return recorded(state, changePlacementStatus(state, id, status), { type: 'status', id, status });
}
export function encodeContentSession(state) {
  const text = JSON.stringify({
    format: 'granaderos-content-test',
    version: 2,
    content: state.content,
    seed: state.initialSeed,
    history: state.history,
  });
  need(new TextEncoder().encode(text).length <= CONTENT_LIMIT, 'La prueba supera 2 MB.');
  return text;
}
// Restore by replaying admitted commands, never by trusting supplied live state.
/** @param {string} text @returns {import("./public/content-placement-types.ts").ContentPlacementSession} */
export function decodeContentSession(text) {
  need(
    typeof text === 'string' && new TextEncoder().encode(text).length <= CONTENT_LIMIT,
    'Archivo de prueba demasiado grande.',
  );
  const value = JSON.parse(text);
  need(
    value?.version !== 1,
    'Esta prueba usa reglas anteriores de apariciones. Conservá su archivo y creá una prueba nueva desde el paquete.',
  );
  need(
    value?.format === 'granaderos-content-test' &&
      value.version === 2 &&
      Array.isArray(value.history) &&
      value.history.length <= 1000,
    'Archivo de prueba inválido.',
  );
  let state = createContentSession(value.content, value.seed);
  for (const event of value.history) {
    need(event && ['advance', 'status'].includes(event.type), 'Evento de prueba inválido.');
    if (event.type === 'advance') {
      state = advanceContentSession(state, event.minute, event.loadedSector);
    } else {
      state = setContentPersonStatus(state, event.id, event.status);
    }
  }
  return state;
}
