import {
  SPEECH_LINE_LIMIT,
  SPEECH_EVENTS,
  AUTHORABLE_SPEECH_EVENTS,
} from './character-presentation-schema.js';
import {
  isProjectileEnergyRecord,
  isProjectileAirDragRecord,
  validMaterialRangeSlope,
} from './projectile-profile-schema.js';
import { validateErrandDefinitions, validateErrandContactReferences } from './errand-schema.js';
import { validateRoadsideDiscoveries } from './roadside-discovery-schema.js';
import { validateCampaignStory } from './story-schema.js';
import { validateCampaignEvents } from './event-schema.js';
import {
  validateContractRules,
  validateArtilleryTransportRules,
  validateArtillerySupply,
  validateMilitiaPatrol,
  validateMilitiaProgression,
  validateCareRules,
  validateCampaignRules,
} from './campaign-rules-schema.js';
import {
  validateFoundry,
  validateCampaignRoles,
  validateImportRules,
  validateHeadquarters,
  validateStartingTerritory,
  validateArrivalSites,
  validateArtilleryTradingRules,
} from './campaign-location-schema.js';
import { validateAmmunitionMarket } from './ammunition-market-schema.js';
import { validateArtilleryProfiles } from './artillery-profile-schema.js';
import {
  FORCE_EQUIPMENT_GROUPS,
  validateForceEquipment,
  validateForceAppearance,
} from './force-equipment-schema.js';
import { isContentImageReference } from './campaign-assets.js';
import { validateContentQuests } from './quest-schema.js';
import { validateDialogue } from './dialogue-schema.js';
import {
  validateServiceRefusals,
  validatePreferredCompanions,
} from './character-relationships-schema.js';
import { validStartingCondition, validStartingSupplies } from './character-start-schema.js';

export const CONTENT_FORMAT = 'granaderos-content';
export const CONTENT_LIMIT = 2_000_000;
export const ATTRIBUTE_FIELDS = Object.freeze([
  'maxHp',
  'agility',
  'dexterity',
  'strength',
  'leadership',
  'wisdom',
  'marksmanship',
  'mechanical',
  'explosives',
  'medical',
]);
const CATALOGUE_LIMIT = 500;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value) =>
  typeof value === 'string' &&
  /^[a-z][a-z0-9-]{0,79}$/.test(value) &&
  !['constructor', 'prototype'].includes(value);
const integer = (value, minimum, maximum) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export class CampaignContentSchema {
  #errors = [];
  #content;
  #world;
  #identities;

  validate(content, world = content?.world) {
    this.#errors = [];
    if (!record(content)) return ['Contenido: se necesita un objeto.'];
    this.#content = content;
    this.#world = world;
    this.#check(
      content.format === CONTENT_FORMAT && content.version === 1,
      'Formato',
      'versión incompatible.',
    );
    this.#check(identifier(content.id), 'Campaña', 'identificador inválido.');
    this.#text(content.name, 'Nombre', 100);
    this.#check(
      content.includeOriginalResidents === undefined ||
        typeof content.includeOriginalResidents === 'boolean',
      'Habitantes originales',
      'elegí si se incluyen los habitantes genéricos del mapa.',
    );
    for (const field of ['characters', 'weapons', 'placements'])
      this.#check(
        Array.isArray(content[field]) && content[field].length <= CATALOGUE_LIMIT,
        field,
        'se necesita una lista de hasta 500 elementos.',
      );
    if (this.#errors.length) return [...this.#errors];
    this.#identities = {
      quests: new Set(
        (Array.isArray(content.quests) ? content.quests : []).map((quest) => quest?.id),
      ),
    };
    for (const field of ['characters', 'weapons', 'placements']) {
      const identifiers = (this.#identities[field] = new Set());
      for (const [index, entry] of content[field].entries()) {
        if (!record(entry)) {
          this.#errors.push(`${field}[${index}]: registro inválido.`);
          continue;
        }
        this.#check(
          identifier(entry.id) && !identifiers.has(entry.id),
          `${field}[${index}].id`,
          'identificador inválido o repetido.',
        );
        identifiers.add(entry.id);
      }
    }
    if (this.#errors.length) return [...this.#errors];
    try {
      validateContentQuests(content.quests, this.#identities.characters);
    } catch (error) {
      this.#errors.push(error.message);
    }
    this.#campaignOptions();
    for (const character of content.characters) this.#character(character);
    for (const weapon of content.weapons) this.#weapon(weapon);
    for (const placement of content.placements) this.#placement(placement);
    this.#placementCycles();
    return [...this.#errors];
  }

  #campaignOptions() {
    const content = this.#content;
    const context = { ...content, world: this.#world };
    const sectorIds = new Set((this.#world?.sectors ?? []).map((sector) => sector.id));
    try {
      validateCampaignStory(
        content.campaignStory,
        this.#identities.characters,
        this.#identities.quests,
        sectorIds,
      );
    } catch (error) {
      this.#errors.push(error.message);
    }
    this.#errors.push(
      ...validateCampaignEvents(content.campaignEvents, context, sectorIds),
      ...validateRoadsideDiscoveries(content.roadsideDiscoveries, context),
      ...validateContractRules(content.contractRules),
      ...validateArtilleryTradingRules(content.artilleryTrading, context),
      ...validateArtilleryTransportRules(content.artilleryTransport),
      ...validateArtilleryProfiles(content.artilleryProfiles),
      ...validateAmmunitionMarket(content.ammunitionMarket, context),
      ...validateArtillerySupply(content.artillerySupply),
      ...validateMilitiaPatrol(content.militiaPatrol),
      ...validateMilitiaProgression(content.militiaProgression),
      ...validateCareRules(content.careRules),
      ...validateFoundry(content.foundry, context),
      ...validateCampaignRoles(content.campaignRoles, content.characters),
      ...validateImportRules(content.imports, context),
      ...validateCampaignRules(content.rules),
      ...validateHeadquarters(content.headquarters, context),
      ...validateStartingTerritory(content.startingTerritory, content.headquarters, context),
    );
    if (content.errands !== undefined) {
      this.#errors.push(...validateErrandDefinitions(content.errands, context));
      if (!this.#errors.length) this.#errors.push(...validateErrandContactReferences(context));
    }
    if (content.arrivalSites !== undefined)
      this.#errors.push(...validateArrivalSites(content.arrivalSites, context));
    for (const [field, group] of Object.entries(FORCE_EQUIPMENT_GROUPS)) {
      for (const equipmentField of [field, group.bladeField]) {
        if (content[equipmentField] !== undefined)
          this.#errors.push(
            ...validateForceEquipment(field, content[equipmentField], this.#identities.weapons),
          );
      }
      if (content[group.appearanceField] !== undefined)
        this.#errors.push(...validateForceAppearance(field, content[group.appearanceField]));
    }
  }

  #check(condition, path, message) {
    if (!condition) this.#errors.push(`${path}: ${message}`);
  }

  #text(value, path, maximum, allowEmpty = false) {
    this.#check(
      typeof value === 'string' &&
        value.length <= maximum &&
        (allowEmpty || value.trim().length > 0),
      path,
      `texto inválido (máximo ${maximum} caracteres).`,
    );
  }

  #character(character) {
    const identities = this.#identities;
    this.#errors.push(
      ...validateServiceRefusals(character, identities.characters),
      ...validatePreferredCompanions(character, identities.characters),
    );
    this.#text(character.name, character.id, 100);
    this.#text(character.nickname, `${character.id}.nickname`, 100);
    this.#text(character.role, `${character.id}.role`, 200, true);
    this.#text(character.biography, `${character.id}.biography`, 5000, true);
    if (character.personality !== undefined)
      this.#text(character.personality, `${character.id}.personality`, 2000, true);
    this.#check(
      isContentImageReference(character.portrait) &&
        (!character.portrait.startsWith('data:') || character.portrait.length < 350000),
      `${character.id}.portrait`,
      'usá un retrato local o una imagen PNG, JPEG o WebP de hasta 250 KB.',
    );
    this.#check(
      integer(character.monthlyPay, 0, 1000000),
      `${character.id}.monthlyPay`,
      'paga inválida.',
    );
    this.#check(
      character.weapon === null || identities.weapons.has(character.weapon),
      `${character.id}.weapon`,
      'el arma no existe.',
    );
    if (character.blade !== undefined)
      this.#check(
        identities.weapons.has(character.blade),
        `${character.id}.blade`,
        'el arma blanca no existe.',
      );
    this.#check(
      record(character.attributes) &&
        Object.keys(character.attributes).length === ATTRIBUTE_FIELDS.length &&
        Object.keys(character.attributes).every((field) => ATTRIBUTE_FIELDS.includes(field)),
      `${character.id}.attributes`,
      'la lista de atributos no es válida.',
    );
    for (const field of ATTRIBUTE_FIELDS)
      this.#check(
        integer(character.attributes?.[field], field === 'maxHp' ? 15 : 0, 100),
        `${character.id}.${field}`,
        'atributo fuera de rango.',
      );
    if (character.arrivalHours !== undefined)
      this.#check(
        integer(character.arrivalHours, 0, 168),
        `${character.id}.arrivalHours`,
        'el viaje debe durar de 0 a 168 horas.',
      );
    if (character.ridingSkill !== undefined)
      this.#check(
        integer(character.ridingSkill, 0, 100),
        character.id,
        'equitación fuera de rango.',
      );
    for (const [field, allowed, message] of [
      ['recruitmentSource', ['contract', 'encounter'], 'origen de contratación inválido.'],
      ['service', ['contract', 'permanent'], 'servicio inválido.'],
      ['progression', ['experience', 'fixed'], 'progreso inválido.'],
    ])
      if (character[field] !== undefined)
        this.#check(allowed.includes(character[field]), character.id, message);
    for (const field of ['traits', 'abilities']) {
      if (character[field] !== undefined)
        this.#check(
          Array.isArray(character[field]) &&
            new Set(character[field]).size === character[field].length &&
            character[field].every(
              (value) => typeof value === 'string' && value.length > 0 && value.length <= 100,
            ),
          character.id,
          field === 'traits' ? 'especialidades inválidas.' : 'habilidades no válidas.',
        );
    }
    if (character.speech !== undefined) {
      this.#check(
        record(character.speech) &&
          SPEECH_EVENTS.every((event) => Object.hasOwn(character.speech, event)) &&
          Object.keys(character.speech).every((event) => AUTHORABLE_SPEECH_EVENTS.includes(event)),
        character.id,
        'la lista de frases no es válida.',
      );
      if (record(character.speech))
        for (const [event, line] of Object.entries(character.speech))
          this.#text(line, `${character.id}.speech.${event}`, SPEECH_LINE_LIMIT, true);
    }
    if (character.skinTone !== undefined)
      this.#check(
        ['light', 'brown', 'dark'].includes(character.skinTone),
        character.id,
        'paleta de piel no válida.',
      );
    if (character.serviceGuarantee !== undefined)
      this.#check(
        integer(character.serviceGuarantee, 0, 1000000),
        `${character.id}.serviceGuarantee`,
        'garantía inválida; solo un servicio por contrato admite fondos.',
      );
    if (character.startingSupplies !== undefined)
      this.#check(
        validStartingSupplies(character.startingSupplies),
        `${character.id}.startingSupplies`,
        'los seis suministros iniciales necesitan cantidades enteras de 0 a 1000.',
      );
    if (character.startingCondition !== undefined)
      this.#check(
        validStartingCondition(character.startingCondition, character.attributes?.maxHp),
        `${character.id}.startingCondition`,
        'el estado inicial necesita cinco valores enteros: salud de 1 al máximo, energía y fatiga de 0 a 100, sangrado de 0 a 10 y heridas vendadas dentro de la salud perdida. El sangrado necesita una herida sin vendar.',
      );
    if (character.encounter !== undefined) this.#encounter(character);
    const dialogue = character.encounter?.dialogue;
    if (dialogue !== undefined) {
      try {
        validateDialogue(
          dialogue,
          identities.characters,
          identities.quests,
          new Set((this.#world?.sectors ?? []).map((sector) => sector.id)),
        );
      } catch (error) {
        this.#errors.push(`${character.id}: ${error.message}`);
      }
    }
  }

  #encounter(character) {
    const encounter = character.encounter;
    this.#check(
      record(encounter) &&
        [
          'recruitable',
          'greeting',
          'requiredLeadership',
          'requiredLiberated',
          'requiredSector',
        ].every((field) => Object.hasOwn(encounter, field)) &&
        Object.keys(encounter).every((field) =>
          [
            'recruitable',
            'greeting',
            'requiredLeadership',
            'requiredLiberated',
            'requiredSector',
            'dialogue',
            'noncombatant',
          ].includes(field),
        ),
      character.id,
      'la configuración del encuentro no es válida.',
    );
    if (!record(encounter)) return;
    this.#check(
      typeof encounter.recruitable === 'boolean',
      character.id,
      'elegí si puede incorporarse.',
    );
    this.#text(encounter.greeting, `${character.id}.encounter.greeting`, 1000, true);
    this.#check(
      integer(encounter.requiredLeadership, 0, 100) &&
        integer(
          encounter.requiredLiberated,
          0,
          Math.max(0, (this.#world?.sectors?.length ?? 0) - 1),
        ),
      character.id,
      'los requisitos del encuentro están fuera de rango.',
    );
    this.#check(
      encounter.requiredSector === null ||
        (this.#world?.sectors ?? []).some((sector) => sector.id === encounter.requiredSector),
      character.id,
      'la localidad requerida no existe.',
    );
  }

  #weapon(weapon) {
    this.#text(weapon.name, weapon.id, 100);
    this.#check(
      (Number.isSafeInteger(weapon.template) && weapon.template >= 0) ||
        (typeof weapon.template === 'string' &&
          weapon.template.length > 0 &&
          weapon.template.length <= 80),
      `${weapon.id}.template`,
      'familia no compatible.',
    );
    this.#check(integer(weapon.damage, 1, 100), `${weapon.id}.damage`, 'valor fuera de rango.');
    for (const field of [
      'fireAP',
      'aimAP',
      'reloadAP',
      'range',
      'readyAP',
      'ap',
      'capacity',
      'price',
      'stockAP',
      'stockDamage',
    ]) {
      if (weapon[field] === undefined) continue;
      this.#check(
        Number.isSafeInteger(weapon[field]) && weapon[field] >= 0,
        `${weapon.id}.${field}`,
        'valor fuera de rango.',
      );
    }
    for (const field of ['weight', 'reach', 'stockReach', 'materialRangeSlope']) {
      if (weapon[field] !== undefined)
        this.#check(
          Number.isFinite(weapon[field]),
          `${weapon.id}.${field}`,
          'valor fuera de rango.',
        );
    }
    if (weapon.art !== undefined)
      this.#check(
        isContentImageReference(weapon.art) &&
          (!weapon.art.startsWith('data:') || weapon.art.length < 350000),
        `${weapon.id}.art`,
        'la imagen del arma no es válida.',
      );
    if (weapon.ammunitionFamily !== undefined)
      this.#check(
        typeof weapon.ammunitionFamily === 'string',
        `${weapon.id}.ammunitionFamily`,
        'la familia de munición no es válida.',
      );
    this.#projectileProfile(weapon, weapon.id);
    if (weapon.alternativeLoads !== undefined) {
      const loads = weapon.alternativeLoads;
      this.#check(
        Array.isArray(loads) &&
          loads.length <= 3 &&
          new Set(loads.map((load) => load?.family)).size === loads.length &&
          loads.every(
            (load) =>
              record(load) &&
              ['family', 'damage', 'range', 'pattern'].every((field) =>
                Object.hasOwn(load, field),
              ) &&
              Object.keys(load).every((field) =>
                [
                  'family',
                  'damage',
                  'range',
                  'pattern',
                  'materialRangeSlope',
                  'projectileEnergy',
                  'projectileAirDrag',
                ].includes(field),
              ) &&
              typeof load.family === 'string' &&
              integer(load.damage, 1, 100) &&
              integer(load.range, 1, 100) &&
              ['single', 'cone'].includes(load.pattern),
          ),
        `${weapon.id}.alternativeLoads`,
        'las cargas alternativas no son válidas.',
      );
      if (Array.isArray(loads))
        for (const load of loads) if (record(load)) this.#projectileProfile(load, weapon.id);
    }
  }

  #projectileProfile(profile, identifier) {
    if (profile.projectileEnergy !== undefined)
      this.#check(
        isProjectileEnergyRecord(profile.projectileEnergy),
        identifier,
        'El perfil de energía del proyectil no es válido.',
      );
    if (profile.projectileAirDrag !== undefined)
      this.#check(
        isProjectileAirDragRecord(profile.projectileAirDrag) &&
          isProjectileEnergyRecord(profile.projectileEnergy),
        identifier,
        'La pérdida de energía en el aire no es válida.',
      );
    if (profile.materialRangeSlope !== undefined)
      this.#check(
        validMaterialRangeSlope(profile.materialRangeSlope),
        identifier,
        'La pérdida de penetración por distancia no es válida.',
      );
  }

  #placement(placement) {
    const characters = this.#identities.characters;
    const contentSectors = [...(this.#world?.cells ?? []), ...(this.#world?.sectors ?? [])];
    const districts = this.#world?.districts ?? {};
    const cellIds = Array.isArray(placement.sectors)
      ? placement.sectors.map((id) => {
          const anchor = Object.hasOwn(districts, id) ? districts[id]?.[0] : null;
          return anchor ? `cell-${anchor.col}-${anchor.row}` : id;
        })
      : [];
    this.#check(
      characters.has(placement.character) &&
        this.#content.placements.filter((candidate) => candidate.character === placement.character)
          .length === 1,
      placement.id,
      'cada personaje puede tener una sola aparición.',
    );
    this.#check(
      ['fixed', 'once', 'daily'].includes(placement.mode),
      placement.id,
      'modo de aparición inválido.',
    );
    this.#check(
      Array.isArray(placement.sectors) &&
        placement.sectors.length > 0 &&
        placement.sectors.length <= contentSectors.length &&
        new Set(cellIds).size === placement.sectors.length &&
        placement.sectors.every((id) => contentSectors.some((sector) => sector.id === id)) &&
        (placement.mode !== 'fixed' || placement.sectors.length === 1),
      placement.id,
      'seleccioná sectores válidos; la ubicación fija necesita uno.',
    );
    if (placement.selection !== undefined)
      this.#check(
        ['random', 'alternate'].includes(placement.selection) &&
          (placement.selection !== 'alternate' ||
            (placement.mode === 'daily' && placement.sectors?.length === 2)),
        placement.id,
        'la alternancia diaria necesita dos celdas.',
      );
    if (placement.loadedGuard !== undefined)
      this.#check(
        ['current', 'range'].includes(placement.loadedGuard),
        placement.id,
        'protección de escena inválida.',
      );
    this.#check(
      integer(placement.moveChance, 0, 100),
      placement.id,
      'probabilidad fuera de rango.',
    );
    this.#check(
      placement.afterDeath === null ||
        (characters.has(placement.afterDeath) && placement.afterDeath !== placement.character),
      placement.id,
      'condición de muerte inválida.',
    );
    this.#check(
      integer(placement.delayMin, 0, 525600) &&
        integer(placement.delayMax, placement.delayMin, 525600),
      placement.id,
      'demora inválida (minutos).',
    );
  }

  #placementCycles() {
    const dependencies = new Map(
      this.#content.placements.map((placement) => [placement.character, placement.afterDeath]),
    );
    for (const characterId of dependencies.keys()) {
      const visited = new Set();
      let next = characterId;
      while (next) {
        if (visited.has(next)) {
          this.#errors.push(`${characterId}: ciclo en las condiciones de muerte.`);
          break;
        }
        visited.add(next);
        next = dependencies.get(next);
      }
    }
  }
}
