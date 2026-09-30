import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,restoreCampaign,serializeCampaign,rosterFor,deploymentCost} from '../game/campaign.js';
import {baseMorale,cohesionBonus,advanceMorale} from '../game/morale.js';
import {enterSector} from '../game/world.js';
import {createBattle,shotChance} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatch(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const battle=s=>order(order(s,{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});
const report=(s,options={})=>order(s,scriptedBattleReport(s,{outcome:options.outcome??'victory',units:options.survivors??[]}));
const visit=s=>{s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);return order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});};

test('persistent morale starts from existing temperament and steadfast traits',()=>{
 assert.equal(baseMorale({}),80);assert.equal(baseMorale({personality:'optimistic'}),90);assert.equal(baseMorale({personality:'pessimistic'}),70);assert.equal(baseMorale({personality:'optimistic',traits:['steadfast']}),100);
 const s=initialCampaign();for(const op of rosterFor(s))assert.equal(s.operativeState[op.id].morale,baseMorale(op));assert.deepEqual(s.cohesion,{});
});

test('battle morale returns with the outcome and stale reports cannot award it twice',()=>{
 let s=battle(initialCampaign());const request=s.pendingBattle;
 s=report(s,{survivors:request.squad.map(u=>({...u,morale:40}))});assert.equal(s.operativeState[3].morale,46);
 const failed=dispatch(s,{type:'battleResult',battleId:request.id,outcome:'victory',survivors:[]});assert.ok(failed.lastError);assert.equal(failed.operativeState[3].morale,46);
 for(const [outcome,expected] of [['retreat',35],['defeat',30]]){let state=battle(initialCampaign());state=report(state,{outcome,survivors:state.pendingBattle.squad.map(u=>({...u,morale:40}))});assert.equal(state.operativeState[3].morale,expected);}
});

test('shared service gives a bounded deployment bonus without increasing personal morale',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:120});assert.equal(cohesionBonus(s,3),5);assert.equal(s.cohesion['3:4'],120);const personal=s.operativeState[3].morale;
 s=order(s,{type:'visitSector'});const issued=s.pendingBattle.squad.find(u=>u.id===3);assert.equal(issued.personalMorale,personal);assert.equal(issued.cohesionBonus,5);assert.equal(issued.morale,personal+5);
 const b=enterSector(s.pendingBattle);s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 for(let i=0;i<3;i++)s=visit(s);assert.equal(s.operativeState[3].morale,personal);assert.equal(s.cohesion['3:4'],120);
});

test('a deployment removes only the bonus actually added below the morale cap',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:120});s.operativeState[3].morale=98;s=order(s,{type:'visitSector'});const issued=s.pendingBattle.squad.find(u=>u.id===3);assert.equal(issued.morale,100);assert.equal(issued.cohesionBonus,2);const b=enterSector(s.pendingBattle);s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.operativeState[3].morale,98);
});

test('losing a companion lowers morale and a long-serving companion causes a larger loss',()=>{
 const casualty=s=>{s=battle(s);return report(s,{survivors:s.pendingBattle.squad.map(u=>({...u,hp:u.id===4?0:u.hp}))});};
 const fresh=casualty(initialCampaign()),veteran=casualty(order(initialCampaign(),{type:'wait',hours:120}));assert.equal(fresh.operativeState[3].morale,80);assert.equal(veteran.operativeState[3].morale,77);assert.equal(veteran.operativeState[4].alive,false);
 let s=initialCampaign();s.operativeState[4].hp=1;s.operativeState[4].bleeding=4;s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].morale,74);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].morale,74);
});

test('a casualty in an exploration report also affects the returning squad once',()=>{
 let s=order(initialCampaign(),{type:'visitSector'});const b=enterSector(s.pendingBattle),dead=b.units.find(u=>u.id==='4');Object.assign(dead,{hp:0,unconscious:false,bleeding:0,ap:0});refreshMilitaryCondition(dead);s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.operativeState[3].morale,74);s=visit(s);assert.equal(s.operativeState[3].morale,74);
});

test('safe rest and patient recovery restore morale slowly only toward the personal baseline',()=>{
 let s=initialCampaign();s.operativeState[3].morale=20;s=order(s,{type:'assignCare',operativeId:3,assignment:'rest'});s=order(s,{type:'wait',hours:5});assert.equal(s.operativeState[3].morale,20);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[3].morale,21);
 s.operativeState[3].morale=79;s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[3].morale,80);s.operativeState[3].morale=90;s=order(s,{type:'wait',hours:12});assert.equal(s.operativeState[3].morale,90);
 s=initialCampaign();s.operativeState[3].morale=20;s=order(s,{type:'assignCare',operativeId:3,assignment:'patient'});s=order(s,{type:'wait',hours:6});assert.equal(s.hour,0);assert.equal(s.operativeState[3].morale,20);assert.ok(s.assignmentAttention.notice.events.some(e=>e.operativeId===3&&e.code==='healing_complete'));
 s=order(s,{type:'wait',hours:6});assert.equal(s.hour,6);assert.equal(s.operativeState[3].morale,21);
});

test('active duty, travel and deployed time do not grant recovery or shared camp hours',()=>{
 let s=initialCampaign();s.operativeState[3].morale=20;s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[3].morale,20);const hours=s.cohesion['3:4'];s=order(s,{type:'travel',sector:'ensenada'});assert.equal(s.cohesion['3:4'],hours);
 s=order(s,{type:'visitSector'});s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:3600});assert.equal(s.operativeState[3].morale,20);assert.equal(s.cohesion['3:4'],hours);
});

test('cohesion requires the same living squad and increases actual tactical shot chances',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:120});s=order(s,{type:'createSquad',name:'Separados',ids:[4]});assert.equal(cohesionBonus(s,4),0);s=order(s,{type:'squad',ids:[3,4,10]});assert.equal(cohesionBonus(s,4),5);
 const make=morale=>{s.operativeState[4].morale=morale;const issued=order(s,{type:'visitSector'}).pendingBattle.squad.find(u=>u.id===4);return createBattle([{...issued,x:1,y:1}],{width:12,height:8,night:false,enemies:[{id:'target',x:7,y:1,overwatch:false}]});};
 const low=make(25),high=make(80);assert.ok(shotChance(high,high.units[0],high.units[1])>shotChance(low,low.units[0],low.units[1]));
});

test('renewal morale is paid, bounded to once per day, and absent after failed purchases',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'week'});s.operativeState[100].morale=50;const money=s.resources.treasury;s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,52);assert.ok(s.resources.treasury<money);s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,52);
 s=order(s,{type:'wait',hours:24});s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,54);s.resources.treasury=0;assert.equal(dispatch(s,{type:'renewContract',id:100,term:'week'}).operativeState[100].morale,54);
});

test('unpaid legacy payroll lowers morale and is not lost when a deployed soldier returns',()=>{
 let s=initialCampaign();s.hour=719;s.resources.treasury=deploymentCost(s);for(const place of Object.values(s.sectors))place.damageUntil=900;s=order(s,{type:'visitSector'});assert.equal(s.resources.treasury,0,'the final pesos bought the actual ammunition issue');const b=enterSector(s.pendingBattle);s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:3600});b.elapsedSeconds=3600;b.syncedSeconds=3600;assert.equal(s.operativeState[3].morale,70);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.operativeState[3].morale,70);
 let paid=initialCampaign();paid.hour=719;paid.resources.treasury=10000;paid=order(paid,{type:'wait',hours:1});assert.equal(paid.operativeState[3].morale,82);
});

test('morale and cohesion migrate and round-trip with strict caps and deterministic recovery',()=>{
 const old=initialCampaign();delete old.cohesion;for(const r of Object.values(old.operativeState))for(const key of ['morale','moraleRestHours','lastMoralePayAt'])delete r[key];const restored=restoreCampaign(serializeCampaign(old));assert.equal(restored.operativeState[3].morale,80);assert.deepEqual(restored.cohesion,{});
 let s=initialCampaign();s.operativeState[3].morale=25;s=order(s,{type:'assignCare',operativeId:3,assignment:'rest'});s=order(s,{type:'wait',hours:5});assert.deepEqual(order(s,{type:'wait',hours:24}),order(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:24}));
 for(const edit of [s=>s.operativeState[3].morale=101,s=>s.operativeState[3].morale=null,s=>s.operativeState[3].moraleRestHours=6,s=>s.operativeState[3].lastMoralePayAt=100,s=>s.cohesion={'3:4':121},s=>s.cohesion={'4:3':10},s=>s.cohesion={'3:9999':10}]){const bad=initialCampaign();edit(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 s=order(initialCampaign(),{type:'visitSector'});s.pendingBattle.squad[0].cohesionBonus=20;assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});
