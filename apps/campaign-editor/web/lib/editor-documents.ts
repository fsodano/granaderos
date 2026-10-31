import {
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../../../../packages/campaign-format/campaign-manifest.js';
import {
  validateContentPackage,
  validateCampaignWorld,
  validateMap,
  blankMap,
} from '../../../../packages/game/public/campaign-editor-api.ts';
import type { CampaignContent, JsonValue } from '../../../../packages/campaign-format/types.ts';

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return typeof value === 'object' && Object.values(value).every(isJsonValue);
}

export function parseEditorJson(text: string): JsonValue {
  const value: unknown = JSON.parse(text);
  if (!isJsonValue(value)) {
    throw new Error('El documento contiene un valor JSON no válido.');
  }
  return value;
}

export function assertCampaignContent(value: JsonValue): asserts value is CampaignContent {
  const errors: string[] = validateContentPackage(value);
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}

export function replaceCampaignContentField(
  content: CampaignContent,
  field: keyof CampaignContent,
  value: JsonValue,
): CampaignContent {
  const next = { ...content, [field]: value };
  assertCampaignContent(next);
  return next;
}

export function documentFieldLabel(value: JsonValue): string {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return '';
  }
  for (const key of ['name', 'title', 'id']) {
    const field = value[key];
    if (typeof field === 'string') {
      return field;
    }
  }
  return '';
}

export function isJsonDocument(
  value: JsonValue,
): value is import('../../../../packages/campaign-format/types.ts').JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireJsonDocument(
  value: JsonValue,
): import('../../../../packages/campaign-format/types.ts').JsonObject {
  if (!isJsonDocument(value)) {
    throw new Error('El documento necesita un objeto JSON.');
  }
  return value;
}

export function assertCampaignManifest(
  value: JsonValue,
): asserts value is import('../../../../packages/campaign-format/types.ts').CampaignManifest {
  validateCampaignManifest(value);
}

export function assertCampaignRegistry(
  value: JsonValue,
): asserts value is import('../../../../packages/campaign-format/types.ts').CampaignRegistry {
  validateCampaignRegistry(value);
}

/** Raw authoring fields can be incomplete; render only values of the expected shape. */
export function documentObject(
  value: JsonValue | undefined,
): import('../../../../packages/campaign-format/types.ts').JsonObject {
  return value !== undefined && isJsonDocument(value) ? value : {};
}
export function documentObjects(
  value: JsonValue | undefined,
): import('../../../../packages/campaign-format/types.ts').JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonDocument) : [];
}
export function documentString(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
export function documentNumber(value: JsonValue | undefined, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

export function assertCampaignWorld(
  value: JsonValue,
): asserts value is import('../../../../packages/campaign-format/types.ts').WorldDefinition {
  const errors: string[] = validateCampaignWorld(value);
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}

export function assertPhysicalMap(
  value: JsonValue,
): asserts value is import('../../../../packages/campaign-format/types.ts').PhysicalMap {
  const report = validateMap(value);
  if (!report.valid) {
    throw new Error(report.errors.join('\n'));
  }
}
export function readBuildingTemplate(
  value: JsonValue,
): import('../../domain/sector-map-command.ts').MapBuildingTemplate {
  const raw = requireJsonDocument(value);
  if (raw['version'] !== 1 || !raw['building']) {
    throw new Error('La plantilla no es compatible.');
  }
  const map: import('../../../../packages/campaign-format/types.ts').JsonObject = {
    ...blankMap({ width: 64, height: 64 }),
    buildings: [raw['building']],
  };
  for (const layer of [
    'features',
    'props',
    'items',
    'spawns',
    'exits',
    'lights',
    'upperSurfaces',
    'climbLinks',
  ]) {
    const entries = raw[layer];
    if (entries !== undefined) {
      map[layer] = entries;
    }
  }
  assertPhysicalMap(map);
  const building = map.buildings[0];
  if (!building) {
    throw new Error('La plantilla necesita un edificio.');
  }
  return {
    version: 1,
    name: documentString(raw['name'], building.name ?? 'Edificio'),
    building,
    features: map.features,
    props: map.props,
    items: map.items,
    spawns: map.spawns,
    exits: map.exits,
    lights: map.lights,
    ...(map.upperSurfaces ? { upperSurfaces: map.upperSurfaces } : {}),
    ...(map.climbLinks ? { climbLinks: map.climbLinks } : {}),
  };
}
