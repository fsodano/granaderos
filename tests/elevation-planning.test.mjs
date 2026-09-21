import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
const AMMO='inventory:ammo:musket_75';
const ammoStack=count=>({item:AMMO,kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count,weight:.04});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,endTurn,stanceCost,canSee} from '../game/tactical.js';
import {chooseEnemyAction,choosePatrolAction} from '../game/tactical-ai.js';
import {chooseScavengingAction} from '../game/tactical-ai-scavenging.js';
import {chooseSupplySharingAction} from '../game/tactical-ai-sharing.js';
import {planGroupMove,executeGroupMove} from '../game/group-movement.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {discoverInventory} from '../game/inventory-discovery.js';
import {npcRoutes,advanceNpc} from '../game/npc-ai.js';
import {sameCell,spaceKey,surfaceAt,tacticalLevel} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const tiles=()=>Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
const roof=()=>Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
const link={id:'access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}};
function field(players=[{id:'p',x:3,y:4}],extra={}){return createBattle(players,{width:16,height:10,tiles:tiles(),upperSurfaces:roof(),climbLinks:[structuredClone(link)],seed:45,exploration:true,enemies:[],...extra});}
const act=(state,order)=>{const next=actBattle(state,order);assert.equal(next.lastError,null,JSON.stringify(order)+': '+next.lastError);return next;};
const replay=(state,orders)=>orders.reduce(act,state);

test('group roof routes keep access metadata and equal ordinary orders, AP, energy and time',()=>{
 const s=field([{id:'a',x:2,y:4},{id:'b',x:2,y:5}]),request={unitIds:['a','b'],anchorId:'a',x:6,y:4,tacticalLevel:1};
 s.units.forEach(u=>u.ap=3);const before=structuredClone(s),plan=planGroupMove(s,request);assert.equal(plan.ok,true);
 assert.deepEqual(s,before);assert.ok(plan.members.every(m=>m.destination.tacticalLevel===1&&m.path.some(step=>step.kind==='climb'&&step.linkId==='access'&&step.from.tacticalLevel===0)));
 const result=executeGroupMove(s,request);assert.equal(result.status,'completed');assert.equal(result.actions,2);assert.deepEqual(result.state,replay(s,result.orders));
 assert.ok(result.orders.every(o=>o.tacticalLevel===1));assert.equal(new Set(result.state.units.map(spaceKey)).size,2);
 assert.ok(result.state.units.every(u=>u.tacticalLevel===1&&u.ap===3&&u.energy<88));assert.ok(result.elapsedSeconds>=12);
 const down=executeGroupMove(result.state,{...request,x:2,y:4,tacticalLevel:0});assert.equal(down.status,'completed');assert.ok(down.orders.every(o=>o.tacticalLevel===0));assert.ok(down.state.units.every(u=>tacticalLevel(u)===0));
});
test('group routing does not fall back to another floor and respects blocked accesses and posture',()=>{
 for(const patch of [s=>s.climbLinks=[],s=>s.units[0].stance='prone',s=>s.units[0].mounted=true,s=>s.props.push({id:'block',type:'chest',x:4,y:4,tacticalLevel:1})]){
  const s=field();patch(s);const before=structuredClone(s),report=executeGroupMove(s,{unitIds:['p'],anchorId:'p',x:6,y:5,tacticalLevel:1});assert.equal(report.actions,0);assert.deepEqual(s,before);assert.equal(report.members[0].status,'blocked');
 }
 const s=field();for(const level of [2,null,-1,1.5])assert.equal(planGroupMove(s,{unitIds:['p'],anchorId:'p',x:6,y:5,tacticalLevel:level}).ok,false);
});
test('medic stands, climbs and pays ordinary medical orders before binding a roof casualty',()=>{
 const s=field([{id:'doc',x:3,y:4,stance:'crouched',medical:80,medkits:2},{id:'patient',x:5,y:5,tacticalLevel:1,hp:55,maxHp:100,bandaged:0,bleeding:1,medical:0,medkits:0}]);
 s.units[0].ap=2;const report=autoBandageBattle(s);assert.deepEqual(report.treatedIds,['patient']);assert.equal(report.stoppedReason,null);
 assert.deepEqual(report.steps[0],{type:'stance',unitId:'doc',stance:'standing'});assert.ok(report.steps.some(o=>o.type==='move'&&o.tacticalLevel===1));assert.deepEqual(report.battle,replay(s,report.steps));
 assert.equal(report.battle.units[0].tacticalLevel,1);assert.equal(report.battle.units[0].ap,2);assert.equal(report.battle.units[0].medkits,1);assert.equal(report.battle.units[0].energy,88);assert.ok(report.elapsedSeconds>=6);assert.equal(report.battle.units[1].bleeding,0);assert.ok(report.battle.units[1].hp<=55);
 const sealed=structuredClone(s);sealed.climbLinks=[];const refusal=autoBandageBattle(sealed);assert.equal(refusal.steps.length,0);assert.equal(refusal.battle.units[0].medkits,2);assert.equal(refusal.untreated.length,1);
});
test('stacked bodies do not reveal their packs from the other floor',()=>{
 const s=field([{id:'p',x:5,y:5}],{enemies:[{id:'body',x:5,y:5,tacticalLevel:1,hp:0,maxHp:80}]});delete s.units[1].knownToPlayer;discoverInventory(s);assert.notEqual(s.units[1].knownToPlayer,true);
 Object.assign(s.units[0],{x:5,y:4,tacticalLevel:1});discoverInventory(s);assert.equal(s.units[1].knownToPlayer,true);
});
test('AI never treats, transfers, loots or strikes through a floor, even in the same XY cell',()=>{
 const s=field([{id:'p',x:5,y:5,weapon:1800,loaded:0,ammo:0,medkits:2,medical:80,activeSlot:'medical'},{id:'ally',x:5,y:5,tacticalLevel:1,loaded:0,ammo:0,medical:0,medkits:0,hp:60,bleeding:2}],{enemies:[{id:'e',x:6,y:5,tacticalLevel:1,weapon:1809,patrol:false}]});
 s.climbLinks=[];s.units[0].ap=100;const action=chooseEnemyAction(s,s.units[0]);assert.notEqual(action?.type,'useItem');assert.notEqual(action?.type,'melee');
 setTestAmmunition(s.units[0],3);s.units[0].loaded=1;const share=chooseSupplySharingAction(s,s.units[0],[],()=>getReachable(s,s.units[0]));assert.equal(share,null);
 setTestAmmunition(s.units[0],0);s.units[0].loaded=0;s.units[0].activeSlot='primary';s.groundItems=[{id:'rounds',type:'item',...ammoStack(2),x:5,y:5,tacticalLevel:1}];
 assert.equal(chooseScavengingAction(s,s.units[0],[],()=>getReachable(s,s.units[0])),null);
});
test('a visible roof ammunition source requires a paid approach before pickup, with no item duplication',()=>{
 let s=field([{id:'p',x:3,y:4,weapon:1800,loaded:0,ammo:0,medkits:0}],{exploration:false,enemies:[{id:'e',x:15,y:9,patrol:false,overwatch:false}]});
 s.groundItems=[{id:'rounds',type:'item',...ammoStack(3),x:4,y:5,tacticalLevel:1}];s.units[0].ap=100;
 const move=chooseScavengingAction(s,s.units[0],[],()=>getReachable(s,s.units[0]));assert.equal(move?.type,'move');assert.equal(move.tacticalLevel,1);
 const before=structuredClone(s);s=act(s,move);assert.equal(s.units[0].ap,80);assert.equal(s.units[0].ammo,0);assert.equal(s.groundItems[0].count,3);
 const pickup=chooseScavengingAction(s,s.units[0],[],()=>getReachable(s,s.units[0]));assert.equal(pickup?.type,'loot');s=act(s,pickup);assert.equal(s.units[0].ammo,3);assert.equal(s.groundItems[0].count,0);assert.ok(s.units[0].ap<80);assert.equal(s.units[0].ammo+s.groundItems[0].count,before.groundItems[0].count);
});
test('observed floor memory produces a paid stand and climb without tracking a hidden opponent',()=>{
 let s=field([{id:'p',x:3,y:4,weapon:1809,stance:'crouched',medkits:0,overwatch:false}],{exploration:false,enemies:[{id:'e',x:15,y:9,patrol:false,overwatch:false}]});
 for(const tile of s.tiles.filter(t=>t.x===10))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true,obstacleHeight:10});
 s.units[0].lastKnownEnemy={x:5,y:5,tacticalLevel:1,turn:s.turn};s.units[0].ap=100;
 const first=chooseEnemyAction(s,s.units[0]);assert.deepEqual(first,{type:'stance',unitId:'p',stance:'standing'});
 const movedHidden=structuredClone(s);Object.assign(movedHidden.units[1],{x:14,y:9});assert.deepEqual(chooseEnemyAction(movedHidden,movedHidden.units[0]),first);
 const before=structuredClone(s),stand=stanceCost(s.units[0],'standing');s=act(s,first);const order=chooseEnemyAction(s,s.units[0]);assert.deepEqual(order,{type:'climb',unitId:'p',linkId:'access'});s=act(s,order);
 assert.equal(s.units[0].tacticalLevel,1);assert.equal(s.units[0].ap,100-stand-20);assert.equal(s.units[0].energy,before.units[0].energy-12);assert.ok(s.elapsedSeconds>=6);
 assert.deepEqual(s,replay(before,[first,order]));assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
test('unobserved live floor and approximate sound cannot create a roof pursuit',()=>{
 const s=field([{id:'p',x:1,y:1,weapon:1809,medkits:0,patrol:false}],{exploration:false,enemies:[{id:'e',x:15,y:9,patrol:false}]});
 for(const tile of s.tiles.filter(t=>t.x===10))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true,obstacleHeight:10});
 s.upperSurfaces.push({id:'hidden-platform',x:14,y:5,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0});
 s.units[0].lastHeardNoise={x:5,y:5,turn:1,kind:'fire',uncertainty:3};
 const other=structuredClone(s);Object.assign(other.units[1],{x:14,y:5,tacticalLevel:1});
 assert.deepEqual(chooseEnemyAction(s,s.units[0]),chooseEnemyAction(other,other.units[0]));
 const action=chooseEnemyAction(s,s.units[0]);assert.notEqual(action?.type,'climb');if(action?.type==='move')assert.equal(action.tacticalLevel,0);
});
test('civilian routes keep floors separate and use budgeted climb links rather than stepping off a roof',()=>{
 const s=field([{id:'p',x:0,y:0}],{npcs:[{id:'n',name:'Vecino',x:4,y:4,tacticalLevel:1,energy:100,stance:'standing',ai:{cycle:0,wait:0,homeId:null,activity:'roaming',destination:{x:3,y:4,tacticalLevel:0}}}]});
 const n=s.npcs[0],routes=npcRoutes(s,n);assert.ok(routes.records.get('3,4').path.some(p=>p.kind==='climb'&&p.linkId==='access'));
 advanceNpc(s,n,14);assert.equal(n.tacticalLevel,1);assert.equal(n.energy,100);advanceNpc(s,n,15);assert.equal(n.tacticalLevel,0);assert.equal(n.energy,92);assert.equal(n.lastMovePath[0].kind,'climb');
 const sealed=field([{id:'p',x:0,y:0}],{climbLinks:[],npcs:[{id:'n',name:'Vecino',x:4,y:4,tacticalLevel:1}]});const points=[...npcRoutes(sealed,sealed.npcs[0]).records.values()];assert.ok(points.every(p=>p.tacticalLevel===1&&surfaceAt(sealed,p)));
 for(let i=0;i<20;i++){advanceNpc(sealed,sealed.npcs[0]);assert.equal(sealed.npcs[0].tacticalLevel,1);assert.ok(surfaceAt(sealed,sealed.npcs[0]));}
});

test('a real enemy turn climbs to an observed roof defender and pays its attacks from the same budget',()=>{
 const s=field([{id:'p',x:4,y:5,tacticalLevel:1,overwatch:false,weapon:1809,medkits:0}],{exploration:false,enemies:[{id:'e',x:1,y:5,facing:2,weapon:1809,stance:'crouched',overwatch:false,patrol:false,medkits:0}]});
 s.units[0].ap=0;assert.equal(canSee(s,s.units[1],s.units[0]),true,'the enemy must actually observe the roof defender');
 const before=structuredClone(s),next=endTurn(s),attacker=next.units.find(u=>u.id==='e'),defender=next.units.find(u=>u.id==='p');
 assert.equal(attacker.tacticalLevel,1);assert.ok(attacker.ap<100-20);assert.ok(attacker.energy<=88);assert.ok(defender.hp<100);
 assert.ok(next.elapsedSeconds>=6);assert.deepEqual(s,before);assert.deepEqual(endTurn(validateBattleSnapshot(s)),next);
});

test('medical rescue can stand for a roof bridge even when both endpoints are on the ground',()=>{
 const s=field([{id:'doc',x:3,y:4,stance:'crouched',medical:80,medkits:2},{id:'patient',x:9,y:4,hp:55,maxHp:100,bandaged:0,bleeding:1,medical:0,medkits:0}]);
 for(const tile of s.tiles.filter(t=>t.x===5))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true,obstacleHeight:2});
 s.climbLinks.push({id:'far-access',kind:'climb',from:{x:8,y:4,tacticalLevel:0},to:{x:7,y:4,tacticalLevel:1}});
 const report=autoBandageBattle(s);assert.equal(report.stoppedReason,null);assert.deepEqual(report.treatedIds,['patient']);assert.equal(report.steps[0].type,'stance');
 assert.ok(report.steps.some(order=>order.type==='move'&&order.tacticalLevel===0));assert.deepEqual(report.battle,replay(s,report.steps));
 assert.equal(tacticalLevel(report.battle.units[0]),0);assert.ok(report.battle.units[0].energy<=80);assert.equal(report.battle.units[0].medkits,1);
});

test('an unseen prone rooftop blocker cannot change the AI climb choice before the attempted action',()=>{
 const s=field([{id:'p',x:3,y:4,weapon:1809,medkits:0,facing:2}],{exploration:false,enemies:[{id:'hidden',x:7,y:6,tacticalLevel:1,stance:'prone',patrol:false,overwatch:false}]});
 s.units[0].lastKnownEnemy={x:6,y:5,tacticalLevel:1,turn:1};
 const blocked=structuredClone(s),occupant={...structuredClone(s.units[1]),id:'blocker',x:4,y:4,tacticalLevel:1,stance:'prone'};blocked.units.push(occupant);
 assert.equal(canSee(blocked,blocked.units[0],occupant),false);
 const planned=chooseEnemyAction(s,s.units[0]);assert.deepEqual(planned,{type:'climb',unitId:'p',linkId:'access'});assert.deepEqual(chooseEnemyAction(blocked,blocked.units[0]),planned);
 const attempted=actBattle(blocked,planned);assert.ok(attempted.lastError);assert.equal(spaceKey(attempted.units[0]),spaceKey(blocked.units[0]));assert.equal(attempted.units[0].ap,blocked.units[0].ap);assert.equal(attempted.units[0].energy,blocked.units[0].energy);
});

test('a crouched AI search can stand and use a roof bridge to reach a remembered ground position',()=>{
 let s=field([{id:'p',x:3,y:4,weapon:1809,stance:'crouched',medkits:0,facing:2}],{exploration:false,enemies:[{id:'e',x:9,y:4,patrol:false,overwatch:false}]});
 for(const tile of s.tiles.filter(t=>t.x===5))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true,obstacleHeight:2});
 s.climbLinks.push({id:'far-access',kind:'climb',from:{x:8,y:4,tacticalLevel:0},to:{x:7,y:4,tacticalLevel:1}});
 s.units[0].lastKnownEnemy={x:9,y:4,tacticalLevel:0,turn:1};s.units[0].ap=100;
 assert.equal(canSee(s,s.units[0],s.units[1]),false);
 const before=structuredClone(s),orders=[];
 for(let count=0;count<6&&tacticalLevel(s.units[0])===0;count++){
  const order=chooseEnemyAction(s,s.units[0]);assert.ok(order,'search must not stall at the wall while a roof route is open');orders.push(order);s=act(s,order);
 }
 assert.ok(orders.some(order=>order.type==='stance'&&order.stance==='standing'));assert.equal(s.units[0].tacticalLevel,1);assert.ok(s.units[0].ap<=100-20-stanceCost(before.units[0],'standing'));
 assert.ok(s.units[0].energy<=88);assert.deepEqual(s,replay(before,orders));
});

test('civilian climb exhaustion consumes a rest phase before resuming and remains saveable',()=>{
 for(const descending of [true,false]){
  const from=descending?link.to:link.from,to=descending?link.from:link.to,cost=descending?15:20,breath=descending?8:12;
  const s=field([{id:'p',x:0,y:0}],{npcs:[{id:'n',name:'Vecino',...from,hp:100,energy:breath,unconscious:false,stance:'standing',ai:{cycle:0,wait:0,homeId:null,activity:'roaming',destination:to}}]});
  const n=s.npcs[0],players=structuredClone(s.units);
  advanceNpc(s,n,cost-1);assert.ok(sameCell(n,from));assert.equal(n.energy,breath,'an insufficient action budget cannot fund rest');
  advanceNpc(s,n,cost);assert.ok(sameCell(n,from));assert.equal(n.energy,breath+10);assert.equal(n.unconscious,false);assert.equal(n.hp,100);
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
  advanceNpc(s,n,cost);advanceNpc(saved,saved.npcs[0],cost);
  assert.ok(sameCell(n,to));assert.equal(n.energy,10);assert.deepEqual(saved.npcs,s.npcs);assert.deepEqual(s.units,players);
  assert.doesNotThrow(()=>validateBattleSnapshot(s));
 }
});
