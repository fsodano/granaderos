import { validateWorldData } from './world-schema.js';
import { validateMapDocument } from './map-schema.js';
import { validateCampaignPresentation } from './presentation-schema.js';
import { CampaignContentSchema } from './content-schema.js';
import { validateCampaignData } from './campaign-data-validation.js';
import { validateCampaignManifest } from './campaign-manifest.js';
import { validateCampaignAssets, validateSelectedCampaignAssets } from './campaign-assets.js';
import { contentIdentity } from './content-identity.js';

function freezeDefinition(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDefinition(child);
    Object.freeze(value);
  }
  return value;
}

export class CampaignDefinition {
  #manifest;
  #documents;
  #identity;

  constructor(manifest, documents) {
    validateCampaignManifest(manifest);
    const errors = validateCampaignData(documents);
    if (errors.length) throw new Error(errors.join('\n'));
    if (documents?.content?.id !== manifest.id) {
      throw new Error('El contenido pertenece a otra campaña.');
    }
    for (const name of ['content', 'world', 'maps', 'presentation', 'assets']) {
      if (
        !documents[name] ||
        typeof documents[name] !== 'object' ||
        Array.isArray(documents[name])
      ) {
        throw new Error(`Falta el documento ${name}.`);
      }
    }
    const worldErrors = validateWorldData(documents.world);
    if (worldErrors.length) throw new Error(worldErrors.join('\n'));
    const content = {
      ...documents.content,
      scenario: manifest.scenario,
      world: documents.world,
      maps: documents.maps,
    };
    const referenceErrors = [
      ...new CampaignContentSchema().validate(documents.content, documents.world),
      ...validateCampaignPresentation(documents.presentation, content),
      ...validateCampaignAssets(documents.assets),
      ...validateSelectedCampaignAssets(manifest.id, documents.assets, [
        documents.content,
        documents.world,
        documents.maps,
        documents.presentation,
      ]),
    ];
    for (const characterId of Object.values(
      documents.content.campaignRoles === undefined ? (documents.world.defaultRoles ?? {}) : {},
    )) {
      if (
        characterId !== null &&
        !(Array.isArray(documents.content.characters) ? documents.content.characters : []).some(
          (character) => character.id === characterId,
        )
      ) {
        referenceErrors.push('Funciones de campaña: el personaje asignado por el mapa no existe.');
      }
    }
    const requiredMaps = new Set([
      ...documents.world.sectors.map((sector) => sector.id),
      ...Object.keys(documents.world.sceneExits ?? {}),
    ]);
    for (const sectorId of requiredMaps) {
      if (!Object.hasOwn(documents.maps, sectorId))
        referenceErrors.push(`Falta el mapa de la localidad ${sectorId}.`);
    }
    for (const [identifier, map] of Object.entries(documents.maps)) {
      referenceErrors.push(
        ...validateMapDocument(map).errors.map((message) => `Mapa ${identifier}: ${message}`),
      );
      if (map?.id !== identifier)
        referenceErrors.push(`El mapa ${identifier} tiene otra identidad.`);
    }
    if (referenceErrors.length) throw new Error(referenceErrors.join('\n'));
    this.#manifest = freezeDefinition(structuredClone(manifest));
    this.#documents = freezeDefinition(structuredClone(documents));
    this.#identity = contentIdentity({
      id: manifest.id,
      version: manifest.version,
      manifest,
      documents,
    });
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
