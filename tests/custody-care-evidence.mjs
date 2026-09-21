import {detentionId} from '../game/capture-identity.js';
import assert from 'node:assert/strict';
// Prove changes during strategic custody came from finite recorded care.
export function assertCustodyCare(beforeCampaign,afterCampaign,id){
 const before=beforeCampaign.operativeState[id],after=afterCampaign.operativeState[id],key=detentionId(id,before);
 const oldCount=beforeCampaign.detentionRecords?.[key]?.care?.length??0,care=(afterCampaign.detentionRecords?.[key]?.care??[]).slice(oldCount);
 const charged=Object.entries(afterCampaign.detentionRecords??{}).reduce((sum,[key,entry])=>sum+(entry.care??[]).slice(beforeCampaign.detentionRecords?.[key]?.care?.length??0).filter(event=>event.sourceId===id).reduce((n,event)=>n+event.dressings,0),0);
 assert.equal(after.hp,before.hp+care.reduce((n,event)=>n+event.hpAfter-event.hpBefore,0));
 assert.equal(after.medkits,before.medkits-charged);assert.ok(after.hp<=Math.max(15,before.hp));
 assert.equal(after.bleeding,care.at(-1)?.bleedingAfter??before.bleeding);
 const unchanged=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!['hp','bleeding','bandaged','unconscious','recoveryHours','medkits'].includes(key)));
 assert.deepEqual(unchanged(after),unchanged(before));return care;
}
