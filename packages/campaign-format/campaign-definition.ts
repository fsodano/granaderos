import { validateWorldData } from './world-schema.js';
import { validateMapDocument } from './map-schema.js';
import { validateCampaignPresentation } from './presentation-schema.js';
import { CampaignContentSchema } from './content-schema.js';
import { validateCampaignData } from './campaign-data-validation.ts';
import { validateCampaignManifest } from './campaign-manifest.js';
import { validateCampaignAssets, validateSelectedCampaignAssets } from './campaign-assets.js';
import { contentIdentity } from './content-identity.js';
import type {
  CampaignAssets,
  CampaignContent,
  CampaignManifest,
  CampaignPresentation,
  PhysicalMap,
  WorldDefinition,
} from './types.ts';

export interface CampaignDefinitionDocuments {
  content: CampaignContent;
  world: WorldDefinition;
  maps: Record<string, PhysicalMap>;
  presentation: CampaignPresentation;
  assets: CampaignAssets;
}
export type ImmutableDefinition<T> = T extends readonly (infer Item)[]
  ? readonly ImmutableDefinition<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: ImmutableDefinition<T[Key]> }
    : T;
function freezeDefinition<T>(value: T): ImmutableDefinition<T>;
function freezeDefinition(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    const children: unknown[] = Object.values(value);
    for (const child of children) {
      freezeDefinition(child);
    }
    Object.freeze(value);
  }
  return value;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function assertManifest(value: unknown): asserts value is CampaignManifest {
  validateCampaignManifest(value);
}
function assertWorld(value: unknown): asserts value is WorldDefinition {
  const errors: string[] = validateWorldData(value);
  if (errors.length) {
    throw Error(errors.join('\n'));
  }
}
function admitDocuments(
  value: unknown,
  manifest: CampaignManifest,
): asserts value is CampaignDefinitionDocuments {
  const dataErrors = validateCampaignData(value);
  if (dataErrors.length) {
    throw Error(dataErrors.join('\n'));
  }
  if (!record(value) || !record(value['content']) || value['content']['id'] !== manifest.id) {
    throw Error('El contenido pertenece a otra campaña.');
  }
  for (const name of ['content', 'world', 'maps', 'presentation', 'assets']) {
    if (!record(value[name])) {
      throw Error(`Falta el documento ${name}.`);
    }
  }
  const world = value['world'],
    maps = value['maps'],
    content = value['content'],
    presentation = value['presentation'],
    assets = value['assets'];
  if (!record(world) || !record(maps)) {
    throw Error('Falta el documento world o maps.');
  }
  const sceneExits = world['sceneExits'];
  assertWorld(world);
  const resolved = { ...content, scenario: manifest.scenario, world, maps };
  const referenceErrors: string[] = [
    ...new CampaignContentSchema().validate(content, world),
    ...validateCampaignPresentation(presentation, resolved),
    ...validateCampaignAssets(assets),
    ...validateSelectedCampaignAssets(manifest.id, assets, [content, world, maps, presentation]),
  ];
  const roles = content['campaignRoles'] === undefined ? (world.defaultRoles ?? {}) : {};
  const characters: unknown[] = Array.isArray(content['characters']) ? content['characters'] : [];
  for (const characterId of Object.values(roles)) {
    if (
      characterId !== null &&
      !characters.some((character) => record(character) && character['id'] === characterId)
    ) {
      referenceErrors.push('Funciones de campaña: el personaje asignado por el mapa no existe.');
    }
  }
  const requiredMaps = new Set([
    ...world.sectors.map((sector) => sector.id),
    ...Object.keys(record(sceneExits) ? sceneExits : {}),
  ]);
  for (const sectorId of requiredMaps) {
    if (!Object.hasOwn(maps, sectorId)) {
      referenceErrors.push(`Falta el mapa de la localidad ${sectorId}.`);
    }
  }
  for (const [identifier, map] of Object.entries(maps)) {
    const errors: string[] = validateMapDocument(map).errors;
    referenceErrors.push(...errors.map((message) => `Mapa ${identifier}: ${message}`));
    if (!record(map) || map['id'] !== identifier) {
      referenceErrors.push(`El mapa ${identifier} tiene otra identidad.`);
    }
  }
  if (referenceErrors.length) {
    throw Error(referenceErrors.join('\n'));
  }
}

/** Admitted authored definitions own their immutable documents and stable content identity. */
export class CampaignDefinition {
  readonly #manifest: ImmutableDefinition<CampaignManifest>;
  readonly #documents: ImmutableDefinition<CampaignDefinitionDocuments>;
  readonly #identity: ReturnType<typeof contentIdentity>;
  constructor(manifest: unknown, documents: unknown) {
    assertManifest(manifest);
    admitDocuments(documents, manifest);
    this.#manifest = freezeDefinition(structuredClone(manifest));
    this.#documents = freezeDefinition(structuredClone(documents));
    const identitySource = { id: manifest.id, version: manifest.version, manifest, documents };
    this.#identity = contentIdentity(identitySource);
  }
  get id() {
    return this.#manifest.id;
  }
  get revision() {
    return this.#manifest.revision;
  }
  get identity() {
    return this.#identity;
  }
  get manifest() {
    return this.#manifest;
  }
  get documents() {
    return this.#documents;
  }
}
