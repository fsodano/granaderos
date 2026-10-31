import {
  FORCE_EQUIPMENT_GROUPS,
  validateForceAppearance as validateForceAppearanceSchema,
} from '../campaign-format/force-equipment-schema.js';
export { validateForceEquipment } from '../campaign-format/force-equipment-schema.js';
export function validateForceAppearance(field, value) {
  const errors = validateForceAppearanceSchema(field, value);
  if (errors.length) {
    return errors;
  }
  const group = FORCE_EQUIPMENT_GROUPS[field];
  return Object.keys(group.roles).flatMap((role) =>
    Object.hasOwn(SPRITE_APPEARANCES, value[role].spriteAppearance)
      ? []
      : [`${group.roles[role]}: elegí una apariencia y una paleta de piel válidas.`],
  );
}
import {
  weaponMetadata,
  weaponSpecification,
  validateWeaponCarrier,
  contentWeaponOf,
} from './weapon-definition.ts';
import { hasGenericCharacterDefinitions, campaignActors } from './content-character-ids.ts';
import { SPRITE_APPEARANCES } from './sprite-appearances.ts';
import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';

export const FORCE_EQUIPMENT = Object.freeze(
  Object.fromEntries(
    Object.entries(FORCE_EQUIPMENT_GROUPS).map(([field, group]) => [
      field,
      {
        ...group,
        bladeTemplates: DEFAULT_CATALOGUE.forceEquipmentTemplates[field].secondary,
        templates: DEFAULT_CATALOGUE.forceEquipmentTemplates[field].primary,
      },
    ]),
  ),
);
export const MILITIA_EQUIPMENT_ROLES = ['green', 'regular', 'veteran'];
export const NEUTRAL_FORCE_APPEARANCE = Object.freeze({
  spriteAppearance: 'worker',
  skinTone: 'brown',
});
export function defaultForceEquipment(field, weapons) {
  return Object.fromEntries(
    Object.entries(FORCE_EQUIPMENT[field].templates).map(([role, template]) => [
      role,
      weapons
        ? ((
            weapons.find((w) => w.id === `firearm-${template}`) ??
            weapons.find((w) => w.template === template)
          )?.id ?? null)
        : `firearm-${template}`,
    ]),
  );
}
export function defaultForceBlades(field, weapons) {
  return Object.fromEntries(
    Object.entries(FORCE_EQUIPMENT[field].bladeTemplates).map(([role, template]) => [
      role,
      weapons
        ? ((
            weapons.find((w) => w.id === `blade-${template}`) ??
            weapons.find((w) => w.template === template)
          )?.id ?? null)
        : `blade-${template}`,
    ]),
  );
}

export function forceWeaponUsers(content, id) {
  return Object.entries(FORCE_EQUIPMENT).flatMap(([field, group]) =>
    Object.entries(group.roles).flatMap(([role, label]) => [
      ...(content[field]?.[role] === id ? [label] : []),
      ...(content[group.bladeField]?.[role] === id ? [`${label} · arma blanca`] : []),
    ]),
  );
}
// Only fresh soldiers pass here. Retained soldiers keep their physical equipment.
export function authoredForceEquipment(state, field, role, unit, cartridges) {
  const content = state?.contentCampaign?.package,
    assignment = content?.[field],
    generic = hasGenericCharacterDefinitions(content);
  let result = { ...unit };
  // Authored generic forces start without historical gear or a faction uniform.
  // Only explicit campaign assignments issue equipment to a fresh soldier.
  if (generic) {
    delete result.weaponMetadata;
    delete result.contentWeapon;
    delete result.bladeMetadata;
    result = { ...result, weapon: 0, blade: 0, ...NEUTRAL_FORCE_APPEARANCE };
  }
  if (assignment !== undefined) {
    delete result.weaponMetadata;
    delete result.contentWeapon;
    const id = assignment[role],
      weapon = id === null ? null : content.weapons.find((w) => w.id === id);
    if (id !== null && !weapon) {
      throw Error('El arma asignada a la tropa no existe.');
    }
    const gear = weapon
      ? { weapon: weapon.template, weaponMetadata: weaponMetadata(weapon) }
      : { weapon: 0 };
    result = { ...result, ...gear };
  }
  const capacity = weaponSpecification(result)?.capacity ?? 0,
    loaded = Math.min(capacity, cartridges);
  result = { ...result, loaded, ammo: capacity ? cartridges - loaded : 0 };
  const blades = content?.[FORCE_EQUIPMENT[field].bladeField],
    id = blades?.[role];
  // Historical packages keep the old null-secondary compatibility rule.
  // Generic null and omitted selections keep the explicit empty blade slot.
  if (id !== undefined && id !== null) {
    const blade = content.weapons.find((w) => w.id === id);
    if (!blade) {
      throw Error('El arma blanca de la tropa no existe.');
    }
    result = { ...result, blade: blade.template, bladeMetadata: weaponMetadata(blade) };
  }
  const appearance =
    content?.[FORCE_EQUIPMENT[field].appearanceField]?.[role] ??
    (generic ? NEUTRAL_FORCE_APPEARANCE : undefined);
  if (appearance) {
    result = { ...result, ...appearance, forceAppearance: { field, role } };
  }
  return result;
}
export function validateForceAppearanceReferences(state, value = state) {
  const content = state?.contentCampaign?.package;
  const pending = value?.pendingBattle;
  const actors = [
    ...campaignActors(value),
    ...campaignActors(pending?.resumeSnapshot ?? {}),
    ...(pending?.enemies ?? []),
    ...(pending?.garrison ?? []),
    ...Object.values(value?.garrisons ?? {}).flat(),
    ...(value?.enemyGroups ?? []).flatMap((group) => group.units ?? []),
    ...(value?.militiaTraining ?? []).flatMap((course) => course.trainees ?? []),
  ];
  for (const actor of actors) {
    // Older snapshots predate role references and retain their admitted visuals.
    // Structural actor validation owns malformed bodies. This optional role
    // reference check must not obscure its instruction/health diagnostic.
    if (actor?.forceAppearance === undefined) {
      continue;
    }
    const ref = actor.forceAppearance,
      group =
        ref && typeof ref.field === 'string' && Object.hasOwn(FORCE_EQUIPMENT, ref.field)
          ? FORCE_EQUIPMENT[ref.field]
          : undefined;
    const valid =
      ref !== null &&
      typeof ref === 'object' &&
      !Array.isArray(ref) &&
      Object.keys(ref).length === 2 &&
      Object.hasOwn(ref, 'field') &&
      Object.hasOwn(ref, 'role') &&
      typeof ref.role === 'string' &&
      group &&
      Object.hasOwn(group.roles, ref.role);
    const expected = valid
      ? (content?.[group.appearanceField]?.[ref.role] ??
        (hasGenericCharacterDefinitions(content) ? NEUTRAL_FORCE_APPEARANCE : undefined))
      : undefined;
    if (
      !expected ||
      actor.spriteAppearance !== expected.spriteAppearance ||
      actor.skinTone !== expected.skinTone
    ) {
      throw Error('La apariencia guardada de la tropa no coincide con la campaña.');
    }
  }
}
export function validateForceWeapon(unit) {
  validateWeaponCarrier(unit);
  if (
    contentWeaponOf(unit) &&
    (!Number.isSafeInteger(unit.loaded) ||
      !Number.isSafeInteger(unit.ammo) ||
      unit.ammo < 0 ||
      unit.ammo > 100000)
  ) {
    throw Error('La munición guardada de la tropa no es válida.');
  }
}
