import { isCharacterDeployed } from './infrastructure/session/campaign-session-access.js';
import { validateWeaponCarrier, weaponSpecification } from './weapon-definition.ts';
import { validateBattleSnapshot } from './validate-battle.js';
import { validateItemStack } from './tactical-inventory.js';
import { fittingItemIds } from './weapon-fittings.js';
export function migrateSquads(s) {
  if (!s.squads) {
    s.squads = [
      { id: 'squad-1', name: 'Primera escuadra', members: [...s.squad], location: s.location },
    ];
  }
  s.activeSquadId ??= s.squads[0]?.id ?? 'squad-1';
  s.sectorStates ??= {};
  return s;
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @returns {import('./public/campaign-types.ts').CampaignSquad} */
export function activeSquad(s) {
  return (
    (s.squads ?? []).find((q) => q.id === s.activeSquadId) ?? {
      id: 'squad-1',
      name: 'Primera escuadra',
      members: s.squad,
      location: s.location,
    }
  );
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @returns {string | null} */
export function squadReorganizationReason(s) {
  if (activeSquad(s).members.some((id) => isCharacterDeployed(s, id))) {
    return 'La escuadra participa en una visita de sector abierta.';
  }
  return activeSquad(s).journey
    ? 'Esperá la llegada o cancelá la ruta antes de reorganizar la escuadra.'
    : null;
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {number} id
 * @returns {string} */
export function operativeLocation(s, id) {
  return (
    s.squads?.find((q) => q.members.includes(id))?.location ??
    s.operativeState[id]?.location ??
    s.location
  );
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {number} id
 * @returns {boolean} */
export function operativeInTransit(s, id) {
  return Boolean(
    s.squads?.some(
      (q) => q.members.includes(id) && ['moving', 'ready'].includes(q.journey?.status),
    ),
  );
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {number} id
 * @returns {boolean} */
export function canReassignOperative(s, id) {
  return (
    s.recruited.includes(id) &&
    s.operativeState[id]?.alive &&
    !s.operativeState[id]?.captured &&
    !isCharacterDeployed(s, id) &&
    !s.squads?.some((q) => q.journey && q.members.includes(id))
  );
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @returns {number[]} */
export function travelingOperatives(s) {
  return (s.squads ?? [])
    .filter((q) => ['moving', 'ready'].includes(q.journey?.status))
    .flatMap((q) => q.members);
}
export function synchronizeSquad(s) {
  const squad = s.squads.find((q) => q.id === s.activeSquadId);
  if (squad) {
    squad.members = [...s.squad];
    squad.location = s.location;
  }
  return s;
}
export function validateSectorSnapshot(snapshot, context = null) {
  return validateBattleSnapshot(snapshot, context);
}
export function validatePersonalInventory(inventory) {
  if (
    !inventory ||
    typeof inventory !== 'object' ||
    Array.isArray(inventory) ||
    Object.keys(inventory).length > 1000
  ) {
    throw Error('El inventario del combatiente es inválido.');
  }
  const identities = new Set();
  for (const [key, value] of Object.entries(inventory)) {
    const record = typeof value === 'number' ? { count: value, weight: 0 } : value;
    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      !Number.isInteger(record.count) ||
      record.count < 0 ||
      record.count > 1000000
    ) {
      throw Error('La cantidad de pertrechos es inválida.');
    }
    if (!Number.isFinite(record.weight) || record.weight < 0 || record.weight > 10000) {
      throw Error('El peso del objeto es inválido.');
    }
    // Validate existing property values without applying the acquisition capacity
    // limit. Old overfull packs must remain saveable and able to discard equipment.
    validateItemStack({ ...record, item: `inventory:${key}`, count: Math.max(1, record.count) });
    if (record.count > 0) {
      for (const id of fittingItemIds(record)) {
        if (identities.has(id)) {throw Error('La identidad del equipo está duplicada.');}
        identities.add(id);
      }
    }
    validateWeaponCarrier(record);
    if (
      record.loaded !== undefined &&
      (!Number.isInteger(record.loaded) ||
        record.loaded < 0 ||
        record.loaded > (weaponSpecification(record)?.capacity ?? 0))
    ) {
      throw Error('La carga del arma recuperada es inválida.');
    }
  }
  return inventory;
}

/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @returns {import('./public/campaign-types.ts').CampaignSquad | undefined} */
export function vacantSquad(s) {
  return s.squads?.find((q) => q.members.length === 0 && !q.journey);
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @returns {boolean} */
export function canCreateSquad(s) {
  return (s.squads?.length ?? 0) < 8 || Boolean(vacantSquad(s));
}
