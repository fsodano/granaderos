import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
export interface SurplusEquipmentEvent {stage:'surplus-equipment-sales';event:'equipmentTradingUnavailable';sector:string;sales:never[];treasury:number;target:number;shortfall:number}
import assert from 'node:assert/strict';

// Keep the old route call signature while callers move to actual port meetings.
// Recovered weapons remain physical equipment and cannot fund wages.
export function sellSurplusEquipment(
  start:CampaignSnapshot,
  sector:string,
  carrierIds:readonly number[],
  target:number,
  { report = () => {}, reserve = 5 }: {report?:(event:SurplusEquipmentEvent)=>void;reserve?:number} = {},
) {
  assert.ok(
    Number.isSafeInteger(target) && target >= 0 && Number.isSafeInteger(reserve) && reserve >= 0,
  );
  assert.ok(Array.isArray(carrierIds));
  const campaign = structuredClone(start);
  report({
    stage: 'surplus-equipment-sales',
    event: 'equipmentTradingUnavailable',
    sector,
    sales: [],
    treasury: campaign.resources.treasury,
    target,
    shortfall: Math.max(0, target - campaign.resources.treasury),
  });
  return campaign;
}
