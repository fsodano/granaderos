import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sectorDeploymentAction} from '../game/sector-deployment.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {arsenalRearServicePlan,withdrawArsenalRear} from './arsenal-medical-reserve.mjs';

// Fresh declared subsystem input, not an earned route or arsenal victory.
// These existing civic recruits have real fees, terms, supplies and arrival.
function attackArena(){
 let c=secureArea(initialCampaign(8),'buenos_aires');
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 for(const id of [100,116,101,130,102])order({type:'recruitCivic',id,term:'day',destination:'buenos_aires'});
 order({type:'createSquad',name:'Servicio y médico de campo',ids:[100,116,101,130,102],sector:'buenos_aires'});
 order({type:'configureArtillery',types:[]});order({type:'attack',sector:'ensenada',mode:'march'});
 assert.equal(c.pendingBattle.sector,'ensenada');return c;
}
const physicalKeys=['hp','maxHp','bleeding','medkits','inventory','loaded','ammo','ammoStock','condition','weaponMetadata','weaponInstanceId','weaponDropped'];

test('the default rear plan still withdraws both protected physicians without changing the actual paid input',()=>{
 const c=attackArena(),before=structuredClone(c),field=[100,116,101,130,102];
 const plan=arsenalRearServicePlan(c,field,[],{paidCount:2});
 assert.deepEqual(plan.physicians,[116,130]);assert.deepEqual(plan.reserveIds,[116,130]);assert.deepEqual(plan.paidReserveIds,[116,130]);
 assert.deepEqual(plan.withdrawalIds,plan.reserveIds);assert.deepEqual(plan.fieldPhysicianIds,[]);assert.deepEqual(plan.remainingField,[100,101,102]);
 assert.deepEqual(c,before);
});

test('one supplied qualified physician stays admitted while the other pays a real exit with full official deployment replay',()=>{
 const campaign=attackArena(),beforeCampaign=structuredClone(campaign),field=[100,116,101,130,102];
 const defaultPlan=arsenalRearServicePlan(campaign,field,[],{paidCount:2}),plan=arsenalRearServicePlan(campaign,field,[],{paidCount:2,fieldPhysicians:1});
 assert.deepEqual(plan.reserveIds,defaultPlan.reserveIds);assert.deepEqual(plan.paidReserveIds,defaultPlan.paidReserveIds);assert.deepEqual(plan.physicians,defaultPlan.physicians);
 const physician=plan.fieldPhysicianIds[0],person=campaign.operativeState[physician],roster=rosterFor(campaign);
 assert.equal(plan.fieldPhysicianIds.length,1);assert.equal(physician,plan.physicians[0]);assert.ok(roster.find(op=>op.id===physician).medical>=60);
 assert.equal(person.assignment,'active');assert.ok(person.hp>=15&&person.medkits>0&&!person.asleep&&person.energy>0);assert.ok(campaign.pendingBattle.squad.some(op=>op.id===physician));
 assert.ok(plan.remainingField.includes(physician)&&plan.remainingField.length>=3);assert.ok(!plan.withdrawalIds.includes(physician));assert.equal(plan.withdrawalIds.length,1);
 const request=campaign.pendingBattle,initial=enterSector(request),start=enterSector(request,null,{placement:true}),before=structuredClone(start),orders=[];
 const after=withdrawArsenalRear(initial,plan.withdrawalIds,{onOrder:action=>orders.push(action)})(start);
 assert.equal(after.status,'active');assert.equal(after.deploymentComplete,true);assert.equal(after.elapsedSeconds,3);
 assert.deepEqual(orders.filter(action=>action.type==='exit').map(action=>action.unitIds[0]),plan.withdrawalIds.map(String));
 const doctor=after.units.find(unit=>unit.id===String(physician)),old=initial.units.find(unit=>unit.id===String(physician));
 assert.equal(doctor.departure,undefined);assert.deepEqual([doctor.x,doctor.y,doctor.tacticalLevel],[old.x,old.y,old.tacticalLevel]);
 for(const id of field){const actual=after.units.find(unit=>unit.id===String(id)),prior=initial.units.find(unit=>unit.id===String(id));for(const key of physicalKeys)assert.deepEqual(actual[key],prior[key],`${id}: ${key}`);}
 for(const id of plan.withdrawalIds)assert.equal(after.units.find(unit=>unit.id===String(id)).departure?.destination,'buenos_aires');
 let replay={campaign,battle:enterSector(request,null,{placement:true})};
 for(const [index,action]of orders.entries()){
  const battle=action.type==='exit'?actBattle(replay.battle,action):sectorDeploymentAction(replay.battle,action);assert.equal(battle.lastError,null);
  replay=syncBattleTime(replay.campaign,battle);assert.equal(replay.error,null);
  if(index===Math.floor(orders.length/2))replay=decodeSave(encodeSave(replay.campaign,replay.battle));
 }
 const actual=syncBattleTime(campaign,after);assert.equal(actual.error,null);assert.deepEqual({campaign:replay.campaign,battle:replay.battle},{campaign:actual.campaign,battle:actual.battle});
 assert.deepEqual(decodeSave(encodeSave(actual.campaign,actual.battle)),{campaign:actual.campaign,battle:actual.battle});assert.deepEqual(start,before);assert.deepEqual(campaign,beforeCampaign);
});

test('invalid field physician counts refuse without changing the campaign, terms or finite supplies',()=>{
 const c=attackArena(),before=structuredClone(c),field=[100,116,101,130,102];
 for(const fieldPhysicians of [-1,2,.5,'1',null])assert.throws(()=>arsenalRearServicePlan(c,field,[],{paidCount:2,fieldPhysicians}),/zero or one/);
 assert.deepEqual(c,before);
});
