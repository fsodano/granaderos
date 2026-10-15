import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {stabilizeCreatedCuyoBattleSurvivors,recoverCreatedCuyoLocalPatients} from './created-cuyo-route.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {visit,leave} from './local-contract-fixture.mjs';

const saved=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const person=(b,id)=>b.units.find(u=>u.id===String(id));
const clock=c=>c.hour*3600+(c.secondOfHour??0);

test('ordered acute field aid treats a critical patient before a bleeding physician self-care and preserves finite gear through full Native replay',()=>{
 const battle=createBattle([
  {id:'physician',x:3,y:3,hp:60,maxHp:80,bleeding:2,medical:90,medkits:1,activeSlot:'medical',weapon:1800,loaded:1,ammo:2},
  {id:'critical',x:4,y:3,hp:6,maxHp:85,bleeding:3,medical:90,medkits:1,weapon:1800,loaded:1,ammo:2},
 ],{id:'declared-cuyo-acute-order',width:8,height:8,exploration:true,hour:12,seed:83,enemies:[],tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}))});
 const before=structuredClone(battle),old=autoBandageBattle(battle);
 assert.equal(old.steps[0].targetId,'physician','The broad self-care queue is the regression premise.');
 assert.ok(person(old.battle,'critical').hp<15,'Broad bandaging leaves the actual critical patient below the required stable threshold.');
 const actions=[],result=stabilizeCreatedCuyoBattleSurvivors({battle},{execute:(pair,action)=>{
  const direct=actBattle(pair.battle,action);assert.equal(direct.lastError,null);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,direct);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(direct))),direct);
  actions.push(structuredClone(action));return {battle:direct};
 }});
 assert.equal(actions[0].type,'useItem');assert.equal(actions[0].targetId,'critical');
 assert.ok(person(result.battle,'critical').hp>=15);assert.equal(person(result.battle,'critical').bleeding,0);
 assert.ok(person(result.battle,'physician').hp>0);assert.equal(person(result.battle,'physician').bleeding,0);
 const strokes=actions.filter(a=>a.type==='useItem').length;
 assert.equal(result.battle.units.reduce((sum,u)=>sum+u.medkits,0),battle.units.reduce((sum,u)=>sum+u.medkits,0)-strokes);
 assert.ok(result.battle.elapsedSeconds>battle.elapsedSeconds);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
 for(const action of actions)replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,action))));
 assert.deepEqual(replay,result.battle);assert.deepEqual(battle,before);
 for(const id of ['physician','critical'])for(const key of ['maxHp','weapon','loaded','ammo','inventory','weaponInstanceId','condition'])assert.deepEqual(person(result.battle,id)[key],person(battle,id)[key]);
});

test('a wounded field physician earns full health from a different paid local doctor before the complete rear can be ready',()=>{
 let c=initialCampaign(42);
 for(const id of [116,130,100])c=order(c,{type:'recruitCivic',id,term:'day'});
 c=order(c,{type:'wait',hours:6});assert.ok([116,130,100].every(id=>c.recruited.includes(id)));
 c=supplyRouteDressings(c,116,4);
 // Fresh declared wounds on actual paid personnel. No failed route/save input,
 // supplies, health recovery, contract or clock grant supplies this control.
 const declared=structuredClone(c);Object.assign(declared.operativeState[130],{hp:declared.operativeState[130].maxHp-5,bleeding:0,bandaged:5});
 Object.assign(declared.operativeState[100],{hp:declared.operativeState[100].maxHp-7,bleeding:0,bandaged:7});
 const start=saved(declared),before=structuredClone(start),events=[],ids=[116,130,100];
 const campaign=recoverCreatedCuyoLocalPatients(start,ids,{report:event=>events.push(event)});
 const care=events.filter(e=>e.event==='createdCuyoLocalCare');assert.ok(care.length);
 assert.ok(care.some(e=>e.patients.includes(130)&&!e.doctors.includes(130)),'The field physician receives care from another living doctor.');
 for(const id of ids){const r=campaign.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.alive,true);assert.ok(campaign.recruited.includes(id));assert.equal(r.assignment,'active');}
 assert.ok(clock(campaign)>clock(start));assert.ok(clock(campaign)-clock(start)>=care.reduce((sum,e)=>sum+e.seconds,0),'Actual finite inventory orders may also charge Native time.');
 const kits=state=>state.recruited.reduce((sum,id)=>sum+state.operativeState[id].medkits,0);
 assert.ok(kits(campaign)<kits(start),'Hourly care consumes actual finite carried dressings.');
 assert.equal(campaign.resources.treasury,start.resources.treasury);assert.deepEqual(campaign.contracts,start.contracts);
 for(const id of start.recruited)for(const key of ['maxHp','inventory','ammo','ammoStock','carriedLoaded','weaponMetadata','weaponInstanceId','primaryWeapon','bladeWeapon','location'])assert.deepEqual(campaign.operativeState[id][key],start.operativeState[id][key],`${id}.${key}`);
 let replay=saved(start);
 for(const event of events.filter(e=>['freshRouteOrder','freshRouteRenewal'].includes(e.event)))replay=order(replay,event.action);
 assert.deepEqual(saved(replay),campaign);assert.deepEqual(saved(campaign),campaign);assert.deepEqual(start,before);
});


test('one finite dressing funds one actual care hour without being swapped between optional doctors',()=>{
 let c=initialCampaign(42);
 for(const id of [116,130,100])c=order(c,{type:'recruitCivic',id,term:'day'});
 c=order(c,{type:'wait',hours:6});assert.ok([116,130,100].every(id=>c.recruited.includes(id)));
 c=order(c,{type:'createSquad',name:'Clínica finita',ids:[116,130,100],sector:'retiro'});
 const reconnaissance=visit(c),cleared=actBattle(reconnaissance.battle,{type:'explore'});assert.equal(cleared.lastError,null);
 c=leave({...reconnaissance,battle:cleared});
 // Fresh declared scarcity removes carried stock; it adds no dressing,
 // personnel, recovery, clock or contract and uses no route checkpoint.
 assert.ok(c.operativeState[130].medkits>=1);
 const declared=structuredClone(c);
 for(const id of declared.recruited)declared.operativeState[id].medkits=0;
 declared.operativeState[130].medkits=1;
 Object.assign(declared.operativeState[130],{hp:declared.operativeState[130].maxHp-2,bleeding:0,bandaged:2});
 Object.assign(declared.operativeState[100],{hp:declared.operativeState[100].maxHp-3,bleeding:0,bandaged:3});
 const start=saved(declared),before=structuredClone(start),events=[];
 assert.equal(start.recruited.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),1);
 for(const id of [116,130]){
  assert.ok(rosterFor(start).find(op=>op.id===id).medical>=20);
  const inventory=sectorInventoryModel(start,'retiro',rosterFor(start),id);assert.equal(inventory.reason,null);
  assert.equal(inventory.entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0),0);
 }
 assert.throws(()=>recoverCreatedCuyoLocalPatients(start,[130,100],{maxHours:1,report:event=>events.push(event)}),/Actual local care must finish within its existing bounded clock/);
 const hours=events.filter(e=>e.event==='createdCuyoLocalCare'&&e.seconds>0);assert.equal(hours.length,1,JSON.stringify(hours.map(({seconds,healed,doctors})=>({seconds,healed,doctors}))));
 const hour=hours[0];assert.equal(hour.doctors.length,1);assert.ok(hour.healed>0);assert.equal(hour.seconds,3600);
 assert.equal(hour.campaign.operativeState[hour.doctors[0]].medkits,0,'The single actual dressing is consumed by treatment.');
 assert.equal(hour.campaign.recruited.reduce((sum,id)=>sum+hour.campaign.operativeState[id].medkits,0),0);
 assert.ok([130,100].some(id=>hour.campaign.operativeState[id].hp<hour.campaign.operativeState[id].maxHp),'Finite partial care does not claim complete recovery.');
 const actions=events.filter(e=>['freshRouteOrder','freshRouteRenewal'].includes(e.event)).map(e=>e.action);
 const doctorOrders=actions.filter(a=>a.type==='assignCare'&&a.assignment==='doctor');assert.equal(doctorOrders.length,1);
 let replay=saved(start);for(const action of actions)replay=order(replay,action);
 assert.deepEqual(saved(replay),hour.campaign);assert.deepEqual(start,before);
});
