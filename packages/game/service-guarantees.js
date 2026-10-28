// Optional authored escrow. This is a campaign rule, not an insurance product.
const now=s=>s.hour*3600+(s.secondOfHour??0);
const need=ok=>{if(!ok)throw Error('Las garantías de servicio guardadas son inválidas.');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const treasuryCap=1000000000;
const headroom=state=>Math.max(0,treasuryCap-state.resources.treasury);
export function guaranteeAmount(operative){return operative?.serviceGuarantee??0;}
export function guaranteeRecord(state,reference){return reference?.guaranteeId?state.serviceGuarantees?.entries?.[reference.guaranteeId]??null:null;}
export function treasuryRefundReason(state,amount){return amount>headroom(state)?`La tesorería no tiene espacio para devolver ${amount} pesos. Gastá fondos y volvé a intentarlo.`:null;}
export function guaranteeDepartureReason(state,reference,operative){return treasuryRefundReason(state,serviceGuaranteeRefund(state,reference,operative));}
export function pendingGuaranteeRefunds(state){
 if(state.serviceGuarantees?.version!==2)return [];
 return Object.entries(state.serviceGuarantees.entries).sort(([a],[b])=>Number(a.slice(10))-Number(b.slice(10))).filter(([,entry])=>entry.state==='departed'&&entry.creditedRefund<entry.refund).map(([id,entry])=>({id,operativeId:entry.operativeId,refund:entry.refund,creditedRefund:entry.creditedRefund,pendingRefund:entry.refund-entry.creditedRefund}));
}
// A v1 terminal receipt was fully credited when it settled. Upgrade only
// during an admitted new settlement; restoration itself never pays or upgrades.
function upgradeCredits(state){
 const ledger=state.serviceGuarantees;if(ledger.version===2)return;
 need(ledger.version===1);ledger.version=2;
 for(const entry of Object.values(ledger.entries))if(entry.state!=='held')Object.assign(entry,{creditedRefund:entry.refund,creditedAt:entry.settledAt,creditedSecond:entry.settledSecond});
}
export function creditPendingGuaranteeRefunds(state){
 const credits=[];
 for(const pending of pendingGuaranteeRefunds(state)){
  const amount=Math.min(headroom(state),pending.pendingRefund);if(!amount)break;
  const entry=state.serviceGuarantees.entries[pending.id];entry.creditedRefund+=amount;entry.creditedAt=state.hour;entry.creditedSecond=state.secondOfHour??0;state.resources.treasury+=amount;
  credits.push({...pending,amount,creditedRefund:entry.creditedRefund,pendingRefund:entry.refund-entry.creditedRefund});
 }
 return credits;
}
export function fundServiceGuarantee(state,operative,amount){
 if(!amount)return {};
 need(integer(amount,1,1000000)&&amount===guaranteeAmount(operative));
 const ledger=state.serviceGuarantees??={version:1,nextId:1,entries:{}},id=`guarantee-${ledger.nextId++}`;
 ledger.entries[id]={operativeId:operative.id,amount,fundedAt:state.hour,fundedSecond:state.secondOfHour??0,state:'held'};
 return {guaranteeId:id};
}
export function serviceGuaranteeRefund(state,reference,operative){
 const entry=guaranteeRecord(state,reference),record=state.operativeState?.[operative?.id];
 if(!entry||entry.state!=='held'||!record?.alive)return 0;
 const hp=Math.max(0,Math.min(operative.maxHp,record.hp));
 return Math.floor(entry.amount*hp/operative.maxHp);
}
export function settleServiceGuarantee(state,reference,operative,kind='departed',fullCredit=false){
 const entry=guaranteeRecord(state,reference);if(!entry||entry.state!=='held')return null;
 need(entry.operativeId===operative.id&&['departed','cancelled','forfeited'].includes(kind));
 const record=state.operativeState[operative.id],dead=!record.alive||record.hp===0;
 if(dead)kind='forfeited';
 const refund=kind==='cancelled'?entry.amount:kind==='forfeited'?0:serviceGuaranteeRefund(state,reference,operative);
 const reason=kind==='cancelled'||fullCredit?treasuryRefundReason(state,refund):null;if(reason)throw Error(reason);
 upgradeCredits(state);
 // Automatic departures enter the owed ledger before the one admitted
 // end-of-command collector. Manual refunds are paid in full immediately.
 const creditedRefund=kind==='departed'&&!fullCredit?0:refund;
 Object.assign(entry,{state:kind,settledAt:state.hour,settledSecond:state.secondOfHour??0,refund,creditedRefund,creditedAt:state.hour,creditedSecond:state.secondOfHour??0,...(kind==='cancelled'?{}:{hp:dead?0:Math.min(operative.maxHp,record.hp),maxHp:operative.maxHp})});
 state.resources.treasury+=creditedRefund;return {id:reference.guaranteeId,...entry};
}
// Death acknowledgements can precede service removal. Keep the terminal ID on
// the dead contract until its ordinary departure, without ever paying twice.
export function forfeitDeadServiceGuarantees(state,roster){
 for(const [id,entry] of Object.entries(state.serviceGuarantees?.entries??{})){
  const record=state.operativeState[entry.operativeId];
  if(entry.state==='held'&&record?.alive===false)settleServiceGuarantee(state,{guaranteeId:id},roster.find(o=>o.id===entry.operativeId),'forfeited');
 }
}
export function validateServiceGuarantees(state,roster){
 const refs=[];
 for(const [id,contract]of Object.entries(state.contracts??{}))if(contract.guaranteeId!==undefined)refs.push({id:contract.guaranteeId,owner:Number(id),kind:'contract',record:contract});
 for(const arrival of state.hiringArrivals??[])if(arrival.guaranteeId!==undefined)refs.push({id:arrival.guaranteeId,owner:arrival.operativeId,kind:'arrival',record:arrival});
 for(const [id,record]of Object.entries(state.operativeState??{}))if(record.capturedContract?.guaranteeId!==undefined)refs.push({id:record.capturedContract.guaranteeId,owner:Number(id),kind:'captured',record:record.capturedContract});
 for(const operative of roster){
  if(!guaranteeAmount(operative))continue;
  const references=[state.contracts?.[operative.id],...(state.hiringArrivals??[]).filter(a=>a.operativeId===operative.id),state.operativeState?.[operative.id]?.capturedContract].filter(Boolean);
  need(references.every(ref=>typeof ref.guaranteeId==='string'));
 }
 const ledger=state.serviceGuarantees;
 if(ledger===undefined){need(refs.length===0);return;}
 need(object(ledger)&&Object.keys(ledger).length===3&&[1,2].includes(ledger.version)&&object(ledger.entries)&&integer(ledger.nextId,2,1000001));
 const entries=Object.entries(ledger.entries);need(entries.length===ledger.nextId-1);
 for(let n=1;n<ledger.nextId;n++)need(Object.hasOwn(ledger.entries,`guarantee-${n}`));
 for(const [id,entry]of entries){
  need(object(entry));const operative=roster.find(o=>o.id===entry.operativeId),record=state.operativeState[entry.operativeId],matching=refs.filter(r=>r.id===id),funded=entry.fundedAt*3600+entry.fundedSecond;
  need(operative&&record&&operative.service!=='permanent'&&integer(entry.amount,1,1000000)&&entry.amount===guaranteeAmount(operative)&&integer(entry.fundedAt,0,state.hour)&&integer(entry.fundedSecond,0,3599)&&funded<=now(state));
  need(matching.every(r=>r.owner===entry.operativeId&&r.record.kind!=='patriot'&&r.record.permanent!==true)&&matching.length<=1);
  const base=['operativeId','amount','fundedAt','fundedSecond','state'];
  if(entry.state==='held'){
   need(Object.keys(entry).length===base.length&&base.every(k=>Object.hasOwn(entry,k))&&record.alive&&matching.length===1);
  }else{
   const keys=[...base,'settledAt','settledSecond','refund',...(entry.state==='cancelled'?[]:['hp','maxHp']),...(ledger.version===2?['creditedRefund','creditedAt','creditedSecond']:[])];
   need(['departed','cancelled','forfeited'].includes(entry.state)&&Object.keys(entry).length===keys.length&&keys.every(k=>Object.hasOwn(entry,k))&&integer(entry.settledAt,entry.fundedAt,state.hour)&&integer(entry.settledSecond,0,3599));
   const settled=entry.settledAt*3600+entry.settledSecond;need(settled>=funded&&settled<=now(state)&&integer(entry.refund,0,entry.amount));
   if(ledger.version===2){
    const credited=entry.creditedAt*3600+entry.creditedSecond;
    need(integer(entry.creditedRefund,0,entry.refund)&&integer(entry.creditedAt,entry.settledAt,state.hour)&&integer(entry.creditedSecond,0,3599)&&credited>=settled&&credited<=now(state));
    need(entry.state==='departed'||entry.creditedRefund===entry.refund);
    if(entry.creditedRefund===0)need(credited===settled);
   }
   if(entry.state==='cancelled')need(entry.refund===entry.amount&&matching.length===0);
   else {
    need(integer(entry.maxHp,1,operative.maxHp)&&integer(entry.hp,0,entry.maxHp)&&entry.refund===(entry.state==='forfeited'?0:Math.floor(entry.amount*entry.hp/entry.maxHp)));
    if(entry.state==='forfeited')need(entry.hp===0&&!record.alive&&matching.every(r=>r.kind==='contract'));
    else need(entry.hp>0&&matching.length===0);
   }
  }
  for(const ref of matching){
   if(ref.kind==='arrival')need(ref.record.bookedAt*3600+(ref.record.bookedSecond??0)===funded);
   else need(ref.record.kind==='paid'&&ref.record.started*3600+(ref.record.startedSecond??0)>=funded);
  }
 }
 need(refs.every(ref=>typeof ref.id==='string'&&Object.hasOwn(ledger.entries,ref.id)));
}
