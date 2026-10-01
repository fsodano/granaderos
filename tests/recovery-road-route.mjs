import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {depotSelection} from '../game/artillery-depots.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';

// Defend with a real relief column, withdraw the threatened rear guard, then
// recapture the supply road with both forces. Losses persist through local care.
export function restoreNorthernRoad(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){
    const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];
   }
  }
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 {
 const field=[9,11,1000,10,4,139];order({type:'squad',ids:field});
 let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,field).battle}));
 c=supplyRouteAmmunition(c,field,{target:12}).campaign;
 order({type:'purchaseEquipment',item:'swivel'});if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<24&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:['swivel']});order({type:'travel',sector:'tucuman',mode:'posta'});
 for(const operativeId of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='tucuman'))order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&!c.pendingEncounter;h++){for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){const contract=c.contracts[id];if(contract.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}order({type:'wait',hours:1});}
 assert.equal(c.pendingEncounter.sector,'tucuman');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 c=fightNorthernSector(c,'tucuman',{controller:coastalBatteryController(enterSector(c.pendingBattle,c.sectorStates.tucuman),{sharedArtillerySight:true}),report}).campaign;
 }
 {
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='tucuman');
 for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<48&&!c.pendingEncounter&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  const injured=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
  const doctors=rosterFor(c).filter(o=>field.includes(o.id)&&!injured.includes(o.id)&&o.medical>=20&&c.operativeState[o.id].energy>10&&!c.operativeState[o.id].asleep).sort((a,b)=>b.medical-a.medical).slice(0,injured.length);
  for(const doctor of doctors){
   if(!c.operativeState[doctor.id].medkits){const donor=field.find(id=>id!==doctor.id&&c.operativeState[id].medkits>0);if(donor!==undefined){order({type:'sectorInventory',sector:'tucuman',operativeId:donor,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(c,'tucuman',rosterFor(c),doctor.id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');order({type:'sectorInventory',sector:'tucuman',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});}else order({type:'purchaseMedicalSupplies',operativeId:doctor.id,quantity:1});}
   order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  }
  for(const id of injured)order({type:'assignCare',operativeId:id,assignment:'patient'});order({type:'wait',hours:1});
 }
 }
 assert.equal(c.pendingEncounter?.sector,'cordoba');
 {
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'retreat',destination:'san_nicolas'});assert.equal(c.sectors.cordoba.owner,'royalist');
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),groups=[];
 for(const at of ['tucuman','san_nicolas']){const ids=field.filter(id=>c.operativeState[id].location===at);for(let i=0;i<ids.length;i+=6){order({type:'createSquad',ids:ids.slice(i,i+6),sector:at,name:'Recuperación del camino'});groups.push(c.activeSquadId);for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});c=finishReloadsBeforeMarch(c);}}
 order({type:'configureArtillery',types:['swivel']});
 for(const id of groups){order({type:'selectSquad',id});order({type:'attack',sector:'cordoba',queue:true,mode:'posta'});}
 for(let h=0;h<36&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'cordoba'});
 c=fightNorthernSector(c,'cordoba',{controller:coastalBatteryController(enterSector(c.pendingBattle,c.sectorStates.cordoba),{sharedArtillerySight:true}),report}).campaign;
 }
 const recovered=recoverRecapturedRoad(c);c=recovered.campaign;
 report({event:'northernRoadRecovered',hour:c.hour,treasury:c.resources.treasury,careEvents:recovered.events});
 return returnNorthernOfficers(c);
}

export function returnNorthernOfficers(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?24:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+elapsed){
    const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];
   }
  }
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='cordoba'),groups=[];
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),sector:'cordoba',name:'Regreso del norte'});groups.push(c.activeSquadId);for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});}
 if(!c.routes.carts)order({type:'transport',mode:'carts'});
 const gun=c.sectorStates.cordoba.artillery.find(g=>g.side==='player');assert.ok(gun);if(gun.ammo<6)order({type:'supplyArtillery',sector:'cordoba',artilleryId:gun.id,count:6-gun.ammo});
 order({type:'transportArtillery',sector:'cordoba',artilleryId:gun.id,to:'tucuman',mode:'carts'});
 for(const id of groups){order({type:'selectSquad',id});order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});}
 for(let h=0;h<36&&groups.some(id=>c.squads.find(q=>q.id===id).journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'squad',ids:[9,11,10,139,4]});for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<72&&((c.artilleryTransfers??[]).length||c.resources.treasury<300);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});
 order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy'],9);field.push(1);

 assert.equal(c.location,'tucuman');assert.ok(c.squad.includes(1));
 return c;
}

export function prepareRestoredSalta(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){
    const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];
   }
  }
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='tucuman');
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),sector:'tucuman',name:'Columna de Salta'});for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
 const piece=c.artilleryDepots.tucuman.find(g=>g.type==='swivel');assert.ok(piece);order({type:'configureArtillery',types:[depotSelection(piece)]});
 c=prepareFinalAssault(c,{staging:'tucuman',target:'salta',fieldIds:field});
 return c;
}
