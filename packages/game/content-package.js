import { CampaignContentSchema, CONTENT_LIMIT } from '../campaign-format/content-schema.js';
import { validateQuestDefinitions, validateErrandContacts } from './quest-definitions.js';
import { validateRoadsideDiscoveries } from './roadside-discoveries.js';
import {
  FORCE_EQUIPMENT,
  validateForceEquipment,
  validateForceAppearance,
} from './content-force-equipment.js';
import { validCharacterAbilities } from './character-abilities.js';
import {
  CIVILIAN_CONSCIENCE,
  conductObserverDefinition,
  conductNoncombatantDefinition,
} from './service-objections.js';
import { LOW_MORALE_REFUSAL } from './morale-renewal.js';
import {
  legacyOperativeId,
  isWorldCharacter,
  isHistoricalCharacter,
  hasGenericCharacterIds,
} from './content-character-ids.ts';
import { SPRITE_APPEARANCES } from './sprite-appearances.ts';
import { CONTENT_TRAITS } from './content-character-options.js';
import { BLADES } from './blade-definitions.js';
import { compileWeaponDefinition } from './weapon-definition.ts';
// Versioned authoring data. No mutable campaign state or global catalog changes.
import { CAMPAIGN_SECTORS } from './data.js';
import { WEAPONS } from './firearm-definitions.js';
import { validateCampaignDefinitionFields, campaignWorld } from './campaign-definition.js';
export {
  CONTENT_FORMAT,
  CONTENT_LIMIT,
  ATTRIBUTE_FIELDS,
} from '../campaign-format/content-schema.js';
// Every visible grid cell is valid. Legacy sector IDs remain readable for saved packages.
export const CONTENT_SECTORS = [
  ...DEFAULT_WORLD.cells.map(({ id, col, row, grid, name, x, y, district }) => ({
    id,
    col,
    row,
    grid,
    name,
    x,
    y,
    district,
  })),
  ...CAMPAIGN_SECTORS.map(({ id, name, grid }) => ({ id, name, grid })),
];
export const BLADE_TEMPLATES = Object.values(BLADES).map((w) => ({ id: w.id, name: w.name }));
export const FIREARM_TEMPLATES = Object.values(WEAPONS).map((w) => ({ id: w.id, name: w.name }));
// The installed campaign owns its authored defaults. Each caller receives a
// fresh copy, and old saved packages keep their original content identity.
import { DEFAULT_CONTENT, DEFAULT_WORLD } from '../../content/campaigns/default.js';
/** @returns {import('../campaign-format/types.ts').CampaignContent} */
export function defaultContentPackage() {
  return structuredClone(DEFAULT_CONTENT);
}
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
/** @param {unknown} value @returns {string[]} */
export function validateContentPackage(value) {
  const errors = [];
  const check = (ok, path, message) => {
    if (!ok) {
      errors.push(`${path}: ${message}`);
    }
  };
  if (!record(value)) {
    return ['Contenido: se necesita un objeto.'];
  }
  errors.push(...validateCampaignDefinitionFields(value));
  errors.push(...new CampaignContentSchema().validate(value, campaignWorld(value)));
  if (errors.length) {
    return errors;
  }
  if (value.errands !== undefined) {
    errors.push(...validateQuestDefinitions(value.errands, value));
  }
  errors.push(...validateRoadsideDiscoveries(value.roadsideDiscoveries, value));
  if (errors.length) {
    return errors;
  }
  errors.push(...validateErrandContacts(value));
  for (const [field, group] of Object.entries(FORCE_EQUIPMENT)) {
    if (value[group.bladeField] !== undefined) {
      errors.push(
        ...validateForceEquipment(
          field,
          value[group.bladeField],
          new Set(value.weapons.filter((w) => BLADES[w?.template]).map((w) => w.id)),
        ),
      );
    }
    if (value[group.appearanceField] !== undefined) {
      errors.push(...validateForceAppearance(field, value[group.appearanceField]));
    }
  }
  for (const c of value.characters.filter(record)) {
    if (hasGenericCharacterIds(value) || legacyOperativeId(c.id) === undefined) {
      check(
        ['contract', 'encounter'].includes(c.recruitmentSource) &&
          ['contract', 'permanent'].includes(c.service) &&
          ['experience', 'fixed'].includes(c.progression) &&
          Array.isArray(c.traits),
        c.id,
        'los personajes nuevos necesitan origen, servicio, progreso y especialidades explícitos.',
      );
    }
    if (isWorldCharacter(c)) {
      const e = c.encounter;
      check(
        (c.service === 'contract' || (c.service === 'permanent' && c.monthlyPay === 0)) &&
          c.arrivalHours === undefined,
        c.id,
        'los habitantes se incorporan en el lugar; el servicio permanente no tiene paga ni demora de llegada.',
      );
      if (record(e)) {
        if (e.noncombatant !== undefined) {
          check(
            e.noncombatant === true &&
              conductNoncombatantDefinition(
                c,
                value.placements.find((p) => p.character === c.id),
              ),
            c.id,
            'un civil no combatiente debe ser un habitante fijo, sin armas, no incorporable y de servicio permanente.',
          );
        }
        if (e.dialogue !== undefined) {
          try {
            for (const node of e.dialogue.nodes) {
              for (const choice of node.choices) {
                for (const effect of choice.effects ?? []) {
                  if (effect.type === 'movement') {
                    check(
                      (effect.destination === 'routine' || effect.character !== c.id) &&
                        value.characters.some(
                          (target) => target.id === effect.character && isWorldCharacter(target),
                        ),
                      c.id,
                      'el movimiento necesita otro habitante del mundo.',
                    );
                  }
                }
              }
            }
            for (const node of e.dialogue.nodes) {
              for (const choice of node.choices) {
                for (const condition of choice.conditions ?? []) {
                  if (condition.type === 'meeting') {
                    check(
                      value.characters.some(
                        (target) => target.id === condition.character && isWorldCharacter(target),
                      ),
                      c.id,
                      'la condición del encuentro necesita un habitante del mundo.',
                    );
                  }
                }
              }
            }
          } catch (error) {
            errors.push(`${c.id}: ${error.message}`);
          }
        }
      }
    } else {
      check(
        c.encounter === undefined,
        c.id,
        'el encuentro editable pertenece a un habitante nuevo.',
      );
    }
    if (c.traits !== undefined) {
      check(
        Array.isArray(c.traits) &&
          c.traits.length <= CONTENT_TRAITS.length &&
          new Set(c.traits).size === c.traits.length &&
          c.traits.every((id) => CONTENT_TRAITS.some((t) => t.id === id)),
        c.id,
        'especialidades inválidas.',
      );
    }
    if (c.abilities !== undefined) {
      check(validCharacterAbilities(c.abilities), c.id, 'habilidades no válidas.');
    }
    if (c.abilities?.includes?.(CIVILIAN_CONSCIENCE)) {
      check(
        conductObserverDefinition(c),
        c.id,
        'la objeción civil requiere un candidato por contrato con servicio pagado explícito.',
      );
    }
    if (c.abilities?.includes?.(LOW_MORALE_REFUSAL)) {
      check(
        conductObserverDefinition(c),
        c.id,
        'el rechazo de renovación por moral requiere un candidato por contrato con servicio pagado explícito.',
      );
    }
    if (c.spriteAppearance !== undefined) {
      check(
        typeof c.spriteAppearance === 'string' &&
          Object.hasOwn(SPRITE_APPEARANCES, c.spriteAppearance),
        c.id,
        'apariencia de combate no válida.',
      );
    }
    if (c.skinTone !== undefined) {
      check(['light', 'brown', 'dark'].includes(c.skinTone), c.id, 'paleta de piel no válida.');
    }
    if (c.serviceGuarantee !== undefined) {
      check(
        integer(c.serviceGuarantee, 0, 1000000) &&
          (c.serviceGuarantee === 0 ||
            (c.service === 'contract' && !isHistoricalCharacter(c, value))),
        `${c.id}.serviceGuarantee`,
        'garantía inválida; solo un servicio por contrato admite fondos.',
      );
    }
    if (c.blade !== undefined) {
      check(
        value.weapons.some((w) => w?.id === c.blade && BLADES[w.template]),
        `${c.id}.blade`,
        'el arma blanca no existe.',
      );
    }
  }
  for (const w of value.weapons.filter(record)) {
    try {
      compileWeaponDefinition(w);
    } catch (error) {
      errors.push(`${w.id}: ${error.message}`);
    }
    check(
      [...FIREARM_TEMPLATES, ...BLADE_TEMPLATES].some((t) => t.id === w.template),
      `${w.id}.template`,
      'familia no compatible.',
    );
    if (BLADES[w.template]) {
      continue;
    }
    for (const k of ['damage', 'fireAP', 'aimAP', 'reloadAP', 'range', 'readyAP']) {
      check(
        integer(w[k], ['readyAP', 'aimAP'].includes(k) ? 0 : 1, k === 'reloadAP' ? 500 : 100),
        `${w.id}.${k}`,
        'valor fuera de rango.',
      );
    }
    check(w.readyAP < w.fireAP, `${w.id}.readyAP`, 'debe ser menor que el coste del disparo.');
  }
  return errors;
}
/** @param {string} text @returns {import('../campaign-format/types.ts').CampaignContent} */
export function parseContentPackage(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > CONTENT_LIMIT) {
    throw Error('El contenido supera el límite de 2 MB.');
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error('El archivo no contiene JSON válido.');
  }
  const errors = validateContentPackage(value);
  if (errors.length) {
    throw Error(errors.slice(0, 12).join('\n'));
  }
  return value;
}
/** @param {unknown} value @returns {string} */
export function encodeContentPackage(value) {
  const text = JSON.stringify(value, null, 2);
  parseContentPackage(text);
  return text;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
/** @param {unknown} value @returns {import('../campaign-format/types.ts').CampaignContent} */
export function resolveContent(value) {
  return freeze(parseContentPackage(JSON.stringify(value)));
}
