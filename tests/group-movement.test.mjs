import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {planGroupMove,executeGroupMove} from '../game/group-movement.js';
const map=(extra={})=>({width:24,height:10,seed:45,exploration:true,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[],...extra});
const formation=(extra={})=>createBattle([{id:'a',x:1,y:2,weight:0,ammo:0,loaded:0,weapon:0,medkits:0},{id:'b',x:1,y:3,weight:0,ammo:0,loaded:0,weapon:0,medkits:0},{id:'c',x:2,y:3,weight:0,ammo:0,loaded:0,weapon:0,medkits:0}],map(extra));
const request={unitIds:['a','b','c'],anchorId:'a',x:8,y:2};
const unit=(s,id)=>s.units.find(u=>u.id===id);
const cells=s=>s.units.filter(u=>u.hp>0).map(u=>`${u.x},${u.y}`);

test('formation preserves initial offsets, anchor-first selection order, and pure deterministic previews',()=>{
 const s=formation(),before=structuredClone(s),r={...request,unitIds:['c','b','a']},p=planGroupMove(s,r);
 assert.equal(p.ok,true);assert.deepEqual(p.members.map(m=>m.unitId),['a','c','b']);assert.deepEqual(p.members.map(m=>m.destination),[{x:8,y:2},{x:9,y:3},{x:8,y:3}]);assert.deepEqual(planGroupMove(s,r),p);assert.deepEqual(s,before);
});
test('group execution is exactly the sum of legal reducer orders with finite energy and no stacked units',()=>{
 const s=formation(),before=structuredClone(s),result=executeGroupMove(s,request);assert.equal(result.status,'completed');assert.equal(result.actions,3);/* Anchor: 7 straight steps. Each follower: 5 straight + 2 diagonal steps around an occupied cell. */assert.equal(result.elapsedSeconds,21+25+25);assert.equal(result.state.elapsedSeconds,s.elapsedSeconds+71);
 let replay=s;for(const action of result.orders)replay=actBattle(replay,action);assert.deepEqual(result.state,replay);assert.equal(new Set(cells(result.state)).size,3);assert.ok(result.members.every(m=>m.energyAfter<m.energyBefore));assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(result.state));assert.deepEqual(executeGroupMove(s,request),result);
});
test('formation has unique accessible fallbacks around a blocked destination and near a map edge',()=>{
 const s=formation();s.tiles.find(t=>t.x===8&&t.y===2).blocked=true;s.tiles.find(t=>t.x===8&&t.y===3).blocked=true;
 const p=planGroupMove(s,request),destinations=p.members.map(m=>`${m.destination.x},${m.destination.y}`);assert.equal(new Set(destinations).size,3);assert.ok(!destinations.includes('8,2'));assert.ok(!destinations.includes('8,3'));assert.ok(p.members.some(m=>m.reason));const result=executeGroupMove(s,request);assert.equal(result.status,'completed');assert.equal(new Set(cells(result.state)).size,3);
 const edge=planGroupMove(formation(),{...request,x:23,y:9});assert.equal(edge.ok,true);assert.ok(edge.members.every(m=>!m.destination||m.destination.x<24&&m.destination.y<10));assert.equal(new Set(edge.members.filter(m=>m.destination).map(m=>`${m.destination.x},${m.destination.y}`)).size,3);
});
test('a sealed route reports blocked members without moving, spending supplies, or changing the log',()=>{
 const s=formation();for(const t of s.tiles.filter(t=>t.x===4))t.blocked=true;
 const p=planGroupMove(s,request);assert.ok(p.members.every(m=>m.status==='blocked'));const result=executeGroupMove(s,request);assert.equal(result.status,'partial');assert.equal(result.actions,0);assert.strictEqual(result.state,s);assert.ok(result.members.every(m=>m.reason.includes('bloqueada')));
});
test('dead, unconscious, entangled, and fallen members stay in place with explicit reasons',()=>{
 const s=formation();Object.assign(unit(s,'b'),{hp:0,unconscious:false});Object.assign(unit(s,'c'),{energy:0,unconscious:true});const p=planGroupMove(s,request);assert.equal(p.members[1].status,'skipped');assert.match(p.members[1].reason,/caído/);assert.equal(p.members[2].status,'skipped');const result=executeGroupMove(s,request);assert.equal(result.status,'partial');assert.equal(result.actions,1);assert.deepEqual([unit(result.state,'b').x,unit(result.state,'b').y],[1,3]);assert.deepEqual([unit(result.state,'c').x,unit(result.state,'c').y],[2,3]);
 const tangled=formation();unit(tangled,'b').entangled=true;unit(tangled,'c').knockedDown=true;assert.ok(planGroupMove(tangled,request).members.slice(1).every(m=>m.status==='skipped'));
});
test('running exhaustion preserves completed paid steps while other capable members finish',()=>{
 const s=formation();unit(s,'a').energy=3;const r={...request,movement:'run'},result=executeGroupMove(s,r);assert.equal(result.status,'partial');assert.equal(result.members[0].status,'partial');assert.match(result.members[0].reason,/inconsciente|agotado/);assert.equal(unit(result.state,'a').energy,0);assert.equal(unit(result.state,'a').unconscious,true);assert.ok(unit(result.state,'a').x<8);assert.equal(unit(result.state,'a').hp,s.units[0].hp);assert.ok(result.members.slice(1).every(m=>m.status==='arrived'));assert.equal(new Set(cells(result.state)).size,3);assert.ok(result.elapsedSeconds>0);
 let replay=s;for(const action of result.orders)replay=actBattle(replay,action);assert.deepEqual(result.state,replay);
});
test('first real contact stops remaining members and preserves the initiating move and its time',()=>{
 const s=formation({enemies:[{id:'e',x:22,y:2,weapon:1800,marksmanship:0,facing:2}]});assert.equal(s.mode,'exploration');const r={...request,x:20},result=executeGroupMove(s,r);assert.equal(result.status,'contact');assert.equal(result.actions,1);assert.equal(result.state.mode,'combat');assert.ok(unit(result.state,'a').x<20);assert.ok(result.elapsedSeconds>0);assert.ok(result.members.slice(1).every(m=>m.status==='stopped'&&!m.moved));assert.deepEqual([unit(result.state,'b').x,unit(result.state,'b').y],[1,3]);assert.deepEqual(result.state,actBattle(s,result.orders[0]));assert.doesNotThrow(()=>validateBattleSnapshot(result.state));
});
test('hidden hostile positions cannot change or leak into destination and path previews',()=>{
 const left=formation({night:true,enemies:[{id:'hidden',x:20,y:2}]}),right=formation({night:true,enemies:[{id:'hidden',x:22,y:8}]}),empty=formation({night:true});const r={...request,x:20,y:2};assert.equal(left.mode,'exploration');assert.deepEqual(planGroupMove(left,r),planGroupMove(right,r));assert.deepEqual(planGroupMove(left,r),planGroupMove(empty,r));assert.ok(!JSON.stringify(planGroupMove(left,r)).includes('hidden'));
});
test('invalid inputs reject atomically and cannot inject enemy orders or change battle logs',()=>{
 const s=formation();for(const r of [null,{...request,unitIds:[]},{...request,unitIds:['a','a']},{...request,unitIds:['a','missing']},{...request,anchorId:'missing'},{...request,x:-1},{...request,y:1.2},{...request,movement:'teleport'},{...request,unitIds:[{}]}]){const before=structuredClone(s),result=executeGroupMove(s,r);assert.equal(result.status,'invalid');assert.strictEqual(result.state,s);assert.equal(result.elapsedSeconds,0);assert.equal(result.actions,0);assert.deepEqual(s,before);}
 const hostile=formation({night:true,enemies:[{id:'enemy',x:22,y:9}]});assert.equal(executeGroupMove(hostile,{...request,unitIds:['a','enemy']}).status,'invalid');
});
test('combat, interrupt, and terminal states require individual orders or a return to exploration first',()=>{
 for(const change of [{mode:'combat'},{phase:'interrupt',interrupt:{side:'player',unitIds:['a'],enemyId:'e'}},{status:'victory'},{status:'defeat'},{enemyTurn:{remainingIds:[]}}]){const s=Object.assign(formation(),change),before=structuredClone(s),result=executeGroupMove(s,request);assert.equal(result.status,'invalid');assert.strictEqual(result.state,s);assert.deepEqual(s,before);}
});
test('replanning a stale request respects new friendly blockers and does not trust supplied plan paths',()=>{
 const s=formation(),p=planGroupMove(s,request);s.npcs=[{id:'civilian',x:8,y:2}];const result=executeGroupMove(s,p.request);assert.equal(result.status,'completed');assert.notDeepEqual(result.members[0].to,{x:8,y:2});assert.ok(result.members[0].reason);assert.equal(new Set(cells(result.state)).size,3);
});
