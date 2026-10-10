// Use the same native morale floor as the opening reserve rule. This selector
// reads readiness only; ordinary care and squad orders keep their authority.
export function northernFieldSurvivors(campaign,doctors,clinic){
 return [...new Set([1000,114,123,...campaign.recruited])].filter(id=>{
  const record=campaign.operativeState[id];
  return !doctors.includes(id)&&campaign.recruited.includes(id)&&record.alive&&!record.captured&&record.location===clinic&&record.morale>=40;
 });
}
