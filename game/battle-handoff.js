import {enterSector} from './world.js';

// A timed-out encounter resumes its exact turn, AP, wounds and departure receipts.
export function battleFromRequest(request, campaign = null) {
  if (request.resumeSnapshot) return structuredClone(request.resumeSnapshot);
  const previous = (request.sceneId ? campaign?.sceneStates?.[request.sceneId] : campaign?.sectorStates?.[request.sector]) ?? null;
  return enterSector({...request, hour: campaign?.hour ?? request.hour ?? 8, secondOfHour: campaign?.secondOfHour ?? 0}, previous);
}
