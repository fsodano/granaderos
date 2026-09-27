import {FORCE_EQUIPMENT,defaultForceEquipment,validateForceEquipment} from './content-force-equipment.js';
import {legacyCharacterAbilities,validCharacterAbilities} from './character-abilities.js';
import {legacyOperativeId} from './content-character-ids.js';
import {characterProfile,SPEECH_EVENTS} from './characters.js';
import {SPEECH_LINE_LIMIT} from './content-character-presentation.js';
import {SPRITE_APPEARANCES,spriteAppearance} from './sprite-appearances.js';
import {CONTENT_TRAITS} from './content-character-options.js';
import { compileWeaponDefinition } from "./weapon-definition.js";
// Versioned authoring data. No mutable campaign state or global catalog changes.
import { defaultArrivalSites, validateArrivalSites } from "./arrival-sites.js";
import { CONTENT_CELLS, contentCellIds } from "./content-map.js";
import { OPERATIVES, CAMPAIGN_SECTORS } from "./data.js";
import { CIVIC_RECRUITS } from "./civic-recruits.js";
import { ENCOUNTERS } from "./encounters.js";
import { WEAPONS } from "./firearm-definitions.js";
export const CONTENT_FORMAT = "granaderos-content";
export const CONTENT_LIMIT = 2_000_000;
export const ATTRIBUTE_FIELDS = [
  "maxHp",
  "agility",
  "dexterity",
  "strength",
  "leadership",
  "wisdom",
  "marksmanship",
  "mechanical",
  "explosives",
  "medical",
];
// Every visible grid cell is valid. Legacy sector IDs remain readable for saved packages.
export const CONTENT_SECTORS = [
  ...CONTENT_CELLS,
  ...CAMPAIGN_SECTORS.map(({ id, name, grid }) => ({ id, name, grid })),
];
export const FIREARM_TEMPLATES = Object.values(WEAPONS).map((w) => ({ id: w.id, name: w.name }));
const portrait = (id) => `/art/portrait-${id}.${[103, 104].includes(id) ? "png" : "webp"}`;
export function defaultContentPackage() {
  return {
    format: CONTENT_FORMAT,
    version: 1,
    id: "granaderos",
    name: "Granaderos",
    arrivalSites: defaultArrivalSites(),
    oppositionEquipment: defaultForceEquipment('oppositionEquipment'),
    militiaEquipment: defaultForceEquipment('militiaEquipment'),
    characters: [...OPERATIVES, ...CIVIC_RECRUITS].map((o) => ({
      id: `person-${o.id}`,
      name: o.name,
      nickname: o.nickname || o.name,
      role: o.role || "",
      biography: o.biography || "",
      portrait: portrait(o.id),
      abilities:legacyCharacterAbilities(o.id),
      personality:characterProfile(o).personality,
      speech:{...characterProfile(o).speech},
      spriteAppearance:spriteAppearance(o),
      monthlyPay: o.monthlyPay ?? 0,
      ...(o.id >= 100 ? {arrivalHours:6,recruitmentSource:'contract',service:'contract',progression:'experience',traits:[...(o.traits??[])],ridingSkill:o.ridingSkill??((o.traits??[]).includes('expert_rider')?80:0)} : {}),
      weapon: WEAPONS[o.weapon] ? `firearm-${o.weapon}` : null,
      attributes: Object.fromEntries(ATTRIBUTE_FIELDS.map((k) => [k, o[k] ?? 50])),
    })),
    weapons: Object.values(WEAPONS).map((w) => ({
      id: `firearm-${w.id}`,
      template: w.id,
      name: w.name,
      damage: w.damage,
      fireAP: w.fireAP,
      aimAP: w.aimAP,
      reloadAP: w.reloadAP,
      range: w.range,
      readyAP: 0,
    })),
    placements: ENCOUNTERS.filter((n) => n.operativeId !== undefined && n.operativeId < 100).map((n) => ({
      id: `placement-${n.id}`,
      character: `person-${n.operativeId}`,
      mode: "fixed",
      sectors: contentCellIds([n.sector]),
      moveChance: 100,
      afterDeath: null,
      delayMin: 0,
      delayMax: 0,
    })),
  };
}
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const identifier = (v) =>
  typeof v === "string" &&
  /^[a-z][a-z0-9-]{0,79}$/.test(v) &&
  !["constructor", "prototype"].includes(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export function validateContentPackage(value) {
  const errors = [];
  const check = (ok, path, message) => {
    if (!ok) errors.push(`${path}: ${message}`);
  };
  if (!record(value)) return ["Contenido: se necesita un objeto."];
  check(value.format === CONTENT_FORMAT && value.version === 1, "Formato", "versión incompatible.");
  check(identifier(value.id), "Campaña", "identificador inválido.");
  const text = (v, path, max, empty = false) =>
    check(
      typeof v === "string" && v.length <= max && (empty || v.trim().length > 0),
      path,
      `texto inválido (máximo ${max} caracteres).`,
    );
  text(value.name, "Nombre", 100);
  if (value.arrivalSites !== undefined) errors.push(...validateArrivalSites(value.arrivalSites));
  for (const key of ["characters", "weapons", "placements"])
    check(
      Array.isArray(value[key]) && value[key].length <= 500,
      key,
      "se necesita una lista de hasta 500 elementos.",
    );
  if (errors.length) return errors;
  const sets = {};
  for (const key of ["characters", "weapons", "placements"]) {
    sets[key] = new Set();
    for (const [i, item] of value[key].entries()) {
      if (!record(item)) {
        errors.push(`${key}[${i}]: registro inválido.`);
        continue;
      }
      check(
        identifier(item.id) && !sets[key].has(item.id),
        `${key}[${i}].id`,
        "identificador inválido o repetido.",
      );
      sets[key].add(item.id);
    }
  }
  for(const field of Object.keys(FORCE_EQUIPMENT))if(value[field]!==undefined)errors.push(...validateForceEquipment(field,value[field],sets.weapons));
  for (const c of value.characters.filter(record)) {
    if(legacyOperativeId(c.id)===undefined)check(c.recruitmentSource==='contract'&&c.service==='contract'&&['experience','fixed'].includes(c.progression)&&Array.isArray(c.traits),c.id,'los personajes nuevos necesitan contratación, servicio por contrato, progreso y especialidades explícitos.');
    if(c.recruitmentSource!==undefined)check(['contract','encounter'].includes(c.recruitmentSource),c.id,'origen de contratación inválido.');
    if(c.service!==undefined)check(['contract','permanent'].includes(c.service),c.id,'servicio inválido.');
    if(c.progression!==undefined)check(['experience','fixed'].includes(c.progression),c.id,'progreso inválido.');
    if(c.traits!==undefined)check(Array.isArray(c.traits)&&c.traits.length<=CONTENT_TRAITS.length&&new Set(c.traits).size===c.traits.length&&c.traits.every(id=>CONTENT_TRAITS.some(t=>t.id===id)),c.id,'especialidades inválidas.');
    if(c.ridingSkill!==undefined)check(integer(c.ridingSkill,0,100),c.id,'equitación fuera de rango.');
    text(c.name, c.id, 100);
    text(c.nickname, `${c.id}.nickname`, 100);
    text(c.role, `${c.id}.role`, 200, true);
    text(c.biography, `${c.id}.biography`, 5000, true);
    if(c.abilities!==undefined)check(validCharacterAbilities(c.abilities),c.id,'habilidades no válidas.');
    if(c.personality!==undefined)text(c.personality,`${c.id}.personality`,2000,true);
    if(c.speech!==undefined){
      check(record(c.speech)&&Object.keys(c.speech).length===SPEECH_EVENTS.length&&Object.keys(c.speech).every(key=>SPEECH_EVENTS.includes(key)),c.id,'la lista de frases no es válida.');
      if(record(c.speech))for(const event of SPEECH_EVENTS)text(c.speech[event],`${c.id}.speech.${event}`,SPEECH_LINE_LIMIT,true);
    }
    if(c.spriteAppearance!==undefined)check(typeof c.spriteAppearance==='string'&&Object.hasOwn(SPRITE_APPEARANCES,c.spriteAppearance),c.id,'apariencia de combate no válida.');
    check(
      typeof c.portrait === "string" &&
        (/^\/art\/[a-zA-Z0-9_-]+\.(webp|png|jpg)$/.test(c.portrait) ||
          (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.portrait) &&
            c.portrait.length < 350000)),
      `${c.id}.portrait`,
      "usá un retrato local o una imagen PNG, JPEG o WebP de hasta 250 KB.",
    );
    if (c.arrivalHours !== undefined) check(integer(c.arrivalHours, 0, 168), `${c.id}.arrivalHours`, "el viaje debe durar de 0 a 168 horas.");
    check(integer(c.monthlyPay, 0, 1000000), `${c.id}.monthlyPay`, "paga inválida.");
    check(c.weapon === null || sets.weapons.has(c.weapon), `${c.id}.weapon`, "el arma no existe.");
    check(record(c.attributes) && Object.keys(c.attributes).length === ATTRIBUTE_FIELDS.length && Object.keys(c.attributes).every(k => ATTRIBUTE_FIELDS.includes(k)), `${c.id}.attributes`, "la lista de atributos no es válida.");
    for (const k of ATTRIBUTE_FIELDS)
      check(
        integer(c.attributes?.[k], k === "maxHp" ? 15 : 0, 100),
        `${c.id}.${k}`,
        "atributo fuera de rango.",
      );
  }
  for (const w of value.weapons.filter(record)) {
    text(w.name, w.id, 100);
    try { compileWeaponDefinition(w); } catch(error) { errors.push(`${w.id}: ${error.message}`); }
    check(
      FIREARM_TEMPLATES.some((t) => t.id === w.template),
      `${w.id}.template`,
      "familia no compatible.",
    );
    for (const k of ["damage", "fireAP", "aimAP", "reloadAP", "range", "readyAP"])
      check(
        integer(w[k], ["readyAP", "aimAP"].includes(k) ? 0 : 1, k === "reloadAP" ? 500 : 100),
        `${w.id}.${k}`,
        "valor fuera de rango.",
      );
    check(w.readyAP < w.fireAP, `${w.id}.readyAP`, "debe ser menor que el coste del disparo.");
  }
  const placed = new Set();
  for (const p of value.placements.filter(record)) {
    check(
      sets.characters.has(p.character) && !placed.has(p.character),
      p.id,
      "cada personaje puede tener una sola aparición.",
    );
    placed.add(p.character);
    check(["fixed", "once", "daily"].includes(p.mode), p.id, "modo de aparición inválido.");
    check(
      Array.isArray(p.sectors) &&
        p.sectors.length > 0 &&
        p.sectors.length <= CONTENT_SECTORS.length &&
        contentCellIds(p.sectors).length === p.sectors.length &&
        p.sectors.every((s) => CONTENT_SECTORS.some((d) => d.id === s)) &&
        (p.mode !== "fixed" || p.sectors.length === 1),
      p.id,
      "seleccioná sectores válidos; la ubicación fija necesita uno.",
    );
    if(p.selection!==undefined)check(['random','alternate'].includes(p.selection)&& (p.selection!=='alternate'||p.mode==='daily'&&p.sectors?.length===2),p.id,'la alternancia diaria necesita dos celdas.');
    if(p.loadedGuard!==undefined)check(['current','range'].includes(p.loadedGuard),p.id,'protección de escena inválida.');
    check(integer(p.moveChance, 0, 100), p.id, "probabilidad fuera de rango.");
    check(
      p.afterDeath === null || (sets.characters.has(p.afterDeath) && p.afterDeath !== p.character),
      p.id,
      "condición de muerte inválida.",
    );
    check(
      integer(p.delayMin, 0, 525600) && integer(p.delayMax, p.delayMin, 525600),
      p.id,
      "demora inválida (minutos).",
    );
  }
  // A successor chain must have a reachable starting character.
  const dependencies = new Map(
    value.placements.filter(record).map((p) => [p.character, p.afterDeath]),
  );
  for (const id of dependencies.keys()) {
    const seen = new Set();
    let next = id;
    while (next) {
      if (seen.has(next)) {
        errors.push(`${id}: ciclo en las condiciones de muerte.`);
        break;
      }
      seen.add(next);
      next = dependencies.get(next);
    }
  }
  return errors;
}
export function parseContentPackage(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > CONTENT_LIMIT)
    throw Error("El contenido supera el límite de 2 MB.");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error("El archivo no contiene JSON válido.");
  }
  const errors = validateContentPackage(value);
  if (errors.length) throw Error(errors.slice(0, 12).join("\n"));
  return value;
}
export function encodeContentPackage(value) {
  const text = JSON.stringify(value, null, 2);
  parseContentPackage(text);
  return text;
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function resolveContent(value) {
  return freeze(parseContentPackage(JSON.stringify(value)));
}
