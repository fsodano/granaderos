import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign as legacyCampaign} from './legacy-campaign-fixture.mjs';
import {actBattle,createBattle} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {defaultContentPackage} from '../game/content-package.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {visit,tactical,leave,saved,sync} from './local-contract-fixture.mjs';

const CAP=1000000000,save=s=>restoreCampaign(serializeCampaign(s));
const order=(s,a)=>{const before=serializeCampaign(s),n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);assert.equal(serializeCampaign(s),before,'the source state is unchanged');assert.ok(save(n));return n;};
const reject=(s,a)=>{const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},s);assert.ok(save(n));return n;};

// The billion-peso balance is a declared save-boundary fixture. These tests do
// not claim that the opening campaign earns it. All payments use real orders.
test('local and frontier requisitions reject overflow before taking their cooldown or political effects',()=>{
 for(const [amount,action,cuyo]of [[200,{type:'diplomacy',kind:'requisition'},false],[160,{type:'policy',kind:'frontierRequisition'},true]]){
  let s=initialCampaign();if(cuyo){s.location='mendoza';s.squads[0].location='mendoza';s.sectors.mendoza.owner='patriot';s.flags.parliament=true;}
  s.resources.treasury=CAP-amount+1;s=save(s);assert.match(reject(s,action).lastError,/tesorería/);
  s.resources.treasury=CAP-amount;s=save(s);const n=order(s,action);assert.equal(n.resources.treasury,CAP);assert.equal(n.politics.requisitionAfter,336);if(cuyo)assert.equal(n.flags.parliament,false);
 }
});

test('native cash pickup and saved return keep the exact carried pesos until a paid source revisit can credit them once',()=>{
 let s=order(initialCampaign(8),{type:'createOfficer',name:'Isabel',answers:{origin:'workshop',doctrine:'line_marksman',crisis:'rescue'}});s.resources.treasury=CAP;s=save(s);
 let p=visit(s);p=tactical(p,{type:'loot',unitId:'1000',groundId:'cash:retiro'});p=saved(p);
 assert.equal(p.battle.units.find(u=>u.id==='1000').inventory['cash:retiro'].count,110);
 s=save(leave(p));assert.equal(s.resources.treasury,CAP);assert.equal(s.foundMoney.includes('retiro'),false);assert.equal(s.operativeState[1000].inventory['cash:retiro'].count,110);assert.equal(s.sectorStates.retiro.groundItems.find(g=>g.id==='cash:retiro').count,0);
 s=order(s,{type:'diplomacy',kind:'gift'});assert.equal(s.resources.treasury,CAP-80);s=save(leave(visit(s)));assert.equal(s.resources.treasury,CAP-80);assert.equal(s.operativeState[1000].inventory['cash:retiro'].count,110);
 s=order(s,{type:'diplomacy',kind:'gift'});s=save(leave(visit(s)));assert.equal(s.resources.treasury,CAP-50);assert.deepEqual(s.foundMoney,['retiro']);assert.equal(s.operativeState[1000].inventory['cash:retiro'],undefined);assert.equal(s.sectorStates.retiro.units.find(u=>u.id==='1000').inventory['cash:retiro'],undefined);
 s=save(leave(visit(s)));assert.equal(s.resources.treasury,CAP-50);assert.equal(s.sectorStates.retiro.groundItems.find(g=>g.id==='cash:retiro').count,0);
});

// A declared last-opponent encounter isolates native victory settlement. The
// last blow, paid clock, full report and save custody remain ordinary reducers.
function winReport(s,actorId='3'){
 const r=s.pendingBattle;
 let b=createBattle(r.squad.map((u,i)=>({...u,x:2+i*2,y:2})),{...r,width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),props:[],npcs:r.npcs.map((n,i)=>({...n,x:18-i,y:14})),enemies:r.enemies.map((u,i)=>({...u,x:2+i,y:3,hp:i?0:20,bleeding:0,bandaged:0,ap:0}))});
 b=actBattle(b,{type:'weapon',unitId:actorId,slot:'blade'});assert.equal(b.lastError,null);b=actBattle(b,{type:'melee',unitId:actorId,targetId:r.enemies[0].id});assert.equal(b.lastError,null);assert.equal(b.status,'victory');
 const p=saved(sync({campaign:s,battle:b}));const report={type:'battleResult',battleId:r.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};return {s:p.campaign,report};
}
function wonBoundary(room=0){let s=order(legacyCampaign(),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});s.resources.treasury=CAP-room;return winReport(save(s));}

test('verified victory at the cap finishes and saves its full unpaid entitlement; restore and replay cannot pay',()=>{
 const {s,report}=wonBoundary();let n=order(s,report);assert.equal(n.pendingBattle,null);assert.equal(n.sectors.san_nicolas.owner,'patriot');assert.equal(n.resources.treasury,CAP);assert.deepEqual(n.pendingVictoryRewards,[{battleId:report.battleId,sector:'san_nicolas',earnedAt:n.hour,earnedSecond:n.secondOfHour,amount:250,creditedAmount:0}]);
 const before=serializeCampaign(n);assert.equal(serializeCampaign(save(n)),before,'restoration never collects');reject(n,report);reject(n,{type:'renewContract',id:99999});
 for(const pending of [170,90,10]){n=order(save(n),{type:'diplomacy',kind:'gift'});assert.equal(n.resources.treasury,CAP);assert.equal(n.pendingVictoryRewards[0].amount-n.pendingVictoryRewards[0].creditedAmount,pending);}
 n=order(save(n),{type:'diplomacy',kind:'gift'});assert.equal(n.resources.treasury,CAP-70);assert.equal(n.pendingVictoryRewards,undefined);n=order(save(n),{type:'diplomacy',kind:'gift'});assert.equal(n.resources.treasury,CAP-150);reject(n,report);
});

test('victory pays exact headroom and normal rewards allocate no pending ledger',()=>{
 for(const room of [100,250,1000]){const {s,report}=wonBoundary(room),n=order(s,report);assert.equal(n.resources.treasury,CAP-room+Math.min(room,250));if(room<250)assert.equal(n.pendingVictoryRewards[0].creditedAmount,room);else assert.equal(n.pendingVictoryRewards,undefined);}
});

test('actual automatic service refund keeps priority over a later native victory reward',()=>{
 for(const room of [0,100]){
 const d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id==='person-110'),{serviceGuarantee:101,arrivalHours:0});
 let n=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel',answers:{origin:'workshop',doctrine:'line_marksman',crisis:'rescue'}});n=order(n,{type:'recruitCivic',id:110,term:'day'});n.resources.treasury=CAP;n=save(n);for(let i=0;n.contracts[110]&&i<5;i++)n=order(n,{type:'wait',hours:Math.max(1,24-n.hour)});assert.equal(n.contracts[110],undefined);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,0);
 n=order(n,{type:'attack',sector:'buenos_aires'});const p=winReport(n,'1000');p.s.resources.treasury=CAP-room;n=order(save(p.s),p.report);assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,room);assert.equal(n.pendingVictoryRewards[0].creditedAmount,0);assert.equal(n.resources.treasury,CAP);
 n=order(save(n),{type:'diplomacy',kind:'gift'});assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,Math.min(101,room+80));assert.equal(n.pendingVictoryRewards[0].creditedAmount,Math.max(0,room+80-101));assert.equal(n.resources.treasury,CAP);
 n=order(save(n),{type:'diplomacy',kind:'gift'});assert.equal(n.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.equal(n.pendingVictoryRewards[0].creditedAmount,room+59);assert.equal(n.resources.treasury,CAP);
 }
});

test('restoration rejects duplicate, future, unrelated and malformed unpaid victory receipts without changing input',()=>{
 const {s,report}=wonBoundary(),n=order(s,report);
 for(const mutate of [s=>s.pendingVictoryRewards.push(structuredClone(s.pendingVictoryRewards[0])),s=>s.pendingVictoryRewards=[],s=>s.pendingVictoryRewards[0].amount=251,s=>s.pendingVictoryRewards[0].creditedAmount=250,s=>s.pendingVictoryRewards[0].creditedAmount=-1,s=>s.pendingVictoryRewards[0].earnedAt=s.hour+1,s=>s.pendingVictoryRewards[0].earnedSecond=3600,s=>s.pendingVictoryRewards[0].sector='retiro',s=>s.pendingVictoryRewards[0].battleId='visit-san_nicolas-0-1',s=>s.pendingVictoryRewards[0].unpaid=250,s=>delete s.sectorStates.san_nicolas.pendingVictoryFunds,s=>s.sectorStates.san_nicolas.pendingVictoryFunds[0].amount=249,s=>delete s.pendingVictoryRewards]){
  const bad=structuredClone(n);mutate(bad);const before=structuredClone(bad);assert.throws(()=>save(bad),/victoria/);assert.deepEqual(bad,before);const rejected=dispatchCampaign(bad,{type:'diplomacy',kind:'gift'});assert.match(rejected.lastError,/victoria/);assert.deepEqual({...rejected,lastError:null},bad);
 }
 assert.equal(decodeSave(encodeSave(n)).campaign.pendingVictoryRewards[0].amount,250);
 const orphan=initialCampaign();orphan.pendingVictoryRewards=[{battleId:'san_nicolas-0-1',sector:'san_nicolas',earnedAt:0,earnedSecond:0,amount:250,creditedAmount:0}];assert.throws(()=>save(orphan),/victoria/);assert.match(dispatchCampaign(orphan,{type:'diplomacy',kind:'gift'}).lastError,/victoria/);
});

test('unpaid victory keeps its source witness through an ordinary saved revisit',()=>{
 const {s,report}=wonBoundary();let n=order(s,report);const debt=structuredClone(n.pendingVictoryRewards),proof=structuredClone(n.sectorStates.san_nicolas.pendingVictoryFunds);n=save(leave(visit(n)));assert.deepEqual(n.pendingVictoryRewards,debt);assert.deepEqual(n.sectorStates.san_nicolas.pendingVictoryFunds,proof);assert.notEqual(n.sectorStates.san_nicolas.battleId,report.battleId);assert.equal(n.resources.treasury,CAP);
});

test('a rural native victory keeps its exact unpaid funds through saved revisit and real later sector loss',()=>{
 for(const forge of [false,true]){
  // Declared pre-existing Mendoza command, followed by an actual paid assault.
  let n=legacyCampaign();n.location='mendoza';n.squads[0].location='mendoza';n.sectors.mendoza.owner='patriot';n=order(save(n),{type:'attack',sector:'uspallata'});n.resources.treasury=CAP;const won=winReport(save(n));n=order(won.s,won.report);assert.equal(n.cityLoyaltyEvents.some(e=>e.eventId===won.report.battleId),false,'rural victory grants no city loyalty event');
  const proof=structuredClone(n.sectorStates.uspallata.pendingVictoryFunds),debt=structuredClone(n.pendingVictoryRewards);const p=visit(n);if(forge)p.battle.pendingVictoryFunds=[{battleId:'uspallata-0-123',earnedAt:0,earnedSecond:0,amount:250}];n=save(leave(p));assert.deepEqual(n.pendingVictoryRewards,debt);assert.deepEqual(n.sectorStates.uspallata.pendingVictoryFunds,proof,'the canonical proof survives a raw caller replacement');
  const group=launchEnemyGroup(n,'interior','uspallata',{immediate:true});assert.ok(group);n=order(save(n),{type:'wait',hours:1});assert.equal(n.pendingEncounter.groupId,group.id);n=order(n,{type:'respondToEncounter',groupId:group.id,choice:'retreat',destination:'mendoza'});assert.equal(n.sectors.uspallata.owner,'royalist');assert.deepEqual(n.sectorStates.uspallata.pendingVictoryFunds,proof);assert.equal(n.pendingVictoryRewards[0].creditedAmount,150,'the real raid debit permits exactly150 owed pesos');assert.equal(n.resources.treasury,CAP);
  n=decodeSave(encodeSave(n)).campaign;n=order(n,{type:'diplomacy',kind:'gift'});assert.equal(n.pendingVictoryRewards[0].creditedAmount,230);n=order(n,{type:'diplomacy',kind:'gift'});assert.equal(n.pendingVictoryRewards,undefined);assert.equal(n.sectorStates.uspallata.pendingVictoryFunds,undefined);assert.equal(n.resources.treasury,CAP-60);assert.equal(n.sectors.uspallata.owner,'royalist');
 }
});
