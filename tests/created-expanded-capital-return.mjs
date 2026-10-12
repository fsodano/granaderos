import assert from 'node:assert/strict';
import {rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {isContractOperative} from '../game/content-character-ids.js';
import {serviceRelationshipRefusal} from '../game/service-relationships.js';
import {serviceObjectionReason} from '../game/service-objections.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const healthy=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding;};

// This quotation does not release a returned-property marker or assume a hire.
// Blocked veterans remain blocked until ordinary local collection completes.
export function expandedCapitalReliefPlan(c,{fieldSize=12,commanderId=57,source='santa_fe',maxRestHours=600,logisticsHours=240,reserve=10000}={}){
 assert.ok(Number.isSafeInteger(fieldSize)&&fieldSize>=7&&fieldSize<=42,'The expanded field must fit seven six-person columns and retain a reserve squad.');
 assert.ok(Number.isSafeInteger(maxRestHours)&&maxRestHours>0&&maxRestHours<=600,'Keep the existing 600-hour native morale-rest bound.');
 assert.ok(Number.isSafeInteger(logisticsHours)&&logisticsHours>0&&logisticsHours<=720);
 assert.ok(Number.isSafeInteger(reserve)&&reserve>=0);
 assert.equal(c.pendingBattle,null,'Settle the actual river battle before quoting relief.');
 assert.equal(c.pendingEncounter,null);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId&&c.operativeState[id].location===source);
 assert.ok(keepers.includes(commanderId),'The actual living commander must return to reserve.');
 assert.ok(field.length>=6&&field.length<=fieldSize,'Retain every actual river survivor.');
 for(const id of keepers){const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'The original living returnees must still be serving.');}
 const roster=rosterFor(c),missing=fieldSize-field.length;
 const candidates=roster.filter(op=>{
  if(!isContractOperative(c,op)||c.recruited.includes(op.id)||!healthy(c,op.id))return false;
  const marker=c.operativeState[op.id].serviceEquipmentReturn,quote=contractQuote(c,op,'week');
  if(marker)return c.sectors[marker.sectorId]?.owner==='patriot'&&!serviceRelationshipRefusal(c,op)&&!serviceObjectionReason(c,op);
  return civicStatus(c,op.id).available&&quote.available;
 }).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,missing).map(op=>({
  id:op.id,marksmanship:op.marksmanship,location:c.operativeState[op.id].location,
  returnMarker:structuredClone(c.operativeState[op.id].serviceEquipmentReturn??null),
  day:contractQuote(c,op,'day'),week:contractQuote(c,op,'week')
 }));
 assert.equal(candidates.length,missing,'Every added fighter needs one actual healthy, publicly recoverable candidate.');
 const serviceWeeks=Math.ceil((maxRestHours+logisticsHours)/168)+1;
 const retainedWeekly=keepers.reduce((sum,id)=>sum+contractQuote(c,roster.find(op=>op.id===id),'week').price,0);
 const candidateWeekly=candidates.reduce((sum,row)=>sum+row.week.price,0),guarantees=candidates.reduce((sum,row)=>sum+row.week.guarantee,0);
 return {fieldSize,commanderId,source,keepers,field,candidates,maxRestHours,logisticsHours,serviceWeeks,reserve,
  requiredTreasury:reserve+serviceWeeks*(retainedWeekly+candidateWeekly)+guarantees,
  retainedWeekly,candidateWeekly,guarantees,fieldDressings:fieldSize*5,batterySize:3};
}
