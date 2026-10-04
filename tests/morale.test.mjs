import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {initialCampaign as freshCampaign,dispatchCampaign as dispatch,restoreCampaign,serializeCampaign,rosterFor,deploymentCost} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {baseMorale,cohesionBonus,advanceMorale,payMoraleRewardEligible} from '../game/morale.js';
import {enterSector} from '../game/world.js';
import {createBattle,shotChance} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatch(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const battle=s=>order(order(s,{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});
const report=(s,options={})=>order(s,scriptedBattleReport(s,{outcome:options.outcome??'victory',units:options.survivors??[]}));
const visit=s=>{s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);return order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});};
const save=s=>restoreCampaign(serializeCampaign(s));
const now=s=>s.hour*3600+(s.secondOfHour??0);
const advanceTo=(s,target)=>{for(let i=0;i<100&&now(s)<target;i++)s=order(s,{type:'advanceStrategicTime',seconds:Math.min(3600,target-now(s))});assert.equal(now(s),target);return s;};
const rewardClock=r=>[r.lastMoralePayAt,r.lastMoralePaySecond??0];
const renew=(s,id=103)=>{
 const op=rosterFor(s).find(o=>o.id===id),quote=contractQuote(s,op,'day'),action={type:'renewContract',id,term:'day'};
 const next=order(s,action);assert.deepEqual(next,order(save(s),action),'saved input must produce the same paid renewal');
 assert.equal(next.resources.treasury,s.resources.treasury-quote.price);assert.equal(contractExpiresSeconds(next.contracts[id]),quote.expiresAt*3600+(quote.expiresSecond??0));
 assert.equal(now(next),now(s));assert.equal(next.seed,s.seed);
 const before=structuredClone(s.operativeState[id]),after=structuredClone(next.operativeState[id]);
 for(const key of ['morale','lastMoralePayAt','lastMoralePaySecond']){delete before[key];delete after[key];}
 assert.deepEqual(after,before,'renewal cannot alter health, ammunition, equipment, practice, or assignment');
 assert.deepEqual(next.armoryItems,s.armoryItems);assert.deepEqual(next.loadouts,s.loadouts);assert.deepEqual(next.sectorStates,s.sectorStates);
 assert.deepEqual(save(next),next);return next;
};

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

test('fractional morale keeps its exact capped bonus and survives repeated saved deployments',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:120});
 const personal=30.850000000000005;s.operativeState[3].morale=personal;
 for(let i=0;i<3;i++){
  s=order(s,{type:'visitSector'});const issued=s.pendingBattle.squad.find(u=>u.id===3);
  assert.equal(issued.cohesionBonus,5);assert.equal(issued.morale,personal+5);
  s=restoreCampaign(serializeCampaign(s));const b=enterSector(s.pendingBattle);
  s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
  assert.equal(s.operativeState[3].morale,personal,'an unchanged visit must not change personal morale');
 }
});

test('old fractional deployment bonuses migrate only their rounding error and still reject values above the cap',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:120});s.operativeState[3].morale=30.850000000000005;s=order(s,{type:'visitSector'});
 const issued=s.pendingBattle.squad.find(u=>u.id===3);issued.cohesionBonus=issued.morale-issued.personalMorale;assert.ok(issued.cohesionBonus>5);
 const before=structuredClone(s),restored=restoreCampaign(serializeCampaign(s));assert.deepEqual(s,before);
 const migrated=restored.pendingBattle.squad.find(u=>u.id===3);assert.equal(migrated.cohesionBonus,5);assert.equal(migrated.morale,issued.morale);assert.equal(migrated.personalMorale,issued.personalMorale);
 for(const bonus of [5.000001,5.01,6]){
  const invalid=structuredClone(s),unit=invalid.pendingBattle.squad.find(u=>u.id===3);unit.cohesionBonus=bonus;unit.morale=unit.personalMorale+bonus;
  assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/compañerismo/);
 }
 const inconsistent=structuredClone(s);inconsistent.pendingBattle.squad.find(u=>u.id===3).morale+=1;
 assert.throws(()=>restoreCampaign(serializeCampaign(inconsistent)),/compañerismo/);
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

test('whole-hour renewal morale remains paid and bounded to once per day',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'week'});s.operativeState[100].morale=50;const money=s.resources.treasury;s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,52);assert.ok(s.resources.treasury<money);s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,52);
 assert.deepEqual(rewardClock(s.operativeState[100]),[0,0]);assert.equal(Object.hasOwn(s.operativeState[100],'lastMoralePaySecond'),false);
 s=order(save(s),{type:'wait',hours:24});s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.operativeState[100].morale,54);assert.deepEqual(rewardClock(s.operativeState[100]),[24,0]);
});

test('real fractional renewals reward exactly at 86400 seconds and keep early paid extensions separate',()=>{
 let s=order(freshCampaign(42),{type:'recruitCivic',id:103,term:'week'});assert.equal(s.operativeState[103].morale,80);assert.equal(s.reputation.foreign,20);
 const first=25199;s=renew(save(advanceTo(s,first)));assert.equal(s.operativeState[103].morale,82);assert.equal(s.reputation.foreign,25);assert.deepEqual(rewardClock(s.operativeState[103]),[6,3599]);
 for(const time of [first,108000,first+86399]){
  s=save(advanceTo(s,time));assert.equal(payMoraleRewardEligible(s,103),false);const expiry=contractExpiresSeconds(s.contracts[103]);s=renew(s);
  assert.equal(contractExpiresSeconds(s.contracts[103]),expiry+86400);assert.equal(s.operativeState[103].morale,82);assert.equal(s.reputation.foreign,25);assert.deepEqual(rewardClock(s.operativeState[103]),[6,3599]);
 }
 for(const [time,morale,standing] of [[first+86400,84,30],[first+172800,86,35]]){
  s=save(advanceTo(s,time));assert.equal(payMoraleRewardEligible(s,103),true);s=renew(s);
  assert.equal(s.operativeState[103].morale,morale);assert.equal(s.reputation.foreign,standing);assert.deepEqual(rewardClock(s.operativeState[103]),[Math.floor(time/3600),3599]);
 }
});

test('capped morale still records the exact reward time and whole-hour payment removes old seconds',()=>{
 let s=order(freshCampaign(42),{type:'recruitCivic',id:103,term:'week'});s.operativeState[103].morale=99;
 s=renew(advanceTo(s,25199));assert.equal(s.operativeState[103].morale,100);assert.equal(s.reputation.foreign,25);assert.deepEqual(rewardClock(s.operativeState[103]),[6,3599]);
 s=renew(advanceTo(s,31*3600));assert.equal(s.operativeState[103].morale,100);assert.equal(s.reputation.foreign,30);assert.equal(s.operativeState[103].lastMoralePayAt,31);assert.equal(Object.hasOwn(s.operativeState[103],'lastMoralePaySecond'),false);
 const legacy=save(s);assert.equal(payMoraleRewardEligible(advanceTo(legacy,55*3600-1),103),false);assert.equal(payMoraleRewardEligible(advanceTo(legacy,55*3600),103),true);
});

test('insufficient funds and a named refusal reject renewal without resetting the exact reward clock',()=>{
 let s=order(freshCampaign(42),{type:'recruitCivic',id:103,term:'week'});s=renew(advanceTo(s,17));s=save(advanceTo(s,17+86400));s.resources.treasury=0;s=save(s);
 const poor=dispatch(s,{type:'renewContract',id:103,term:'day'});assert.ok(poor.lastError);assert.deepEqual({...poor,lastError:null},s);assert.equal(payMoraleRewardEligible(poor,103),true);
 s=order(freshCampaign(42),{type:'recruitCivic',id:107,term:'week'});s=renew(advanceTo(s,17),107);s=order(s,{type:'recruitCivic',id:112,term:'week'});s=save(advanceTo(s,17+86400));
 const refused=dispatch(s,{type:'renewContract',id:107,term:'day'});assert.match(refused.lastError,/Gaspar Villalba/);assert.deepEqual({...refused,lastError:null},s);assert.deepEqual(rewardClock(refused.operativeState[107]),[0,17]);
 s=order(refused,{type:'dismiss',id:112});const morale=s.operativeState[107].morale,standing=s.reputation.foreign;assert.equal(rosterFor(s).find(o=>o.id===107).foreign,false);s=renew(s,107);assert.equal(s.operativeState[107].morale,morale+2);assert.equal(s.reputation.foreign,standing);assert.deepEqual(rewardClock(s.operativeState[107]),[24,17]);
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
 let paid=order(freshCampaign(42),{type:'recruitCivic',id:103,term:'week'});paid=renew(advanceTo(paid,17));
 for(const change of [r=>r.lastMoralePaySecond=null,r=>r.lastMoralePaySecond='17',r=>r.lastMoralePaySecond=-1,r=>r.lastMoralePaySecond=3600,r=>r.lastMoralePaySecond=1.5,r=>r.lastMoralePaySecond=18,r=>r.lastMoralePayAt=null,r=>delete r.lastMoralePayAt]){
  const invalid=structuredClone(paid);change(invalid.operativeState[103]);assert.throws(()=>save(invalid),/pago de moral/);
 }
 for(const seconds of [undefined,0]){const legacy=structuredClone(paid);if(seconds===undefined)delete legacy.operativeState[103].lastMoralePaySecond;else legacy.operativeState[103].lastMoralePaySecond=seconds;assert.deepEqual(save(legacy),legacy);}
});
