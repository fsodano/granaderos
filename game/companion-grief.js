import {CRITICAL_HEALTH,isUnconscious} from './actor-condition.js';
import {preferredCompanions,PREFERRED_COMPANION_LIMIT} from './service-relationships.js';

// Explicit Granaderos tuning, separate from ordinary teammate/casualty losses.
export const COMPANION_GRIEF_MORALE=6;
const need=(ok)=>{if(!ok)throw Error('El duelo guardado no corresponde a los compañeros del despliegue.');};
const numericId=id=>Number.isSafeInteger(id)&&id>=0;
const unitId=unit=>numericId(Number(unit?.id))&&String(Number(unit.id))===String(unit.id)?Number(unit.id):null;
const entries=record=>record?.companionGrief??[];
const sameIds=(a,b)=>a===undefined&&b===undefined||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((id,i)=>id===b[i]);
const receiptFor=(record,id)=>entries(record).find(entry=>entry.companionId===id);
const capable=unit=>unit?.side==='player'&&unit.hp>=CRITICAL_HEALTH&&!isUnconscious(unit)&&!unit.unconscious&&!unit.asleep&&!unit.sleepCollapsed&&!unit.captured&&!unit.departure&&!unit.fled&&!unit.surrendered&&!unit.routed;

export function griefPreferenceIds(state,operative){return preferredCompanions(state,operative).map(preference=>preference.companionId);}
export function issueCompanionGrief(state,operative){
 const ids=griefPreferenceIds(state,operative);
 return ids.length?{griefCompanionIds:ids}:{};
}
export function initialGriefParticipants(units){return units.filter(unit=>unit.hp>0&&unitId(unit)!==null).map(unit=>unitId(unit));}
export function issueGriefParticipants(units){return units.some(unit=>Object.hasOwn(unit,'griefCompanionIds'))?{griefParticipantIds:initialGriefParticipants(units)}:{};}
// A successful local recruitment adds an actual newly issued body, never new
// support/preferences and never a grief context for an older neutral battle.
export function addIssuedGriefParticipant(snapshot,unit){
 if(snapshot.griefParticipantIds===undefined)return snapshot;
 const id=unitId(unit);need(id!==null&&unit.side==='player'&&unit.hp>0&&snapshot.units.includes(unit));
 if(!snapshot.griefParticipantIds.includes(id)){need(snapshot.griefParticipantIds.length<200);snapshot.griefParticipantIds=[...snapshot.griefParticipantIds,id];}
 return snapshot;
}
export function validateGriefParticipants(snapshot){
 if(Object.hasOwn(snapshot,'griefParticipantIds')){
  const ids=snapshot.griefParticipantIds;
  need(Array.isArray(ids)&&Object.keys(ids).length===ids.length&&ids.length<=200&&new Set(ids).size===ids.length&&[...ids].every(numericId));
 }
}

// The captured references are private to this one actual HP transition. They
// never enter a save or infer a reaction from a corpse discovered later.
export function captureCompanionGrief(state,casualty,canObserve){
 const id=unitId(casualty);
 if(id===null||casualty.side!=='player'||casualty.hp<=0||!state.units.includes(casualty)||!state.griefParticipantIds?.includes(id))return null;
 return {casualty,hp:casualty.hp,witnesses:state.units.filter(unit=>unit!==casualty&&state.griefParticipantIds.includes(unitId(unit))&&capable(unit)&&unit.griefCompanionIds?.includes(id)&&!receiptFor(unit,id)&&canObserve(unit,casualty))};
}
export function applyCompanionGrief(state,captured){
 if(!captured||captured.hp<=0||captured.casualty.hp!==0||!state.units.includes(captured.casualty))return [];
 const id=unitId(captured.casualty),reactions=[];
 for(const unit of captured.witnesses){
  if(!state.units.includes(unit)||receiptFor(unit,id))continue;
  const loss=Math.min(COMPANION_GRIEF_MORALE,Math.max(0,unit.morale));
  unit.morale=Math.max(0,unit.morale-loss);
  const receipt={companionId:id,loss};unit.companionGrief=[...entries(unit),receipt];
  reactions.push({unit,companion:captured.casualty,loss});
 }
 return reactions;
}

export function validateCompanionGrief(record){
 if(Object.hasOwn(record,'griefCompanionIds')){
  const ids=record.griefCompanionIds;
  need(Array.isArray(ids)&&Object.keys(ids).length===ids.length&&ids.length<=PREFERRED_COMPANION_LIMIT&&new Set(ids).size===ids.length&&[...ids].every(id=>numericId(id)&&id!==unitId(record)));
 }
 if(Object.hasOwn(record,'companionGrief')){
  const receipts=record.companionGrief;
  need(Array.isArray(receipts)&&Object.keys(receipts).length===receipts.length&&receipts.length<=PREFERRED_COMPANION_LIMIT);
  const seen=new Set();
  for(const receipt of receipts){
   need(receipt&&typeof receipt==='object'&&!Array.isArray(receipt)&&[Object.prototype,null].includes(Object.getPrototypeOf(receipt))&&Object.keys(receipt).length===2&&Object.hasOwn(receipt,'companionId')&&Object.hasOwn(receipt,'loss')&&numericId(receipt.companionId)&&receipt.companionId!==unitId(record)&&!seen.has(receipt.companionId)&&Number.isFinite(receipt.loss)&&receipt.loss>=0&&receipt.loss<=COMPANION_GRIEF_MORALE);
   seen.add(receipt.companionId);
  }
 }
 return record;
}
function retainsReceipts(previous,current){
 need(entries(previous).every(receipt=>{const next=receiptFor(current,receipt.companionId);return next&&next.loss===receipt.loss;}));
}
function pinnedActor(state,operative,actor){
 validateCompanionGrief(actor);const preferences=griefPreferenceIds(state,operative);
 if(actor.griefCompanionIds!==undefined)need(sameIds(actor.griefCompanionIds,preferences));
 need(entries(actor).every(receipt=>preferences.includes(receipt.companionId)));
}

export function validateCampaignCompanionGrief(state,roster){
 for(const operative of roster){
  const record=state.operativeState[operative.id];validateCompanionGrief(record);
  need(record.griefCompanionIds===undefined);
  const preferences=griefPreferenceIds(state,operative);
  need(entries(record).every(receipt=>preferences.includes(receipt.companionId)&&state.operativeState[receipt.companionId]?.alive===false&&state.operativeState[receipt.companionId]?.hp===0));
 }
 const request=state.pendingBattle;
 for(const issued of request?.squad??[]){
  const operative=roster.find(op=>op.id===Number(issued.id));need(operative);pinnedActor(state,operative,issued);
  const personal=state.operativeState[operative.id];retainsReceipts(personal,issued);
  for(const receipt of entries(issued).filter(receipt=>!receiptFor(personal,receipt.companionId))){
   const companion=[...request.squad,...(request.garrison??[]),...(request.missionAllies??[])].find(unit=>unitId(unit)===receipt.companionId);
   need(issued.griefCompanionIds?.includes(receipt.companionId)&&companion?.hp>0);
  }
 }
 for(const scene of [...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{})]){
  for(const actor of scene.units??[]){
   if(actor.side!=='player'||actor.militia)continue;
   const operative=roster.find(op=>op.id===unitId(actor));if(!operative)continue;
   pinnedActor(state,operative,actor);
   need(entries(actor).every(receipt=>receiptFor(state.operativeState[operative.id],receipt.companionId)?.loss===receipt.loss));
  }
 }
}

export function validateCompanionGriefContext(state,snapshot,roster,request=state.pendingBattle){
 need(request&&Array.isArray(snapshot.units));
 const participants=[...request.squad,...(request.garrison??[]),...(request.missionAllies??[])];
 validateGriefParticipants(snapshot);need(sameIds(snapshot.griefParticipantIds,issueGriefParticipants(participants).griefParticipantIds));
 for(const issued of request.squad){
  const actor=snapshot.units.find(unit=>unit.side==='player'&&String(unit.id)===String(issued.id)),operative=roster.find(op=>op.id===Number(issued.id));need(actor&&operative);
  pinnedActor(state,operative,actor);need(sameIds(actor.griefCompanionIds,issued.griefCompanionIds));retainsReceipts(issued,actor);
  retainsReceipts(request.resumeSnapshot?.units?.find(unit=>unit.side==='player'&&String(unit.id)===String(issued.id)),actor);
  for(const receipt of entries(actor).filter(receipt=>!receiptFor(issued,receipt.companionId))){
   const original=participants.find(unit=>unitId(unit)===receipt.companionId),dead=snapshot.units.find(unit=>unit.side==='player'&&unitId(unit)===receipt.companionId);
   need(issued.griefCompanionIds?.includes(receipt.companionId)&&original?.hp>0&&dead?.hp===0);
  }
  // Synced receipts are already retained on the issue, but their confirmed
  // dead bodies must still be present until this deployment's actual return.
  for(const receipt of entries(actor).filter(receipt=>!receiptFor(state.operativeState[operative.id],receipt.companionId))){
   need(issued.griefCompanionIds?.includes(receipt.companionId)&&participants.some(unit=>unitId(unit)===receipt.companionId&&unit.hp>0)&&snapshot.units.some(unit=>unit.side==='player'&&unitId(unit)===receipt.companionId&&unit.hp===0));
  }
 }
 for(const actor of snapshot.units.filter(unit=>unit.side==='player'&&!request.squad.some(issued=>String(issued.id)===String(unit.id)))){
  if(actor.griefCompanionIds===undefined&&actor.companionGrief===undefined)continue;
  const operative=roster.find(op=>op.id===unitId(actor));need(operative&&!actor.militia);pinnedActor(state,operative,actor);
  need(entries(actor).every(receipt=>receiptFor(state.operativeState[operative.id],receipt.companionId)?.loss===receipt.loss));
 }
}
export function retainCompanionGrief(request,snapshot){
 for(const issued of request.squad){const actual=snapshot.units.find(unit=>unit.side==='player'&&String(unit.id)===String(issued.id));if(actual?.companionGrief!==undefined)issued.companionGrief=structuredClone(actual.companionGrief);}
}
export function returnCompanionGrief(state,id,report){
 const personal=state.operativeState[id];retainsReceipts(personal,report);
 if(report.companionGrief!==undefined)personal.companionGrief=structuredClone(report.companionGrief);
}
