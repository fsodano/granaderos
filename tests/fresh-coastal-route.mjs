import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';

// Continue from the real mountain campaign. Travel and renewal retain their cost.
export function prepareFreshCoastalCommand(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 order({type:'renewContract',id:118,term:'day',expectedExpiresAt:c.contracts[118].expiresAt});
 assert.ok(c.resources.treasury<before.resources.treasury);
 order({type:'travel',sector:'retiro',mode:'posta'});
 assert.equal(c.location,'retiro');assert.ok(c.hour>before.hour);
 c=meetRecruits(c,['cabral'],57);
 assert.ok(c.recruited.includes(3));assert.equal(c.conversations.cabral.lastApproach,'recruit');
 assert.ok(c.operativeState[57].alive);assert.equal(c.completed,false);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function prepareFreshEnsenadaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<1400&&c.resources.treasury<16000;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(let i=0;i<3;i++){for(let h=0;h<25&&!c.merchants.retiro.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});}
for(let i=0;i<24&&c.hour%24!==14;i++)order({type:'wait',hours:1});
for(const id of [105,118,138])order({type:'recruitCivic',id,term:'day'});
order({type:'squad',ids:[2,57,3,105,118,138]});
for(const operativeId of [2,57,3])order({type:'equip',operativeId,slot:'weapon',itemId:1801});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'buenos_aires',mode:'posta'});order({type:'attack',sector:'ensenada'});
 assert.equal(c.pendingBattle.squad.length,6);
 return c;
}

export function recruitFreshNavalCommand(start){
 let funded=structuredClone(start);
 for(const offer of ['supplies','materials']){funded=dispatchCampaign(funded,{type:'contraband',offer});assert.equal(funded.lastError,null);}
 assert.ok(funded.reputation.foreign>=30);assert.equal(funded.shipments.length,start.shipments.length+2);
 const c=meetRecruits(funded,['brown','bouchard'],57);
 assert.ok(c.recruited.includes(5)&&c.recruited.includes(6));
 assert.ok(c.operativeState[57].alive);assert.equal(c.defeated,false);
 for(const id of [3,118])assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSantaFeAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const id of [105,138])order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
order({type:'travel',sector:'retiro',mode:'posta'});
order({type:'purchaseMedicalSupplies',operativeId:2,quantity:15});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:operativeId===2?'doctor':operativeId===57?'patient':'rest'});
for(let i=0;i<24&&c.operativeState[57].hp<c.operativeState[57].maxHp;i++)order({type:'wait',hours:1});assert.equal(c.operativeState[57].hp,c.operativeState[57].maxHp);
for(const operativeId of [5,6])if(rosterFor(c).find(o=>o.id===operativeId).weapon!==1801){for(let h=0;h<25&&!c.merchants.retiro.stock['1801'];h++){for(const id of [105,138])if(c.contracts[id].expiresAt-c.hour<=1)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});order({type:'wait',hours:1});}order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
for(const id of [105,138])order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'purchaseAmmunition',ammoType:'musket_69',quantity:60});
order({type:'travel',sector:'san_nicolas',mode:'posta'});
 order({type:'attack',sector:'santa_fe',queue:true,mode:'posta'});
 for(let i=0;i<20&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';i++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'santa_fe'});
 assert.equal(c.pendingBattle.squad.length,6);assert.ok(c.hour%24>=6&&c.hour%24<20);
 return c;
}
