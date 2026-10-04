import assert from 'node:assert/strict';

// Keep the old route call signature while callers move to actual port meetings.
// Recovered weapons remain physical equipment and cannot fund wages.
export function sellSurplusEquipment(start,sector,carrierIds,target,{report=()=>{},reserve=5}={}){
 assert.ok(Number.isSafeInteger(target)&&target>=0&&Number.isSafeInteger(reserve)&&reserve>=0);
 assert.ok(Array.isArray(carrierIds));
 const campaign=structuredClone(start);
 report({stage:'surplus-equipment-sales',event:'equipmentTradingUnavailable',sector,sales:[],treasury:campaign.resources.treasury,target,shortfall:Math.max(0,target-campaign.resources.treasury)});
 return campaign;
}
