import {sectorExits} from '../game/tactical-exits.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,prisonerReleasePreview} from '../game/tactical.js';
import {detentionManifest} from '../game/detention.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {advanceNpc} from '../game/npc-ai.js';
function field({exploration=false}={}){
 const npc=detentionManifest({operativeState:{3:{captured:true,alive:true,capturedAt:1,capturedSector:'tucuman',hp:40,maxHp:80,energy:80,bleeding:0,bandaged:40}}},[{id:3,name:'Prisionero',maxHp:80}],'tucuman')[0];
 const s=createBattle([{id:'rescuer',x:2,y:2,ap:50}],{width:12,height:8,exploration,enemies:exploration?[]:[{id:'guard',x:10,y:6,weapon:0,patrol:false}],npcs:[{...npc,x:3,y:2}]});s.battleId='prison-test';s.sectorId='tucuman';return s;
}
const free=s=>actBattle(s,{type:'free',unitId:'rescuer',targetKind:'npc',targetId:s.npcs[0].id});
test('adjacent release pays 15 AP and retains health, equipment custody and a loadable receipt',()=>{
 const s=field(),before=structuredClone(s),next=free(s);assert.equal(next.lastError,null);assert.equal(next.units[0].ap,s.units[0].ap-15);assert.equal(next.npcs[0].detention.freed,true);assert.equal(next.npcs[0].hp,40);assert.deepEqual(next.npcs[0].escort,{leaderId:'rescuer',waiting:false});assert.deepEqual(s,before);assert.equal(next.npcs[0].weapon,undefined);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(next)));assert.deepEqual(restored.npcs,next.npcs);assert.ok(free(restored).lastError);
 for(const alter of [n=>delete n.detentionRelease,n=>{n.detentionRelease.paidAP=0;},n=>{n.detentionRelease.leader.x=9;},n=>{n.escort.leaderId='guard';}]){const forged=structuredClone(next);alter(forged.npcs[0]);assert.throws(()=>validateBattleSnapshot(forged));}
});
test('release cannot bypass proximity, posture, AP or captivity',()=>{
 for(const alter of [s=>{s.units[0].x=0;},s=>{s.units[0].stance='prone';},s=>{s.units[0].ap=14;},s=>{s.units[0].entangled=true;},s=>{delete s.npcs[0].detention;}]){const s=field();alter(s);assert.equal(prisonerReleasePreview(s,s.units[0],s.npcs[0]).valid,false);const next=free(s);assert.ok(next.lastError);assert.equal(next.units[0].ap,s.units[0].ap);assert.equal(next.npcs[0].detentionRelease,undefined);}
});
test('exploration release spends time and a freed prisoner follows through ordinary finite movement',()=>{
 const s=field({exploration:true}),next=free(s);assert.equal(next.lastError,null);assert.equal(next.elapsedSeconds,s.elapsedSeconds+1);assert.equal(next.units[0].ap,s.units[0].ap);
 const moved=actBattle(next,{type:'move',unitId:'rescuer',x:7,y:2});assert.equal(moved.lastError,null);const npc=moved.npcs[0],before={x:npc.x,y:npc.y};advanceNpc(moved,npc,24);assert.ok(npc.lastMovePath.length<=3);assert.ok(Math.hypot(npc.x-7,npc.y-2)<Math.hypot(before.x-7,before.y-2));assert.notDeepEqual([npc.x,npc.y],[7,2]);
});

test('a freed prisoner can wait and accept a nearby replacement leader without changing the release receipt',()=>{
 let s=free(field());const receipt=structuredClone(s.npcs[0].detentionRelease),ap=s.units[0].ap;
 const order=(state,unitId,escortOrder)=>actBattle(state,{type:'prisonerEscort',unitId,targetKind:'npc',targetId:state.npcs[0].id,escortOrder});
 s=order(s,'rescuer','wait');assert.equal(s.lastError,null);assert.equal(s.units[0].ap,ap-2);assert.equal(s.npcs[0].escort.waiting,true);
 const before={x:s.npcs[0].x,y:s.npcs[0].y};s.units[0].x=7;advanceNpc(s,s.npcs[0],24);assert.deepEqual({x:s.npcs[0].x,y:s.npcs[0].y},before);
 assert.ok(order(s,'rescuer','follow').lastError);s.units[0].hp=0;
 s.units.push({...structuredClone(field().units[0]),id:'replacement',x:3,y:3});
 s=order(s,'replacement','follow');assert.equal(s.lastError,null);assert.deepEqual(s.npcs[0].escort,{leaderId:'replacement',waiting:false});assert.deepEqual(s.npcs[0].detentionRelease,receipt);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(s))).npcs,s.npcs);
 for(const alter of [n=>delete n.detentionOrders,n=>{n.detentionOrders[1].paidAP=0;},n=>{n.detentionOrders[1].leader.x=10;},n=>{n.detentionOrders.reverse();}]){const invalid=structuredClone(s);alter(invalid.npcs[0]);assert.throws(()=>validateBattleSnapshot(invalid));}
});


test('a freed prisoner crosses only beside the departing rescuer at an authorized boundary',()=>{
 const atExit=()=>{const s=free(field());s.exits=sectorExits('tucuman');s.units[0].x=2;s.units[0].y=0;s.npcs[0].x=3;s.npcs[0].y=0;return s;};
 const escape=s=>actBattle(s,{type:'exit',unitIds:['rescuer'],exitId:'tucuman:salta'});
 const s=atExit(),before=s.npcs[0].energy,next=escape(s);assert.equal(next.lastError,null);assert.equal(next.npcs[0].departure.destination,'salta');assert.equal(next.npcs[0].energy,before-1);assert.equal(next.status,'retreat');
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))).npcs,next.npcs);
 for(const mutate of [n=>{n.y=1;},n=>{n.escort.waiting=true;},n=>{n.energy=1;},n=>{n.entangled=true;},n=>{n.knockedDown=true;}]){const trial=atExit();mutate(trial.npcs[0]);assert.equal(escape(trial).npcs[0].departure,undefined);}
 for(const mutate of [n=>delete n.detentionEscape,n=>{n.departure.destination='cordoba';},n=>{n.detentionEscape.leader.x=9;},n=>{n.departure.elapsedSeconds++;}]){const forged=structuredClone(next);mutate(forged.npcs[0]);assert.throws(()=>validateBattleSnapshot(forged));}
});

test('ordinary exploration movement brings the released follower to a joint boundary crossing',()=>{
 let s=field({exploration:true});s.exits=sectorExits('tucuman');s=free(s);
 for(const [x,y]of [[3,0],[5,0]]){s=actBattle(s,{type:'move',unitId:'rescuer',x,y});assert.equal(s.lastError,null);}
 s=actBattle(s,{type:'rest',unitId:'rescuer'});assert.equal(s.lastError,null);
 assert.equal(s.npcs[0].y,0);assert.equal(Math.abs(s.npcs[0].x-s.units[0].x),1);
 s=actBattle(s,{type:'exit',unitIds:['rescuer'],exitId:'tucuman:salta'});assert.equal(s.lastError,null);assert.equal(s.npcs[0].departure.destination,'salta');assert.equal(s.units[0].departure.destination,'salta');
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(s))).npcs,s.npcs);
});
