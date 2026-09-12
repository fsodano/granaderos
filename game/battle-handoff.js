import {syncBattleTime} from './time.js';
import {enterSector} from './world.js';

// A timed-out encounter resumes its exact turn, AP, wounds and departure receipts.
export function battleFromRequest(request, campaign = null) {
  if (request.resumeSnapshot) return structuredClone(request.resumeSnapshot);
  const previous = (request.sceneId ? campaign?.sceneStates?.[request.sceneId] : campaign?.sectorStates?.[request.sector]) ?? null;
  return enterSector({...request, hour: request.hour ?? campaign?.hour ?? 8, secondOfHour: request.secondOfHour ?? campaign?.secondOfHour ?? 0}, previous);
}

// Immediate enemy initiative can advance the tactical clock before the UI opens.
// Publish campaign and battle together so the first autosave is loadable.
export function prepareCampaignBattle(campaign){
 if(!campaign?.pendingBattle)return {campaign,battle:null,error:'No hay un despliegue pendiente.'};
 const battle=battleFromRequest(campaign.pendingBattle,campaign);
 return syncBattleTime(campaign,battle);
}
