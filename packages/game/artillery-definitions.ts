import type { ArtilleryProfile } from '../campaign-format/types.ts';
import type { CampaignSnapshot } from './public/campaign-types.ts';
export type ArtilleryContext = {
  contentCampaign?: { package: { artilleryProfiles?: Record<string, ArtilleryProfile> } };
  artilleryDefinitions?: Record<string, ArtilleryProfile>;
};
import { validateArtilleryProfiles } from '../campaign-format/artillery-profile-schema.js';
export {
  ARTILLERY_FIELDS,
  validateArtilleryProfiles,
} from '../campaign-format/artillery-profile-schema.js';
import { canonicalContent } from './content-identity.js';
export const ARTILLERY = Object.freeze({
  bronze4: Object.freeze({
    name: 'Cañón de Bronce de 4 lb',
    art: '/art/cannon.png',
    price: 700,
    crew: 2,
    fireAP: 30,
    reloadAP: 60,
    moveAP: 20,
    pivotAP: 10,
    radius: 4,
    range: 80,
    damage: 85,
    penetration: 3,
    initialLoaded: true,
    initialAmmo: 6,
  }),
  field8: Object.freeze({
    name: 'Cañón de Campaña de 8 lb',
    art: '/art/cannon.png',
    price: 1100,
    crew: 3,
    fireAP: 40,
    reloadAP: 75,
    moveAP: 30,
    pivotAP: 15,
    radius: 6,
    range: 110,
    damage: 110,
    penetration: 5,
    initialLoaded: true,
    initialAmmo: 6,
  }),
  swivel: Object.freeze({
    name: 'Pedrero de Regala',
    art: '/art/cannon.png',
    price: 400,
    crew: 1,
    fireAP: 20,
    reloadAP: 35,
    moveAP: 10,
    pivotAP: 5,
    radius: 3,
    range: 35,
    damage: 65,
    penetration: 1,
    initialLoaded: true,
    initialAmmo: 6,
  }),
});

export const artilleryProfilesFor = (
  s: ArtilleryContext | null | undefined,
): Readonly<Record<string, ArtilleryProfile>> =>
  s?.contentCampaign?.package.artilleryProfiles ?? s?.artilleryDefinitions ?? ARTILLERY;
export function artilleryProfile(
  state: ArtilleryContext | null | undefined,
  gun: string | { type: string },
): ArtilleryProfile;
export function artilleryProfile(
  state: ArtilleryContext | null | undefined,
  gun: null | undefined,
): undefined;
export function artilleryProfile(
  state: ArtilleryContext | null | undefined,
  gun: string | { type: string } | null | undefined,
): ArtilleryProfile | undefined;
export function artilleryProfile(
  state: ArtilleryContext | null | undefined,
  gun: string | { type: string } | null | undefined,
): ArtilleryProfile | undefined {
  if (gun == null) {
    return undefined;
  }
  const id = typeof gun === 'string' ? gun : gun.type;
  const profile = artilleryProfilesFor(state)[id];
  if (!profile) {
    throw new Error(`El modelo de artillería no existe: ${id}`);
  }
  return profile;
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateCampaignArtilleryProfiles(
  campaign: ArtilleryContext,
  scene: ArtilleryContext | null | undefined,
): void {
  if (!scene) {
    return;
  }
  if (
    validateArtilleryProfiles(scene.artilleryDefinitions).length ||
    canonicalContent(artilleryProfilesFor(campaign)) !==
      canonicalContent(scene.artilleryDefinitions ?? ARTILLERY)
  ) {
    throw Error('Los modelos de artillería no coinciden con la campaña.');
  }
}
// Uploaded images live once in the immutable package, not once per saved scene.
export function artillerySaveReplacer(
  campaign: CampaignSnapshot,
  replacer: (key: string, value: unknown) => unknown,
) {
  const definitions = campaign.contentCampaign?.package.artilleryProfiles,
    expected = definitions && canonicalContent(definitions);
  return (key: string, value: unknown): unknown =>
    key === 'artilleryDefinitions' && expected && canonicalContent(value) === expected
      ? { definitionRef: 'artilleryProfiles' }
      : replacer(key, value);
}
export function restoreArtilleryReferences(campaign: CampaignSnapshot, value: unknown): void {
  const definitions = campaign.contentCampaign?.package.artilleryProfiles;
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (!object(node)) {
      return;
    }
    const ref = node['artilleryDefinitions'];
    if (object(ref) && Object.hasOwn(ref, 'definitionRef')) {
      if (
        !definitions ||
        Object.keys(ref).length !== 1 ||
        ref['definitionRef'] !== 'artilleryProfiles'
      ) {
        throw Error('La referencia de artillería guardada es inválida.');
      }
      node['artilleryDefinitions'] = structuredClone(definitions);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'contentCampaign' && key !== 'artilleryDefinitions') {
        visit(child);
      }
    }
  }
  visit(value);
}
