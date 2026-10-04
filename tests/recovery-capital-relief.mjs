import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {prepareSantaFePaidColumn} from './santa-fe-paid-column.mjs';
import {prepareCreatedCapitalReturn} from './created-capital-return.mjs';
import {collectReturnedServiceKit} from './returned-service-kit.mjs';
import {equipRecoveryCapitalProtection} from './recovery-capital-protection.mjs';

// Recover the actual wounded reserve, then fund a six-person battery at its
// current prices. The permanent command stays physically at Córdoba.
export function prepareRecoveryCapitalRelief(start,{report=()=>{}}={}){
 const returning=start.recruited.filter(id=>{const unit=start.operativeState[id];return unit.alive&&!unit.captured&&unit.location==='santa_fe';});
 let c=recoverFreshPort(start,{hospital:'cordoba',fieldIds:returning,report});
 let protectedIds=[102];
 const order=action=>{
  if(action.type==='wait')for(const id of protectedIds){const q=c.contracts[id];if(c.recruited.includes(id)&&q?.expiresAt!=null&&q.expiresAt<=c.hour+action.hours)order({type:'renewContract',id,term:'week',expectedExpiresAt:q.expiresAt});}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 const reserve=138;assert.ok(c.operativeState[reserve].alive&&!c.operativeState[reserve].captured);assert.equal(c.operativeState[reserve].location,'mendoza');assert.equal(c.operativeState[reserve].bleeding,0);
 order({type:'squad',ids:[57,102]});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 const careFunds=contractQuote(c,rosterFor(c).find(op=>op.id===reserve),'week').price+4000;
 for(let h=0;h<12000&&c.resources.treasury<careFunds;h+=24){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:24});c=collectReturnedServiceKit(c,'cordoba',[57,102],{report});}
 assert.ok(c.resources.treasury>=careFunds);const cash=c.resources.treasury,quote=contractQuote(c,rosterFor(c).find(op=>op.id===reserve),'week');order({type:'recruitCivic',id:reserve,term:'week',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);report({event:'recoveryCapitalPatientHired',id:reserve,price:quote.price,treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour});
 order({type:'createSquad',name:'Reserva de Córdoba',ids:[reserve],sector:'mendoza'});const group=c.activeSquadId;order({type:'assignCare',operativeId:reserve,assignment:'active'});order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});protectedIds.push(reserve);
 for(let h=0;h<48&&c.squads.find(q=>q.id===group).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[reserve].location,'cordoba');order({type:'squad',ids:[57,102,reserve]});const hp=c.operativeState[reserve].hp,doctorKits=c.operativeState[57].medkits,dressingPurchases=[];
 for(let h=0;h<120&&c.operativeState[reserve].hp<c.operativeState[reserve].maxHp;h++){
  assert.equal(c.pendingEncounter,null);if(!c.operativeState[57].medkits){const cash=c.resources.treasury;order({type:'purchaseMedicalSupplies',operativeId:57,quantity:1});dressingPurchases.push({id:57,quantity:1,price:cash-c.resources.treasury,hour:c.hour});}order({type:'assignCare',operativeId:57,assignment:'doctor'});order({type:'assignCare',operativeId:reserve,assignment:'patient'});order({type:'wait',hours:1});
 }
 assert.equal(c.operativeState[reserve].hp,c.operativeState[reserve].maxHp);const funds=c.resources.treasury;order({type:'dismiss',id:reserve});assert.equal(c.resources.treasury,funds);report({event:'recoveryCapitalPatientRecovered',id:reserve,doctorId:57,usedDressings:doctorKits+dressingPurchases.length-c.operativeState[57].medkits,dressingPurchases,releasedWithoutRefund:true,fromHP:hp,toHP:c.operativeState[reserve].hp,hour:c.hour,treasury:c.resources.treasury});
 c=prepareRecoveryCapitalBattery(c,{report});
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const[id,unit]of Object.entries(start.operativeState))if(!unit.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// The paid Retiro rear guard rests on his actual side of the occupied capital.
// Five Córdoba soldiers and that rear guard coordinate the same public assault.
export function prepareRecoveryCapitalBattery(start,{report=()=>{}}={}){
 let c=prepareSantaFePaidColumn(start,{count:6,extraRestIds:[135],restAtSourceIds:[135],reserve:65000,maxSavingHours:70000,report:e=>report({...e,event:e.event.replace('santaFe','recoveryCapital')})});
 const field=c.squad.filter(id=>id!==57);assert.equal(field.length,5);assert.equal(new Set([...field,135]).size,6);
 assert.equal(c.operativeState[135].location,'retiro');assert.ok(c.recruited.includes(135));
 c=equipRecoveryCapitalProtection(c,[...field,135],{report});
 c=prepareCreatedCapitalReturn(c,{fieldSize:6,preparedFieldIds:field,report});
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const[id,unit]of Object.entries(start.operativeState))if(!unit.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}
