import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

function restockDressings(c,order,operativeId,target){
 const quantity=Math.max(0,target-(c.operativeState[operativeId].medkits??0));
 if(quantity)order({type:'purchaseMedicalSupplies',operativeId,quantity});
}

// Normal funding, equipment, timed approaches and explicitly coordinated squads.
export function prepareFreshUspallataAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(7)).id});order({type:'assignCare',operativeId:7,assignment:'active'});order({type:'travel',sector:'mendoza',mode:'posta'});order({type:'diplomacy',kind:'parliament'});order({type:'fortify',sector:'mendoza'});
const locals=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
const physician=rosterFor(c).filter(op=>locals.includes(op.id)&&op.id!==7&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];
assert.ok(physician,'the mountain column needs a living local medic');
for(const operativeId of locals)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<600&&c.resources.treasury<12000;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
order({type:'produce',recipe:'powder',sector:'mendoza'});for(let i=0;i<24&&c.production.length;i++)order({type:'wait',hours:1});
for(const recipe of ['ammo_rifle_62','ammo_musket_75'])order({type:'produce',recipe,sector:'mendoza'});
for(let i=0;i<36&&(c.production.length||c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
const recruits=[105,128,109,132,145,106,147,143,118,138,135].filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!c.recruited.includes(id)&&r.hp===r.maxHp&&r.morale>=50;}).slice(0,6);
assert.equal(recruits.length,6,'six living and ready replacements must accept paid contracts');
for(const id of recruits)order({type:'recruitCivic',id,term:'day'});
for(const operativeId of recruits.filter(id=>![1800,1801,1802].includes(rosterFor(c).find(op=>op.id===id).weapon))){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
order({type:'squad',ids:[7,physician.id,...recruits.slice(0,4)]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo de la cordillera',ids:recruits.slice(4),sector:'mendoza'});const support=c.activeSquadId;
// Retain unused dressings from earlier care; buy only the field-stock shortfall.
restockDressings(c,order,physician.id,15);
order({type:'configureArtillery',types:['bronze4']});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
order({type:'beginAssault',sector:'uspallata'});
 assert.equal(c.pendingBattle.squad.length,8);return c;
}

// Stabilize the actual wounded, then buy care at the supplied Mendoza workshop.
export function recoverFreshUspallata(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const survivors=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='uspallata');
const patients=survivors.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
// A patient receives care from one doctor per hour. Retain the strongest
// needed doctors instead of paying idle elite contracts through recovery.
const doctors=rosterFor(c).filter(op=>survivors.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,patients.length).map(op=>op.id);
assert.ok(!patients.length||doctors.length,'surviving physicians must care for the actual wounded');
for(const operativeId of doctors.filter(id=>c.operativeState[id].medkits>0))order({type:'assignCare',operativeId,assignment:'doctor'});
for(let h=0;h<6&&patients.some(id=>c.operativeState[id].bleeding>0||c.operativeState[id].hp<15);h++)order({type:'wait',hours:1});
for(const id of survivors){assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15,'stabilize actual critical wounds before the return march');}
order({type:'fortify',sector:'uspallata'});order({type:'squad',ids:survivors.slice(0,6)});
const returning=[c.activeSquadId];
for(let offset=6;offset<survivors.length;offset+=6){order({type:'createSquad',name:'Regreso de Uspallata',ids:survivors.slice(offset,offset+6),sector:'uspallata'});returning.push(c.activeSquadId);}
for(const operativeId of survivors)order({type:'assignCare',operativeId,assignment:'active'});
for(const id of returning){order({type:'selectSquad',id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
for(let h=0;h<48&&returning.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const id of survivors)assert.equal(c.operativeState[id].location,'mendoza');
order({type:'selectSquad',id:returning[0]});
c=sellSurplusEquipment(c,'mendoza',survivors,10000,{reserve:0,report});
for(const operativeId of doctors){restockDressings(c,order,operativeId,1);order({type:'assignCare',operativeId,assignment:'doctor'});}
for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 for(const operativeId of doctors)if(!c.operativeState[operativeId].medkits)order({type:'purchaseMedicalSupplies',operativeId,quantity:1});
 for(const id of [...patients,...doctors]){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt-c.hour<=1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
 order({type:'wait',hours:1});
}
for(const id of survivors){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

// Bank ordinary income before signing new contracts; wait for finite shop stock.
export function prepareFreshLosPatosAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const physician=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return op.id!==7&&c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='mendoza'&&c.contracts[op.id]?.expiresAt===null&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical)[0];
assert.ok(physician,'retain a living local physician for the second mountain pass');
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<1200&&(c.resources.treasury<14000||c.hour%24<6||c.hour%24>10);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
const needsMusket=[147,118,138,135].filter(id=>rosterFor(c).find(op=>op.id===id).weapon!==1801||c.operativeState[id].weaponDropped);
const musketsToBuy=Math.max(0,needsMusket.length-(c.armory[1801]??0));
for(let i=0;i<musketsToBuy;i++){for(let h=0;h<25&&!c.merchants.mendoza.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});}
for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
for(let h=0;h<24&&c.hour%24!==0;h++)order({type:'wait',hours:1});
for(const id of [105,147,143,118,138,135])order({type:'recruitCivic',id,term:'day'});
for(const operativeId of needsMusket)order({type:'equip',operativeId,slot:'weapon',itemId:1801});
order({type:'squad',ids:[7,physician.id,105,147,143,118]});const main=c.activeSquadId;order({type:'createSquad',name:'Apoyo de Los Patos',ids:[138,135],sector:'mendoza'});const support=c.activeSquadId;
restockDressings(c,order,135,15);restockDressings(c,order,7,5);
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'uspallata',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'los_patos',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'los_patos'});
 assert.equal(c.pendingBattle.squad.length,8);
 assert.ok(c.pendingBattle.squad.every(u=>u.entryEdge==='E'));
 return c;
}

export function completeFreshAndesPreparation(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'fortify',sector:'los_patos'});assert.equal(c.phase,4);
const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos');
const returning=c.squads.filter(q=>q.members.some(id=>field.includes(id))).map(q=>q.id);
assert.ok(returning.length>0);
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
// Keep both surviving squads within the normal six-person limit and return
// concurrently, paying each route rather than merging eight people into one.
for(const id of returning){order({type:'selectSquad',id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
for(let hour=0;hour<80&&returning.some(id=>c.squads.find(q=>q.id===id)?.journey);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const id of field)assert.equal(c.operativeState[id].location,'mendoza');
const envoy=field.find(id=>c.operativeState[id].hp>=15);assert.notEqual(envoy,undefined,'a living returning soldier must meet San Martín');
const speakerSquad=c.squads.find(q=>q.members.includes(envoy));assert.ok(speakerSquad);
order({type:'selectSquad',id:speakerSquad.id});
c=meetRecruits(c,['san-martin'],envoy);assert.ok(c.recruited.includes(57));assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}
