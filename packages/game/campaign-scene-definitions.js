import {campaignDefinitions,campaignSectors} from './campaign-definition.js';
import {canonicalContent} from './content-identity.js';
import {validateCampaignBuildingStyles} from './campaign-building-styles.js';

// Tactical simulation needs only the admitted locality list for militia exits.
// The complete world stays in the campaign package rather than every scene.
export function validateCampaignSceneDefinitions(campaign,scene){
 if(!scene)return;
 validateCampaignBuildingStyles(campaign,scene);
 const expected=campaignSectors(campaign).map(s=>s.id);
 // Legacy scenes use the shared default geography without storing a duplicate
 // list. Only a pinned world needs its locality list restored into the scene.
 if(scene.localityIds===undefined){
  if(!campaignDefinitions(campaign)?.world)return;
  scene.localityIds=[...expected];
 }
 if(canonicalContent(scene.localityIds)!==canonicalContent(expected))throw Error('Las localidades tácticas no corresponden a la campaña.');
}
