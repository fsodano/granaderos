import test from 'node:test';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {availableAmmunition,AMMUNITION_TYPES} from '../game/ammunition-types.js';
const AMMO='inventory:ammo:pistol_69';
import assert from 'node:assert/strict';
import {createBattle,actBattle,inventoryMapPreview,getNpcGiftResult} from '../game/tactical.js';
import {equipmentEndpoint,equipmentFingerprint,extractEquipmentSelection,inventoryUsage} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {makeOutfit} from '../game/outfits.js';

const person=(id,x,y,extra={})=>({id,name:id,x,y,weapon:1805,blade:0,ammo:0,priming:0,flints:0,rations:0,medkits:0,torches:0,boleadoras:0,...extra});
const field=(first={},others=[person('q',3,3)],options={})=>createBattle([person('p',2,3,first),...others],{
 width:24,height:9,seed:45,tiles:Array.from({length:216},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
 enemies:[{id:'guard',x:22,y:7,overwatch:false,patrol:false}],...options});
const actor=(b,id='p')=>b.units.find(u=>u.id===id);
const hint=(slotId,item,index,count)=>({slotId,item,index,count});
const partitions=(u,item)=>Object.fromEntries(inventoryUsage(u).slots.filter(s=>s.entry?.item===item).map(s=>[s.id,s.entry.count]));
const source=(u,item)=>inventoryUsage(u).slots.find(s=>s.entry?.item===item)?.id;
function order(b,sourceId,point={x:2,y:3},extra={}){return {type:'inventoryMap',unitId:'p',sourceId,expectedSource:equipmentFingerprint(actor(b),sourceId),count:1,intent:'auto',tacticalLevel:0,...point,...extra};}
const physical=b=>{const result=structuredClone(b);delete result.log;delete result.lastError;return result;};
function accept(b,a){
 const before=structuredClone(b),preview=inventoryMapPreview(b,actor(b),a);assert.equal(preview.valid,true,preview.reason);assert.deepEqual(b,before);
 const next=actBattle(b,preview.action);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(b,before);validateBattleSnapshot(next);return {next,preview};
}
function reject(b,a,reason){
 const before=structuredClone(b),preview=inventoryMapPreview(b,actor(b),a);assert.equal(preview.valid,false);if(reason)assert.match(preview.reason,reason);
 const next=actBattle(b,a);assert.ok(next.lastError);assert.deepEqual(physical(next),physical(b));assert.deepEqual(b,before);return preview;
}

test('selected partial pocket alone loses the exact quantity on a ground drop',()=>{
 const b=field({medkits:3,pocketOrder:[hint('large-1','medkits',0,2),hint('large-2','medkits',1,1)]});
 const {next:n,preview:p}=accept(b,order(b,'large-1',{x:1,y:3}));
 assert.equal(p.kind,'drop');assert.equal(p.pa,4);assert.equal(actor(n).ap,96);assert.equal(actor(n).medkits,2);
 assert.deepEqual(partitions(actor(n),'medkits'),{'large-1':1,'large-2':1});assert.equal(n.seed,b.seed);
 assert.deepEqual(n.groundItems.map(g=>({item:g.item,count:g.count,x:g.x,y:g.y,tacticalLevel:g.tacticalLevel,known:g.knownToPlayer})),[{item:'medkits',count:1,x:1,y:3,tacticalLevel:0,known:true}]);
});

test('generic partial selection preserves condition and unrelated partitions across a give',()=>{
 const cloth={name:'Tela',count:5,weight:.1,condition:47},b=field({inventory:{cloth},pocketOrder:[hint('small-1','inventory:cloth',0,3),hint('small-2','inventory:cloth',1,2)]});
 const {next:n,preview:p}=accept(b,order(b,'small-1',{x:3,y:3,targetId:'q'},{count:2}));
 assert.equal(p.kind,'give');assert.equal(actor(n).ap,96);assert.equal(actor(n,'q').ap,100);assert.equal(n.seed,b.seed);
 assert.deepEqual(partitions(actor(n),'inventory:cloth'),{'small-1':1,'small-2':2});assert.deepEqual(actor(n).inventory.cloth,{...cloth,count:3});
 assert.deepEqual(actor(n,'q').inventory.cloth,{...cloth,count:2});assert.equal(n.groundItems.length,0);
});

test('a selected hand is emptied without taking a same-record packed copy',()=>{
 for(const setup of [
  {activeSlot:'medical',medkits:3,item:'medkits'},
  {activeSlot:'supply',activeSupply:'rations',rations:3,item:'rations'},
  {activeSlot:'item',activeItem:'inventory:cloth',inventory:{cloth:{name:'Tela',count:3,weight:.1,condition:54}},item:'inventory:cloth'},
  {activeSlot:'tool',activeTool:'inventory:key',inventory:{key:{count:2,weight:.1,kind:'tool',toolKey:'key',keyId:'store',condition:54}},item:'inventory:key'},
 ]){
  const {item,...extra}=setup,b=field({weapon:0,loaded:0,...extra});
  const before=partitions(actor(b),item),{next:n}=accept(b,order(b,'hand:right'));
  assert.equal(handLayout(actor(n)).right,null,item);assert.deepEqual(partitions(actor(n),item),before,item);
  assert.equal(n.groundItems[0].count,1);assert.equal(n.groundItems[0].condition,extra.inventory?54:undefined);
 }
 const b=field({medkits:3,leftHandItem:'medkits'}),packed=partitions(actor(b),'medkits'),{next:n}=accept(b,order(b,'hand:left'));
 assert.equal(handLayout(actor(n)).right,'primary');assert.equal(handLayout(actor(n)).left,null);assert.deepEqual(partitions(actor(n),'medkits'),packed);
});

test('a selected pocket leaves the same-record singleton in the hand',()=>{
 const b=field({weapon:0,loaded:0,activeSlot:'medical',medkits:4,pocketOrder:[hint('small-1','medkits',0,2),hint('small-2','medkits',1,1)]});
 const {next:n}=accept(b,order(b,'small-1',{x:3,y:3,targetId:'q'},{count:2}));
 assert.equal(handLayout(actor(n)).right,'medkits');assert.equal(equipmentEndpoint(actor(n),'hand:right').count,1);assert.equal(actor(n).medkits,2);assert.deepEqual(partitions(actor(n),'medkits'),{'small-2':1});
});

test('a fitted loaded gun keeps finite identity and the other held weapon remains available',()=>{
 const b=field({weapon:1800,loaded:1,condition:43,jammed:true,reloadProgress:undefined,weaponInstanceId:'map-gun',weaponFittings:{bayonet:{weapon:1811,condition:61,instanceId:'map-bayonet',fittingPattern:'india_socket'}}});
 const {next:n}=accept(b,order(b,'hand:right'));
 assert.equal(actor(n).weaponDropped,true);assert.equal(actor(n).loaded,0);assert.equal(actor(n).weaponInstanceId,undefined);
 const gun=n.groundItems[0];assert.equal(gun.instanceId,'map-gun');assert.equal(gun.loaded,1);assert.equal(gun.condition,43);assert.equal(gun.jammed,true);assert.deepEqual(gun.fittings,actor(b).weaponFittings);
 const pair=field({blade:1813,bladeInstanceId:'map-blade'}),{next:after}=accept(pair,order(pair,'hand:right'));
 assert.equal(handLayout(actor(after)).right,'blade');assert.equal(actor(after).bladeInstanceId,'map-blade');assert.equal(after.groundItems.length,1);
});

test('outfit selection drops the exact worn item without changing packed garments',()=>{
 const outfit={...makeOutfit(),condition:41,instanceId:'worn-map'},b=field({outfit,inventory:{spare:{...makeOutfit(),condition:67,instanceId:'spare-map'}}});
 const packed=structuredClone(actor(b).inventory),{next:n}=accept(b,order(b,'outfit'));
 assert.equal(actor(n).outfit,null);assert.deepEqual(actor(n).inventory,packed);assert.equal(n.groundItems[0].instanceId,'worn-map');assert.equal(n.groundItems[0].condition,41);
});

test('relay uses the exact selected quantity and charges each legal sender',()=>{
 const b=field({ammo:5,pocketOrder:[hint('small-1',AMMO,0,3),hint('small-2',AMMO,1,2)]},Array.from({length:7},(_,i)=>person(`q${i}`,3+i,3)));
 const {next:n,preview:p}=accept(b,order(b,'small-1',{x:9,y:3,targetId:'q6'},{count:2}));
 assert.equal(p.kind,'relay');assert.equal(p.pa,4);assert.equal(p.totalPA,28);assert.equal(p.route.length,8);
 assert.deepEqual(partitions(actor(n),AMMO),{'small-1':1,'small-2':2});assert.equal(actor(n,'q6').ammo,2);assert.equal(n.seed,b.seed);
 for(const step of p.route)assert.equal(actor(n,step.id).ap,step.id==='q6'?100:96);
 const stale=p.action,changed=structuredClone(b);actor(changed,'q3').y++;
 reject(changed,stale,/cambi|cadena/i);
 const spent=structuredClone(b);actor(spent,'q3').ap=3;reject(spent,stale);
});

test('ally toss catch and failure conserve items and charge catch AP only on success',()=>{
 for(const catches of [true,false]){
  const b=field({dexterity:catches?100:0,medkits:3,pocketOrder:[hint('small-1','medkits',0,2),hint('small-2','medkits',1,1)]},[person('q',6,3,{dexterity:catches?100:0,energy:catches?100:20})]);
  const {next:n,preview:p}=accept(b,order(b,'small-1',{x:6,y:3,targetId:'q'},{count:2}));
  assert.equal(p.kind,'throw');assert.equal(p.pa,8);assert.ok(p.flight.path.length>1);assert.equal(actor(n).ap,actor(b).ap-8);assert.equal(actor(n).medkits,1);assert.deepEqual(partitions(actor(n),'medkits'),{'small-2':1});
  assert.equal(actor(n,'q').medkits,catches?2:0);assert.equal(actor(n,'q').ap,actor(b,'q').ap-(catches?2:0));assert.notEqual(n.seed,b.seed);
  if(!catches)assert.deepEqual(n.groundItems.map(g=>[g.x,g.y,g.tacticalLevel,g.count]),[[6,3,0,2]]);else assert.deepEqual(n.groundItems,[]);
  assert.deepEqual(physical(actBattle(b,p.action)),physical(n));
 }
 const b=field({ammo:1},[person('q',6,3,{ap:1})]);actor(b,'q').ap=1;
 const {next:n,preview:p}=accept(b,order(b,source(actor(b),AMMO),{x:6,y:3,targetId:'q'}));assert.equal(p.chance,0);assert.equal(actor(n,'q').ap,1);assert.equal(n.groundItems[0].count,1);
});

test('ground intent over an ally drops or tosses without giving, healing or spending RNG',()=>{
 for(const x of [3,6]){
  const b=field({weapon:0,loaded:0,activeSlot:'medical',medkits:2},[person('q',x,3,{hp:50,bleeding:2})]);
  const {next:n,preview:p}=accept(b,order(b,'hand:right',{x,y:3,targetId:'q'},{intent:'ground'}));
  assert.equal(p.action.targetId,undefined);assert.equal(p.kind,x===3?'drop':'throw');assert.equal(n.seed,b.seed);assert.equal(actor(n,'q').medkits,0);assert.equal(actor(n,'q').hp,50);assert.equal(actor(n,'q').bleeding,2);
  assert.deepEqual(n.groundItems.map(g=>[g.x,g.y,g.count]),[[x,3,1]]);
 }
});

test('full packs, stale fingerprints, changed targets and invalid quantities reject without effects',()=>{
 const full=Object.fromEntries(Array.from({length:12},(_,i)=>[`parcel${i}`,{count:1,weight:1}]));
 const b=field({medkits:3,pocketOrder:[hint('small-1','medkits',0,2),hint('small-2','medkits',1,1)]},[person('q',3,3,{inventory:full})]);
 reject(b,order(b,'small-1',{x:3,y:3,targetId:'q'}),/espacio/);
 for(const count of [0,-1,.5,3,NaN,Infinity,'1',null])reject(b,order(b,'small-1',undefined,{count}));
 reject(b,order(b,'small-1',undefined,{expectedSource:'stale'}));
 reject(b,order(b,'small-1',undefined,{expectedSource:undefined}));
 reject(b,order(b,'hand:right',undefined,{count:2}));
 for(const point of [{x:2.5,y:3},{x:Infinity,y:3},{x:-1,y:3},{x:24,y:3},{x:2,y:3,tacticalLevel:1}])reject(b,order(b,'small-1',point));
 reject(b,order(b,'small-1',undefined,{intent:'attack'}));
 const available=field({ammo:2}),a=order(available,source(actor(available),AMMO),{x:3,y:3,targetId:'q'});actor(available,'q').x=4;reject(available,a,/cambió de lugar/);
 const changed=field({ammo:2}),stale=order(changed,source(actor(changed),AMMO));setTestAmmunition(actor(changed),1);reject(changed,stale,/Cambió/);
 const poor=field({ammo:2});actor(poor).ap=3;reject(poor,order(poor,source(actor(poor),AMMO)),/PA/);
});

test('near drops respect blocked corners and distant tosses reject range or solid walls',()=>{
 const b=field({ammo:2});Object.assign(b.tiles.find(t=>t.x===3&&t.y===3),{type:'wall',blocked:true,blocksSight:true});
 reject(b,order(b,source(actor(b),AMMO),{x:3,y:4}),/obstáculo/);
 reject(b,order(b,source(actor(b),AMMO),{x:4,y:3}));
 reject(b,order(b,source(actor(b),AMMO),{x:9,y:3}),/alcance/);
});

test('exploration handovers and ground placements cost time but no AP or ammunition',()=>{
 for(const point of [{x:1,y:3},{x:6,y:3},{x:3,y:3,targetId:'q'}]){
  const b=field({medkits:2},[person('q',3,3)],{exploration:true,enemies:[]});for(const u of b.units)u.ap=0;
  const {next:n,preview:p}=accept(b,order(b,source(actor(b),'medkits'),point));
  assert.equal(p.pa,0);assert.equal(p.totalPA,0);assert.ok(n.units.every(u=>u.ap===0));assert.equal(n.elapsedSeconds-b.elapsedSeconds,1);assert.equal(n.seed,b.seed);assert.equal(actor(n).ammo,0);
 }
});

test('hidden enemy bodies cannot change point previews or become named recipients',()=>{
 const b=field({ammo:2}),hidden=structuredClone(b);Object.assign(actor(hidden,'guard'),{x:6,y:3,energy:0,unconscious:true});
 const a=order(b,source(actor(b),AMMO),{x:6,y:3});
 assert.deepEqual(inventoryMapPreview(b,actor(b),a),inventoryMapPreview(hidden,actor(hidden),a));
 const publicState={...hidden,units:hidden.units.filter(u=>u.id!=='guard')};assert.deepEqual(inventoryMapPreview(publicState,actor(publicState),a),inventoryMapPreview(hidden,actor(hidden),a));
 const named={...a,targetId:'guard'},unknown={...a,targetId:'absent'};
 assert.equal(reject(hidden,named).reason,reject(hidden,unknown).reason);
 const n=accept(hidden,a).next;assert.equal(actor(n,'guard').ammo,actor(hidden,'guard').ammo);assert.equal(n.groundItems[0].x,6);
});

test('a visible civilian physically refuses the selected item and keeps the exact source owned',()=>{
 const b=field({ammo:2},[],{exploration:true,enemies:[],npcs:[{id:'civilian',name:'Vecino',x:3,y:3,hp:100}]});
 const id=source(actor(b),AMMO),fingerprint=equipmentFingerprint(actor(b),id),{next:n,preview:p}=accept(b,order(b,id,{x:3,y:3,targetId:'civilian'}));
 assert.equal(p.kind,'gift');assert.equal(getNpcGiftResult(b,n).status,'refused');assert.equal(equipmentFingerprint(actor(n),id),fingerprint);assert.equal(n.elapsedSeconds-b.elapsedSeconds,1);assert.equal(actor(n).ammo,2);assert.equal(n.groundItems.length,0);
});

test('new ground records use unique IDs and refuse the save collection limit atomically',()=>{
 const b=field({ammo:2});b.groundItems=[{id:`item-${b.turn}-1`,type:'item',item:AMMO,kind:'ammunition',ammoType:'pistol_69',name:AMMUNITION_TYPES.pistol_69.name,count:0,weight:.04,x:1,y:1}];
 const {next:n}=accept(b,order(b,source(actor(b),AMMO)));assert.equal(new Set(n.groundItems.map(g=>g.id)).size,2);
 b.groundItems=Array.from({length:2000},(_,i)=>({id:`old-${i}`,type:'item',item:AMMO,kind:'ammunition',ammoType:'pistol_69',name:AMMUNITION_TYPES.pistol_69.name,count:0,weight:.04,x:1,y:1}));
 reject(b,order(b,source(actor(b),AMMO)),/espacio/);
});

test('pure extraction supports repeated exact drops from an old overloaded pack',()=>{
 const b=field({ammo:300}),u=actor(b),before=structuredClone(u),id=source(u,AMMO);assert.equal(inventoryUsage(u).overloaded,true);
 const result=extractEquipmentSelection(u,{sourceId:id,expectedSource:equipmentFingerprint(u,id),count:20});
 assert.equal(availableAmmunition(result.unit,u.weapon),280);assert.equal(result.stack.count,20);assert.deepEqual(u,before);assert.ok(inventoryUsage(result.unit).overloaded);
});

test('own-body targeting drops at the source and paid handling lowers a raised gun',()=>{
 const b=field({ammo:2,weaponReady:true}),{next:n,preview:p}=accept(b,order(b,source(actor(b),AMMO),{x:2,y:3,targetId:'p'}));
 assert.equal(p.kind,'drop');assert.equal(p.action.targetId,undefined);assert.equal(actor(n).weaponReady,undefined);assert.equal(actor(n).ap,actor(b).ap-4);assert.equal(n.groundItems[0].x,2);assert.equal(n.groundItems[0].y,3);
 reject(b,order(b,source(actor(b),AMMO),{x:3,y:3,targetId:'p'}),/cambió de lugar/);
});

test('map handling respects active interrupt budgets and unavailable recipients',()=>{
 const b=field({ammo:2});b.phase='interrupt';b.roundTimeCharged=true;b.enemyTurn={unitIds:['guard'],unitIndex:0,actionsTaken:1,started:true};b.interrupt={side:'player',unitIds:['q'],enemyId:'guard'};actor(b,'q').reactionTurn=b.turn;
 reject(b,order(b,source(actor(b),AMMO)));b.interrupt.unitIds.push('p');actor(b).reactionTurn=b.turn;const {next:n}=accept(b,order(b,source(actor(b),AMMO)));assert.equal(actor(n).ap,actor(b).ap-4);
 for(const extra of [{hp:0},{unconscious:true,energy:0},{routed:true},{surrendered:true},{fled:true},{departure:{exitId:'gone'}}]){
  const unavailable=field({ammo:2});Object.assign(actor(unavailable,'q'),extra);reject(unavailable,order(unavailable,source(actor(unavailable),AMMO),{x:3,y:3,targetId:'q'}));
 }
});

const roof=(x,y=3)=>({id:`map-roof:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0});
test('same-roof drops and cross-floor tosses retain the exact supported landing after save',()=>{
 const options={upperSurfaces:[roof(6),roof(7)],climbLinks:[]};
 const upstairs=field({x:6,tacticalLevel:1,ammo:2},[],options);
 const drop=order(upstairs,source(actor(upstairs),AMMO),{x:7,y:3,tacticalLevel:1}),{next:n,preview:p}=accept(upstairs,drop);
 assert.equal(p.kind,'drop');assert.equal(n.groundItems[0].tacticalLevel,1);assert.equal(n.groundItems[0].x,7);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(n))),looted=actBattle(saved,{type:'loot',unitId:'p',groundId:n.groundItems[0].id,count:1});assert.equal(looted.lastError,null);assert.equal(actor(looted).ammo,2);assert.equal(looted.groundItems[0].count,0);
 const downstairs=field({ammo:2},[person('q',6,3,{tacticalLevel:1,dexterity:100})],options);
 const tossed=accept(downstairs,order(downstairs,source(actor(downstairs),AMMO),{x:6,y:3,tacticalLevel:1},{intent:'ground'}));
 assert.equal(tossed.preview.kind,'throw');assert.equal(tossed.next.groundItems[0].tacticalLevel,1);assert.equal(tossed.next.groundItems[0].x,6);
 const given=accept(downstairs,order(downstairs,source(actor(downstairs),AMMO),{x:6,y:3,tacticalLevel:1,targetId:'q'}));assert.equal(given.preview.kind,'throw');assert.equal(actor(given.next,'q').ammo,1);assert.equal(given.next.groundItems.length,0);
 reject(upstairs,order(upstairs,source(actor(upstairs),AMMO),{x:6,y:3,tacticalLevel:0}),/bloqueada/);
 reject(upstairs,order(upstairs,source(actor(upstairs),AMMO),{x:7,y:3,tacticalLevel:null}));
});

test('partly loaded weapon progress follows its finite instance through a failed catch',()=>{
 const b=field({weapon:1802,loaded:0,reloadProgress:.4,weaponInstanceId:'part-loaded',dexterity:0},[person('q',6,3,{energy:20,dexterity:0})]);
 const {next:n}=accept(b,order(b,'hand:right',{x:6,y:3,targetId:'q'}));assert.equal(actor(n).reloadProgress,undefined);assert.equal(n.groundItems[0].reloadProgress,.4);assert.equal(n.groundItems[0].instanceId,'part-loaded');assert.equal(n.groundItems[0].count,1);
});

test('NPC gift availability requires the clicked visible room and exact character cell',()=>{
 const point={x:3,y:4},b=field({ammo:2},[],{exploration:true,enemies:[],npcs:[{id:'hidden-npc',name:'Vecino',...point,hp:100}]});b.tiles.find(t=>t.x===point.x&&t.y===point.y).roomId='unseen-room';b.revealedRooms=[];
 const id=source(actor(b),AMMO),unknown=order(b,id,{...point,targetId:'absent'}),hidden=order(b,id,{...point,targetId:'hidden-npc'});
 assert.equal(reject(b,hidden).reason,reject(b,unknown).reason);
 b.revealedRooms=['unseen-room'];const result=accept(b,hidden);assert.equal(result.preview.kind,'gift');assert.equal(getNpcGiftResult(b,result.next).status,'refused');
 const elsewhere={x:1,y:3};assert.equal(reject(b,order(b,id,{...elsewhere,targetId:'hidden-npc'})).reason,reject(b,order(b,id,{...elsewhere,targetId:'absent'})).reason);
});
