import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,exitPreview,canSee,visibleEnemies,getReachable,fieldCapable,movementEnergy} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {planGroupMove} from '../game/group-movement.js';
const exits=[{id:'west',edge:'W',destination:'retiro',entryEdge:'S',entryAnchor:{x:14,y:15}},{id:'south',edge:'S',destination:'ensenada',entryEdge:'W',entryAnchor:{x:0,y:7}}];
const ground=(width=10,height=8)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const fixture=(players=[{id:'p',x:0,y:2},{id:'q',x:1,y:5}],extra={})=>createBattle(players,{id:'exit-test',width:10,height:8,exits,tiles:ground(),enemies:[{id:'e',x:8,y:6,weapon:1813,overwatch:false,facing:2}],...extra});
const request={type:'exit',unitIds:['p'],exitId:'west'};
function unchanged(before,order){const after=actBattle(before,order);assert.ok(after.lastError);const clean=s=>{const r=structuredClone(s);delete r.lastError;delete r.log;return r;};assert.deepEqual(clean(after),clean(before));return after;}
test('exit preview and paid crossing retain a complete receipt and leave other troops on field',()=>{
 const b=fixture(),preview=exitPreview(b,request);assert.equal(preview.available,true);assert.equal(preview.costById.p,8);
 const n=actBattle(b,request),u=n.units[0];assert.equal(n.lastError,null);assert.equal(n.status,'active');assert.equal(u.ap,b.units[0].ap-8);assert.equal(u.energy,99);
 assert.deepEqual(u.departure,{exitId:'west',edge:'W',destination:'retiro',x:0,y:2,elapsedSeconds:6,mountId:null});assert.equal(n.units.length,b.units.length);assert.equal(n.units[1].departure,undefined);assert.deepEqual(validateBattleSnapshot(n),n);
});
test('center, wrong edge, blocked terrain and props cannot create departure',()=>{
 const center=fixture();center.units[0].x=4;unchanged(center,request);unchanged(fixture(),{...request,exitId:'south'});
 const wall=fixture();wall.tiles.find(t=>t.x===0&&t.y===2).blocked=true;unchanged(wall,request);
 const prop=fixture();prop.props.push({id:'block',type:'table',x:0,y:2});unchanged(prop,request);
});
test('a batch preflight rejects duplicates, nonplayers and any blocked selected member atomically',()=>{
 for(const ids of [[],['p','p'],['p','q'],['p','e'],['missing']])unchanged(fixture(),{...request,unitIds:ids});
 const preview=exitPreview(fixture(),{...request,unitIds:['p','q']});assert.deepEqual(preview.eligibleIds,['p']);assert.equal(preview.blocked[0].id,'q');assert.equal(preview.available,false);
});
test('mobility, AP, energy and ordinary phase checks use the same preview and reducer gate',()=>{
 for(const patch of [{ap:7},{energy:1},{energy:0,unconscious:true},{hp:10,unconscious:true},{knockedDown:true},{entangled:true},{routed:true},{surrendered:true}]){const b=fixture();Object.assign(b.units[0],patch);assert.equal(exitPreview(b,request).available,false);unchanged(b,request);}
 for(const phase of ['enemy','interrupt']){const b=fixture();b.phase=phase;unchanged(b,request);}
 const b=fixture();b.enemyTurn={unitIds:[],unitIndex:0,actionsTaken:0,started:false};unchanged(b,request);
});
test('the last capable departure concludes retreat while critical and dead records remain',()=>{
 const b=fixture([{id:'p',x:0,y:2},{id:'patient',x:4,y:4,hp:10},{id:'body',x:5,y:4,hp:0}]);const n=actBattle(b,request);assert.equal(n.status,'retreat');assert.equal(n.units.length,4);assert.equal(n.units.find(u=>u.id==='patient').departure,undefined);assert.equal(n.units.find(u=>u.id==='body').hp,0);assert.doesNotThrow(()=>validateBattleSnapshot(n));
 const temporary=fixture([{id:'p',x:0,y:2},{id:'patient',x:4,y:4,hp:80,energy:0}]);assert.equal(actBattle(temporary,request).status,'active');assert.equal(fieldCapable(temporary.units[1]),true);
});
test('exploration exits pay movement time once and a bleeding collapse stops at the actual edge',()=>{
 const b=fixture([{id:'p',x:0,y:2,hp:20,bleeding:10},{id:'q',x:1,y:5}],{exploration:true,enemies:[]});b.bleedSeconds=3;
 const n=actBattle(b,request);assert.equal(n.elapsedSeconds,3);assert.equal(n.units[0].hp,10);assert.equal(n.units[0].unconscious,true);assert.equal(n.units[0].departure,undefined);assert.equal(n.units[0].energy,100-movementEnergy(b.units[0],{type:'grass'},true));assert.equal(n.actionDurationSeconds,undefined);assert.equal(n.actionTimeAppliedSeconds,undefined);
 const clean=fixture([{id:'p',x:0,y:2},{id:'q',x:0,y:5}],{exploration:true,enemies:[]});const departed=actBattle(clean,{...request,unitIds:['p','q']});assert.equal(departed.elapsedSeconds,6);assert.equal(departed.status,'retreat');assert.deepEqual(departed.units.map(u=>u.departure.elapsedSeconds),[3,6]);
});
test('a later batch casualty keeps already completed exits and never exports the collapsed member',()=>{
 const b=fixture([{id:'p',x:0,y:2},{id:'q',x:0,y:5,hp:20,bleeding:10},{id:'r',x:1,y:6}],{exploration:true,enemies:[]});
 const n=actBattle(b,{...request,unitIds:['p','q']});assert.ok(n.units[0].departure);assert.equal(n.units[1].departure,undefined);assert.equal(n.units[1].hp,10);assert.equal(n.elapsedSeconds,6);assert.equal(n.status,'active');
});
test('departed soldiers stop observing, blocking, acting and serving as item or loot targets',()=>{
 let b=fixture([{id:'p',x:0,y:2},{id:'q',x:1,y:2}],{exploration:true,enemies:[]});b=actBattle(b,request);const p=b.units[0],q=b.units[1];assert.equal(canSee(b,p,q),false);assert.equal(canSee(b,q,p),false);assert.deepEqual(getReachable(b,p),[]);assert.ok(getReachable(b,q).some(t=>t.x===0&&t.y===2));
 for(const order of [{type:'look',unitId:'p',x:3,y:2},{type:'loot',unitId:'q',targetId:'p'},{type:'give',unitId:'q',targetId:'p',item:'medkits',count:1}])unchanged(b,order);
 assert.equal(planGroupMove(b,{unitIds:['p'],anchorId:'p',x:2,y:2}).ok,false);
 const heal=actBattle(b,{type:'weapon',unitId:'q',slot:'medical'});unchanged(heal,{type:'useItem',unitId:'q',targetId:'p'});
});
test('departed bleeding continues on the shared clock and mounted receipts retain actual horse identity',()=>{
 let b=fixture([{id:'p',x:0,y:2,hp:30,bleeding:5,mounted:true,mount:{id:'horse-1',stamina:90,condition:80}},{id:'q',x:1,y:5}],{exploration:true,enemies:[]});b=actBattle(b,request);assert.equal(b.units[0].departure.mountId,'horse-1');const n=endTurn(b);assert.ok(n.units[0].hp<b.units[0].hp);assert.equal(n.units[0].departure.mountId,'horse-1');assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('partial departures survive JSON and snapshot validation rejects false receipt geometry and queue participants',()=>{
 const b=actBattle(fixture(),request),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));assert.deepEqual(actBattle(saved,{type:'look',unitId:'q',x:3,y:5}),actBattle(b,{type:'look',unitId:'q',x:3,y:5}));
 for(const mutate of [s=>s.units[0].departure.x=1,s=>s.units[0].departure.elapsedSeconds=0,s=>s.units[0].departure.elapsedSeconds=999,s=>s.units[0].departure.exitId='other',s=>delete s.units[0].departure.mountId,s=>s.units[0].departure.mountId='phantom',s=>s.status='retreat']){const bad=structuredClone(b);mutate(bad);assert.throws(()=>validateBattleSnapshot(bad));}
});
test('a departed enemy no longer appears as a visible target',()=>{
 const b=fixture();const e=b.units[2];Object.assign(e,{x:9,y:2,departure:{exitId:'enemy:E',edge:'E',destination:'__offmap_enemy__',x:9,y:2,elapsedSeconds:0,mountId:null}});b.units[0].x=8;assert.equal(visibleEnemies(b).length,0);unchanged(b,{type:'fire',unitId:'p',targetId:'e'});
});
test('terminal evacuation cannot re-open exploration or submit another exit',()=>{
 const b=actBattle(fixture([{id:'p',x:0,y:2}],{exploration:true,enemies:[]}),request);assert.equal(b.status,'retreat');unchanged(b,{type:'explore'});unchanged(b,request);
});
test('fleeing uses the available AP across turns without teleporting or restoring the dropped gun',()=>{
 let b=fixture([{id:'p',x:0,y:6}],{enemies:[{id:'router',x:5,y:4,routed:true,weaponDropped:true,loaded:0,weapon:1800,ammo:0}],enemyCount:1});b.units[1].ap=8;
 b=endTurn(b);assert.equal(b.units[1].departure,undefined);assert.equal(b.units[1].fleePath.length,1);assert.ok(Math.hypot(b.units[1].x-5,b.units[1].y-4)<=1);assert.equal(b.status,'active');
 for(let turn=0;turn<6&&b.status==='active';turn++){b=endTurn(b);while(b.phase==='interrupt')b=endTurn(b);assert.doesNotThrow(()=>validateBattleSnapshot(b));}
 assert.equal(b.status,'victory');assert.ok(b.units[1].departure);assert.equal(b.units[1].weaponDropped,true);assert.equal(b.units[1].loaded,0);assert.equal(b.droppedWeapons.length,0);
});
test('closed doors and solid props prevent a routed actor escaping a sealed room',()=>{
 const tiles=ground();for(const t of tiles)if(Math.abs(t.x-5)<=1&&Math.abs(t.y-4)<=1&&(t.x!==5||t.y!==4)){t.type='wall';t.blocked=true;t.blocksSight=true;}
 const door=tiles.find(t=>t.x===5&&t.y===3);Object.assign(door,{type:'door',open:false,locked:true});
 let b=fixture([{id:'p',x:0,y:6}],{tiles,enemies:[{id:'router',x:5,y:4,routed:true,weaponDropped:true,loaded:0}]});b=endTurn(b);
 assert.equal(b.units[1].surrendered,true);assert.equal(b.units[1].departure,undefined);assert.equal(b.units[1].fled,undefined);assert.deepEqual([b.units[1].x,b.units[1].y],[5,4]);assert.equal(b.status,'victory');assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('a routed player with no authorized exit remains for capture and never becomes an escapee',()=>{
 const b=fixture([{id:'p',x:4,y:4,routed:true,weaponDropped:true,loaded:0}],{exits:[]});const n=endTurn(b);assert.equal(n.units[0].surrendered,true);assert.equal(n.units[0].departure,undefined);assert.equal(n.status,'defeat');
});
test('a boundary crossing provokes a watching enemy and keeps the actor until that reaction ends',()=>{
 const b=fixture([{id:'p',x:0,y:2,agility:30,experienceLevel:1},{id:'q',x:0,y:6}],{seed:45,enemies:[{id:'watch',x:4,y:2,facing:6,weapon:1800,agility:100,experienceLevel:10,marksmanship:95,overwatch:true}]});
 const n=actBattle(b,request);assert.equal(n.units[0].departure,undefined);assert.equal(n.units[2].reactionTurn,n.turn);assert.ok(n.units[2].ap<b.units[2].ap);assert.ok(n.units[0].hp<100);assert.equal(n.elapsedSeconds,6);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('interrupting an enemy boundary crossing resumes the same paid rout after save',()=>{
 const b=fixture([{id:'p',x:6,y:2,facing:2,agility:100,experienceLevel:10}],{enemies:[{id:'router',x:9,y:2,routed:true,weaponDropped:true,loaded:0,agility:30,experienceLevel:1}]});
 const paused=endTurn(b);assert.equal(paused.phase,'interrupt');assert.equal(paused.units[1].departure,undefined);assert.equal(paused.units[1].routed,true);assert.equal(paused.units[1].ap,b.units[1].ap-8);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),n=endTurn(saved);assert.deepEqual(n,endTurn(paused));assert.ok(n.units[1].departure);assert.equal(n.units[1].ap,b.units[1].ap-16);assert.equal(n.elapsedSeconds,6);
});
test('a visible fleeing enemy is a legal firearm or blade target while surrendered people cannot fight',()=>{
 for(const weapon of [1800,1809]){const b=fixture([{id:'p',x:0,y:2,weapon}],{seed:45,enemies:[{id:'router',x:1,y:2,routed:true,weaponDropped:true,loaded:0}]});assert.equal(visibleEnemies(b).length,1);const n=actBattle(b,{type:'useItem',unitId:'p',targetId:'router'});assert.equal(n.lastError,null);assert.ok(n.units[1].hp<100);}
});
test('rout during exploration advances real movement time instead of remaining frozen through rests',()=>{
 const b=fixture([{id:'p',x:4,y:4,routed:true,weaponDropped:true,loaded:0},{id:'q',x:1,y:6}],{exploration:true,enemies:[],exits:[exits[0]]});const n=endTurn(b);
 assert.ok(n.units[0].departure);assert.equal(n.units[0].departure.edge,'W');assert.equal(n.elapsedSeconds,15);assert.equal(n.units[0].energy,100-5*movementEnergy(b.units[0],{type:'grass'},true));assert.equal(n.units[1].energy,100);assert.equal(n.actionDurationSeconds,undefined);assert.equal(n.actionTimeAppliedSeconds,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('routed soldiers stand before freeing entanglement and then use the remaining budget to flee',()=>{
 let b=fixture([{id:'p',x:0,y:6}],{enemies:[{id:'router',x:6,y:2,routed:true,weaponDropped:true,loaded:0,knockedDown:true,entangled:true,stance:'prone',movementMode:'prone'}]});
 b=endTurn(b);while(b.phase==='interrupt')b=endTurn(b);const u=b.units[1];assert.equal(u.knockedDown,false);assert.equal(u.entangled,false);assert.ok(u.departure||u.fleePath.length);assert.ok(u.ap<100);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('artillery crew cannot move onto a routed soldier or NPC',()=>{
 for(const npc of [false,true]){const b=fixture([{id:'p',x:3,y:3},{id:'q',x:4,y:3}],{enemies:[{id:'e',x:npc?8:5,y:3,routed:true}],artillery:[{id:'gun',x:3,y:4,type:'bronze4'}],npcs:npc?[{id:'civilian',name:'Vecino',x:5,y:3}]:[]});unchanged(b,{type:'artilleryMove',unitId:'p',gunId:'gun',x:4,y:4});}
});
test('a mounted departure cannot replace its horse receipt with null',()=>{
 const b=actBattle(fixture([{id:'p',x:0,y:2,mounted:true,mount:{id:'horse-1',stamina:90,condition:100}},{id:'q',x:1,y:5}],{exploration:true,enemies:[]}),request);
 b.units[0].departure.mountId=null;assert.throws(()=>validateBattleSnapshot(b));
});
test('snapshot exit arrival anchors must lie on the destination edge',()=>{
 for(const anchor of [{x:127,y:127},{x:14,y:0}]){const b=fixture();b.exits[0].entryAnchor=anchor;assert.throws(()=>validateBattleSnapshot(b));}
});
test('an explicit missing or departed item target never falls back to treating self or throwing at old coordinates',()=>{
 let b=fixture([{id:'p',x:0,y:2},{id:'q',x:1,y:2,hp:80,bleeding:3}],{exploration:true,enemies:[]});b=actBattle(b,request);
 for(const slot of ['medical','supply']){const held=actBattle(b,{type:'weapon',unitId:'q',slot,...(slot==='supply'?{supplyKey:'torches'}:{})});for(const targetId of ['p','missing'])unchanged(held,{type:'useItem',unitId:'q',targetId,x:0,y:2});}
});
