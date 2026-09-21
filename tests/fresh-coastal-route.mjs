import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';

// Continue from the real mountain campaign. Travel and renewal retain their cost.
export function prepareFreshCoastalCommand(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 order({type:'squad',ids:[2,7,8,57]});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
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
for(const id of [105,109,138,128,106,135])order({type:'recruitCivic',id,term:'day'});
order({type:'squad',ids:[7,8,2,57,3,105]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo del puerto',ids:[109,138,128,106,135],sector:'retiro'});const support=c.activeSquadId;
for(const operativeId of [2,57,3])order({type:'equip',operativeId,slot:'weapon',itemId:1801});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'buenos_aires',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'ensenada',queue:true,mode:'posta'});}
for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});for(let h=0;h<24&&c.hour%24!==6;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'ensenada'});
 assert.equal(c.pendingBattle.squad.length,11);
 return c;
}

export function recruitFreshNavalCommand(start){
 let funded=dispatchCampaign(start,{type:'selectSquad',id:start.squads.find(q=>q.members.includes(57)).id});assert.equal(funded.lastError,null);
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
order({type:'travel',sector:'retiro',mode:'posta'});order({type:'purchaseEquipment',item:'bronze4'});order({type:'configureArtillery',types:['bronze4']});order({type:'purchaseMedicalSupplies',operativeId:7,quantity:15});if(c.resources.ammo_musket_69<30)order({type:'purchaseAmmunition',ammoType:'musket_69',quantity:30-c.resources.ammo_musket_69});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<48&&(c.hour%24!==18||c.squad.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'san_nicolas',queue:true,mode:'posta'});for(let h=0;h<36&&c.squads.find(q=>q.id===c.activeSquadId).journey;h++)order({type:'wait',hours:1});
order({type:'attack',sector:'santa_fe',queue:true,mode:'posta'});for(let h=0;h<24&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'santa_fe'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[7,57,5]);
 return c;
}

// Stabilize the surviving command with carried supplies and paid patient contracts.
export function recoverFreshPort(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const operativeId of [8,135])order({type:'assignCare',operativeId,assignment:'doctor'});
for(const operativeId of [57,109])order({type:'assignCare',operativeId,assignment:'patient'});
for(const operativeId of [7,5,6,138,106])order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<72&&[57,109].some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 for(const id of [109,135])if(c.contracts[id].expiresAt-c.hour<=1)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
 order({type:'wait',hours:1});
}
for(const id of [57,109])assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}


// Rebuild paid support and lift the actual naval occupation before the northern road.
export function prepareFreshBlockadeAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const groups=c.squads.filter(q=>q.members.length).map(q=>q.id);
for(const id of groups){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'retiro',queue:true,mode:'posta'});}
for(let h=0;h<48&&groups.some(id=>c.squads.find(q=>q.id===id)?.journey);h++)order({type:'wait',hours:1});
assert.ok(groups.every(id=>c.squads.find(q=>q.id===id)?.location==='retiro'));
order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(57)).id});
for(const operativeId of c.recruited.filter(id=>c.operativeState[id].alive))order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<1200&&c.resources.treasury<16000;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const operativeId of [5,6]){for(let h=0;h<25&&!c.merchants.retiro.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
order({type:'purchaseEquipment',item:'bronze4'});order({type:'configureArtillery',types:['bronze4']});
for(let h=0;h<24&&c.hour%24!==14;h++)order({type:'wait',hours:1});
for(const id of [109,138,106,135])order({type:'recruitCivic',id,term:'day'});
order({type:'squad',ids:[7,8,57,5,6]});const main=c.activeSquadId;order({type:'createSquad',name:'Apoyo de Santa Fe',ids:[109,138,106,135],sector:'retiro'});const support=c.activeSquadId;
order({type:'purchaseMedicalSupplies',operativeId:135,quantity:15});order({type:'purchaseMedicalSupplies',operativeId:8,quantity:10});order({type:'purchaseAmmunition',ammoType:'musket_69',quantity:60});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'buenos_aires',queue:true,mode:'posta'});}
for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id)?.journey?.status==='ready');h++)order({type:'wait',hours:1});
for(let h=0;h<24&&c.hour%24!==6;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'buenos_aires'});
 assert.equal(c.pendingBattle.squad.length,9);
 return c;
}
