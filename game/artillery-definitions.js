import {
  ARTILLERY_FIELDS,
  validateArtilleryProfiles,
} from '../campaign-format/artillery-profile-schema.js';
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

export const artilleryProfilesFor = (s) =>
  s?.contentCampaign?.package.artilleryProfiles ?? s?.artilleryDefinitions ?? ARTILLERY;
export const artilleryProfile = (s, gun) =>
  artilleryProfilesFor(s)[typeof gun === 'string' ? gun : gun?.type];
const object = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function validateCampaignArtilleryProfiles(campaign, scene) {
  if (!scene) return;
  if (
    validateArtilleryProfiles(scene.artilleryDefinitions).length ||
    canonicalContent(artilleryProfilesFor(campaign)) !==
      canonicalContent(scene.artilleryDefinitions ?? ARTILLERY)
  )
    throw Error('Los modelos de artillería no coinciden con la campaña.');
}
// Uploaded images live once in the immutable package, not once per saved scene.
export function artillerySaveReplacer(campaign, replacer) {
  const definitions = campaign.contentCampaign?.package.artilleryProfiles,
    expected = definitions && canonicalContent(definitions);
  return (key, value) =>
    key === 'artilleryDefinitions' && expected && canonicalContent(value) === expected
      ? { definitionRef: 'artilleryProfiles' }
      : replacer(key, value);
}
export function restoreArtilleryReferences(campaign, value) {
  const definitions = campaign.contentCampaign?.package.artilleryProfiles;
  function visit(node) {
    if (!object(node) && !Array.isArray(node)) return;
    const ref = node.artilleryDefinitions;
    if (ref && Object.hasOwn(ref, 'definitionRef')) {
      if (
        !definitions ||
        Object.keys(ref).length !== 1 ||
        ref.definitionRef !== 'artilleryProfiles'
      )
        throw Error('La referencia de artillería guardada es inválida.');
      node.artilleryDefinitions = structuredClone(definitions);
    }
    for (const [key, child] of Object.entries(node))
      if (key !== 'contentCampaign' && key !== 'artilleryDefinitions') visit(child);
  }
  visit(value);
}
