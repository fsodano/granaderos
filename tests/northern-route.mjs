import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';

// Continue the real opening result through ordinary recovery, contracts,
// finite sector equipment, and a new authored battle. Never synthesize victory.
export function prepareNorthernSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.flags.sanLorenzo,true);assert.equal(campaign.phase,2);assert.equal(campaign.location,'san_nicolas');
 const events=[],dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const doctor=112,doctors=[doctor,116],patients=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return r.alive&&!r.captured&&r.location===campaign.location&&r.hp<r.maxHp&&!doctors.includes(id);});
 assert.ok(patients.length,'the actual opening leaves wounded survivors needing care');
 const hireCash=campaign.resources.treasury;
 order({type:'recruitCivic',id:doctor,term:'week'});
 assert.ok(campaign.resources.treasury<hireCash);
 const beforeSupplies=campaign.operativeState[doctor].medkits;
 const supplies=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').sort((a,b)=>b.count-a.count)[0];
 assert.ok(supplies?.count>=12,'the actual opening leaves twelve discovered, reachable dressings');
 order({type:'sectorInventory',sector:'san_nicolas',operativeId:doctor,direction:'take',sourceKey:supplies.key,expected:supplies.expected,count:12});
 assert.equal(campaign.operativeState[doctor].medkits,beforeSupplies+12);
 const remaining=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),doctor).entries.find(row=>row.key===supplies.key)?.count??0;
 assert.equal(remaining,supplies.count-12);
 const recoveryStart=campaign.hour,medicalStart=doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<40;i++){
  assert.equal(campaign.pendingEncounter,null,'recovery must resolve a real encounter before continuing');
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 assert.ok(campaign.hour>recoveryStart);const usedDressings=medicalStart-doctors.reduce((sum,id)=>sum+campaign.operativeState[id].medkits,0);assert.ok(usedDressings>0);
 for(const operativeId of [...doctors,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;
 for(let i=0;campaign.hour<restUntil&&i<20;i++)order({type:'wait',hours:restUntil-campaign.hour});
 assert.equal(campaign.hour,restUntil);assert.equal(campaign.operativeState[doctor].energy,100);
 report({event:'recovered',hour:campaign.hour,doctor,usedDressings,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,morale:campaign.operativeState[id].morale}))});
 // Depart at midnight for a daylight approach, using real waits.
 const departure=campaign.hour+(24-campaign.hour%24)%24;
 for(let i=0;campaign.hour<departure&&i<48;i++)order({type:'wait',hours:departure-campaign.hour});assert.equal(campaign.hour,departure);
 // Short contracts are bought immediately before the march, at their real price.
 for(const id of [128,142,105])order({type:'recruitCivic',id,term:'day'});
 const ids=[1000,115,doctor,128,142,105];
 order({type:'squad',ids});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 assert.deepEqual(campaign.squad,ids);
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of ids){assert.ok(campaign.operativeState[id].hp>=15);assert.equal(campaign.operativeState[id].bleeding,0);}
 const saved=decodeSave(encodeSave(campaign)).campaign;assert.deepEqual(saved,campaign);
 return {campaign:saved,events,dead,recovery:{startHour:recoveryStart,endHour:campaign.hour,doctor,usedDressings,sourceKey:supplies.key,sourceRemaining:remaining}};
}

export function fightNorthernSector(start,sector,{report=()=>{},expectedOutcome='victory',controller}={}){
 const before=structuredClone(start),prepared=start.pendingBattle?structuredClone(start):finishReloadsBeforeMarch(start,{report});
 const preparationSeconds=(prepared.hour-start.hour)*3600+(prepared.secondOfHour??0)-(start.secondOfHour??0),campaign=start.pendingBattle?prepared:dispatchCampaign(prepared,{type:'attack',sector});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,before);assert.ok(campaign.pendingBattle,'the real march produces a tactical deployment');
 const request=campaign.pendingBattle;assert.equal(request.sector,sector);
 report({event:'battleStarted',sector,hour:campaign.hour,units:request.squad.map(u=>u.id)});
 const result=fight(request,campaign.sectorStates[sector],{controller});
 const summary={sector,preparationSeconds,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});
 assert.ok(['victory','defeat','retreat'].includes(expectedOutcome));
 assert.equal(result.battle.status,expectedOutcome,JSON.stringify(summary));
 const replay=fight(request,campaign.sectorStates[sector],{controller});assert.deepEqual(replay.battle,result.battle);
 const pair=syncBattleTime(campaign,result.battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 const returned=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(returned.lastError,null,returned.lastError);assert.equal(returned.sectors[sector].owner,expectedOutcome==='victory'?'patriot':expectedOutcome==='retreat'?campaign.sectors[sector].owner:'royalist');assert.equal(returned.pendingBattle,null);
 for(const u of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(returned.operativeState[Number(u.id)].alive,false);
 assert.deepEqual(decodeSave(encodeSave(returned)).campaign,returned);
 return {campaign:returned,summary};
}

export function prepareTucumanSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.location,'cordoba');assert.equal(campaign.sectors.cordoba.owner,'patriot');
 const events=[],doctor=122,patient=112,dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const waitHour=()=>{
  assert.equal(campaign.pendingEncounter,null,'resolve a real encounter before recovery can continue');
  for(const id of [128,142,105])if(campaign.contracts[id].expiresAt-campaign.hour<=2){
   assert.ok(campaign.recruited.includes(id));const previous=campaign.contracts[id].expiresAt,cash=campaign.resources.treasury;
   order({type:'renewContract',id,term:'day',expectedExpiresAt:previous});
   assert.ok(campaign.contracts[id].expiresAt>previous);assert.ok(campaign.resources.treasury<cash);
  }
  order({type:'wait',hours:1});
 };
 const startHour=campaign.hour,originalSquad=[...campaign.squad],cash=campaign.resources.treasury;
 order({type:'recruitCivic',id:doctor,term:'week'});assert.ok(campaign.resources.treasury<cash);assert.deepEqual(campaign.squad,originalSquad);
 const stock=campaign.merchants.cordoba.supplies.medkits,carried=campaign.operativeState[doctor].medkits;
 order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity:7});
 assert.equal(campaign.merchants.cordoba.supplies.medkits,stock-7);assert.equal(campaign.operativeState[doctor].medkits,carried+7);
 for(const operativeId of originalSquad)order({type:'assignCare',operativeId,assignment:operativeId===patient?'patient':'rest'});
 order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
 const medicalStart=campaign.operativeState[doctor].medkits;
 for(let i=0;campaign.operativeState[patient].hp<campaign.operativeState[patient].maxHp&&i<40;i++)waitHour();
 assert.equal(campaign.operativeState[patient].hp,campaign.operativeState[patient].maxHp);
 const usedDressings=medicalStart-campaign.operativeState[doctor].medkits;assert.equal(usedDressings,0,'this approach leaves the Córdoba squad uninjured');
 for(const operativeId of [doctor,patient])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;for(let i=0;campaign.hour<restUntil&&i<20;i++)waitHour();assert.equal(campaign.hour,restUntil);
 for(const operativeId of originalSquad){order({type:'assignCare',operativeId,assignment:'active'});assert.equal(campaign.operativeState[operativeId].hp,campaign.operativeState[operativeId].maxHp);assert.equal(campaign.operativeState[operativeId].bleeding,0);}
 for(const id of [128,142,105])if(campaign.contracts[id].expiresAt-campaign.hour<=12)order({type:'renewContract',id,term:'day',expectedExpiresAt:campaign.contracts[id].expiresAt});
 for(const id of [128,142,105])assert.ok(campaign.contracts[id].expiresAt>campaign.hour+12,'contracts cover the real march and battle');
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(campaign.squad,originalSquad);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour,endHour:campaign.hour,doctor,patient,usedDressings,boughtDressings:7,contracts:[128,142,105].map(id=>({id,expiresAt:campaign.contracts[id].expiresAt}))};
 report({event:'cordobaRecovery',...recovery});return {campaign,events,recovery};
}

export function prepareRescueSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 assert.equal(campaign.sectors.tucuman.owner,'royalist');assert.deepEqual(campaign.squad,[]);
 const captives=Object.entries(campaign.operativeState).filter(([,r])=>r.captured&&r.capturedSector==='tucuman').map(([id,record])=>({id:Number(id),record:structuredClone(record)}));assert.ok(captives.length);
 order({type:'selectSquad',id:'squad-2'});order({type:'assignCare',operativeId:123,assignment:'active'});
 order({type:'travel',sector:'cordoba'});assert.equal(campaign.location,'cordoba');assert.equal(campaign.pendingEncounter,null);
 const cash=campaign.resources.treasury;
 for(const id of [106,145,109,147])order({type:'recruitCivic',id,term:'day'});
 assert.ok(campaign.resources.treasury<cash);
 order({type:'squad',ids:[123,122,106,145,109,147]});
 for(const operativeId of campaign.squad)order({type:'assignCare',operativeId,assignment:'active'});
 for(const {id,record} of captives){assert.deepEqual(campaign.operativeState[id],record);assert.ok(!campaign.squad.includes(id));}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'rescuePrepared',hour:campaign.hour,squad:campaign.squad});return {campaign,events,captives};
}

export function stabilizeRescued(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const patients=[115,105],doctors=[106,109,145];
 assert.equal(campaign.sectors.tucuman.owner,'patriot');assert.equal(campaign.pendingEncounter,null);
 for(const id of patients){assert.equal(campaign.operativeState[id].captured,false);assert.ok(campaign.recruited.includes(id));}
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 const before=structuredClone(campaign),hour=campaign.hour;
 order({type:'wait',hours:1});assert.equal(campaign.hour,hour+1);
 const usedDressings=doctors.reduce((sum,id)=>sum+before.operativeState[id].medkits-campaign.operativeState[id].medkits,0);assert.equal(usedDressings,2);
 for(const id of patients){assert.equal(campaign.operativeState[id].alive,true);assert.equal(campaign.operativeState[id].bleeding,0);if(before.operativeState[id].bleeding)assert.equal(campaign.operativeState[id].hp,before.operativeState[id].hp);else assert.ok(campaign.operativeState[id].hp>before.operativeState[id].hp);}
 for(const id of [1000,128])assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'rescuedStable',hour:campaign.hour,usedDressings,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))});
 return {campaign,events};
}
