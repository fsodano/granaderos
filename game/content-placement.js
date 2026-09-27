import {isContractCharacter} from './content-character-ids.js';
import {contentCellIds} from './content-map.js';
import { resolveContent, CONTENT_LIMIT, CONTENT_SECTORS } from "./content-package.js";
const need = (ok, message) => {
  if (!ok) throw Error(message);
};
function draw(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function choose(s, values) {
  return values[Math.floor(draw(s) * values.length)];
}
function spawn(s, p, destination = undefined) {
  const person = s.people[p.character];
  if (isContractCharacter(s.content.characters.find(c=>c.id===p.character)))return;
  if (!person.alive || person.recruited || person.suspended) return;
  person.sector = destination ?? (p.mode === "fixed" ? p.sectors[0] : choose(s, p.sectors));
  person.appeared = true;
  person.revision++;
}
export function createContentSession(content, seed = 18130203) {
  need(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, "Semilla inválida.");
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
        { alive: true, recruited: false, suspended: false, appeared: false, revision: 0, sector: null, hp: c.attributes.maxHp },
      ]),
    ),
    events: [],
    receipts: [],
  };
  for (const p of definitions.placements) if (p.afterDeath === null) spawn(state, p);
  return state;
}
// Pure transitions make saved random state and queued decisions replayable.
/** @param {any} state @param {number} minute @param {string|null} loadedSector */
export function advancePlacementState(state, minute, loadedSector = null, maximumMinute = 525600) {
  need(
    loadedSector === null || CONTENT_SECTORS.some((s) => s.id === loadedSector),
    "Sector inválido.",
  );
  need(
    Number.isSafeInteger(minute) && minute >= state.minute && minute <= maximumMinute,
    "La prueba admite hasta un año de campaña.",
  );
  const s = structuredClone(state);
  const blocked = event => event.destination !== undefined && (
    s.people[s.content.placements.find(p=>p.id===event.placement).character].suspended ||
    loadedSector !== null && contentCellIds([event.destination])[0] === contentCellIds([loadedSector])[0]);
  while (true) {
    const due = s.events.reduce((n, e) => blocked(e) ? n : Math.min(n, Math.max(s.minute,e.at)), Infinity);
    const next = Math.min(due, s.nextDaily);
    if (next > minute) break;
    s.minute = next;
    const arrivals = s.events.filter((e) => e.at <= next && !blocked(e));
    s.events = s.events.filter((e) => !arrivals.includes(e));
    for (const event of arrivals) {
      const p = s.content.placements.find((p) => p.id === event.placement);
      const person=s.people[p.character];
      if(!person.alive || person.recruited)continue;
      // Choose once when due; waiting for the scene to close must not reroll.
      event.destination ??= p.mode === 'fixed' ? p.sectors[0] : choose(s,p.sectors);
      if(blocked(event))s.events.push(event);
      else spawn(s,p,event.destination);
    }
    if (next === s.nextDaily) {
      for (const p of s.content.placements) {
        const person = s.people[p.character];
        if (
          isContractCharacter(s.content.characters.find(c=>c.id===p.character)) ||
          p.mode !== "daily" ||
          !person.appeared ||
          !person.alive ||
          person.recruited ||
          person.suspended ||
          (loadedSector !== null && contentCellIds(p.loadedGuard === 'range' ? p.sectors : [person.sector]).includes(contentCellIds([loadedSector])[0]))
        )
          continue;
        if (draw(s) * 100 >= p.moveChance) continue;
        const destination = p.selection === 'alternate'
          ? p.sectors.find(id=>contentCellIds([id])[0]!==contentCellIds([person.sector])[0])
          : choose(s,p.sectors);
        // A protected destination cancels this day's move, without a redraw.
        if (destination !== undefined && contentCellIds([destination])[0] !== contentCellIds([person.sector])[0] && (loadedSector === null || contentCellIds([destination])[0] !== contentCellIds([loadedSector])[0])) {person.sector = destination;person.revision++;}
      }
      s.nextDaily += 1440;
    }
  }
  s.minute = minute;
  return s;
}
export function changePlacementStatus(state, id, status, loadedSector = null) {
  need(Object.hasOwn(state.people, id), "El personaje no existe.");
  need(["dead", "recruited", "released"].includes(status), "Estado inválido.");
  const s = structuredClone(state),
    person = s.people[id];
  if (status === "dead") {
    if (!person.alive) return s;
    person.alive = false;
    person.hp = 0;
    person.sector = null;
    for (const p of s.content.placements.filter((p) => p.afterDeath === id)) {
      if (s.receipts.includes(p.id)) continue;
      s.receipts.push(p.id);
      const delay = p.delayMin + Math.floor(draw(s) * (p.delayMax - p.delayMin + 1));
      s.events.push({ placement: p.id, at: s.minute + delay });
    }
  } else {
    need(person.alive, "Un personaje muerto no puede cambiar de servicio.");
    person.recruited = status === "recruited";
  }
  return advancePlacementState(s, s.minute, loadedSector, 52560000);
}

function recorded(state, next, event) {
  need(state.history.length < 1000, "La prueba alcanzó 1000 pasos. Iniciá una nueva prueba.");
  next.history = [...state.history, event];
  return next;
}
/** @param {any} state @param {number} minute @param {string|null} loadedSector */
export function advanceContentSession(state, minute, loadedSector = null) {
  return recorded(state, advancePlacementState(state, minute, loadedSector), {
    type: "advance",
    minute,
    loadedSector,
  });
}
export function setContentPersonStatus(state, id, status) {
  return recorded(state, changePlacementStatus(state, id, status), { type: "status", id, status });
}
export function encodeContentSession(state) {
  const text = JSON.stringify({
    format: "granaderos-content-test",
    version: 2,
    content: state.content,
    seed: state.initialSeed,
    history: state.history,
  });
  need(new TextEncoder().encode(text).length <= CONTENT_LIMIT, "La prueba supera 2 MB.");
  return text;
}
// Restore by replaying admitted commands, never by trusting supplied live state.
export function decodeContentSession(text) {
  need(
    typeof text === "string" && new TextEncoder().encode(text).length <= CONTENT_LIMIT,
    "Archivo de prueba demasiado grande.",
  );
  const value = JSON.parse(text);
  need(value?.version !== 1, 'Esta prueba usa reglas anteriores de apariciones. Conservá su archivo y creá una prueba nueva desde el paquete.');
  need(
    value?.format === "granaderos-content-test" &&
      value.version === 2 &&
      Array.isArray(value.history) &&
      value.history.length <= 1000,
    "Archivo de prueba inválido.",
  );
  let state = createContentSession(value.content, value.seed);
  for (const event of value.history) {
    need(event && ["advance", "status"].includes(event.type), "Evento de prueba inválido.");
    if (event.type === "advance")
      state = advanceContentSession(state, event.minute, event.loadedSector);
    else state = setContentPersonStatus(state, event.id, event.status);
  }
  return state;
}
