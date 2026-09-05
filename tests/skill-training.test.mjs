import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {validateTraining} from '../game/skill-training.js';
const make=(raw={},sector={})=>createBattle([{id:1000,x:1,y:1,weapon:1800,marksmanship:70,medical:40,mechanical:40,...raw}],{exploration:true,width:20,height:16,seed:7,enemies:[],...sector});
test('a real discharged round advances marksmanship while invalid repeat fire cannot farm practice',()=>{
 let s=make({skillPractice:{marksmanship:39}},{enemies:[{id:'e',x:4,y:1}]});
 s=actBattle(s,{type:'fire',unitId:1000,targetId:'e'});assert.equal(s.lastError,null);const u=s.units[0];assert.equal(u.marksmanship,71);assert.equal(u.trainedStats.marksmanship,1);assert.equal(u.loaded,0);
 const n=actBattle(s,{type:'fire',unitId:1000,targetId:'e'});assert.ok(n.lastError);assert.deepEqual(n.units[0].skillPractice,u.skillPractice);
 assert.doesNotThrow(()=>validateTraining(JSON.parse(JSON.stringify(u))));
});
test('finite successful healing and maintenance train relevant skills only',()=>{
 let s=make({hp:50,maxHp:100,condition:50,skillPractice:{medical:39,mechanical:39}});
 s=actBattle(s,{type:'heal',unitId:1000});assert.equal(s.units[0].medical,41);assert.equal(s.units[0].medkits,1);
 s=actBattle(s,{type:'repair',unitId:1000});assert.equal(s.units[0].mechanical,41);assert.equal(s.units[0].flints,3);
 s=actBattle(s,{type:'repair',unitId:1000});const before=structuredClone(s.units[0]);const n=actBattle(s,{type:'repair',unitId:1000});assert.ok(n.lastError);assert.deepEqual(n.units[0],before);
});
test('sneaking past unseen nearby enemies practices each tile only once',()=>{
 let s=make({skillPractice:{agility:39,stealth:39}},{night:true,enemies:[{id:'e',x:12,y:1}]});
 s=actBattle(s,{type:'move',unitId:1000,x:2,y:1,movement:'crouch'});assert.equal(s.lastError,null);assert.equal(s.units[0].agility,76);assert.equal(s.units[0].trainedStats.stealth,1);
 s=actBattle(s,{type:'move',unitId:1000,x:1,y:1,movement:'crouch'});const p=s.units[0].skillPractice.agility;s=actBattle(s,{type:'move',unitId:1000,x:2,y:1,movement:'crouch'});assert.equal(s.units[0].skillPractice.agility,p);
});
test('NPC cells block destinations and paths while adjacent interaction cells remain reachable',()=>{
 const s=make({}, {npcs:[{id:'civil',x:2,y:1}]});
 assert.ok(!getReachable(s,s.units[0]).some(p=>p.x===2&&p.y===1));
 assert.ok(getReachable(s,s.units[0]).some(p=>p.x===2&&p.y===2));
 assert.ok(actBattle(s,{type:'move',unitId:1000,x:2,y:1}).lastError);
});
test('ten earned points cap practice growth and malformed training is rejected',()=>{
 let s=make({hp:50,maxHp:100,medical:50,trainedStats:{medical:10},skillPractice:{medical:39}});
 s=actBattle(s,{type:'heal',unitId:1000});assert.equal(s.lastError,null);assert.equal(s.units[0].medical,50);assert.equal(s.units[0].trainedStats.medical,10);assert.equal(s.units[0].skillPractice.medical,39);
 assert.throws(()=>validateTraining({trainedStats:{medical:11}}));assert.throws(()=>validateTraining({skillPractice:{medical:-1}}));
});
test('real assigned mount movement trains riding once per tile and invalid moves grant nothing',()=>{
 let s=make({mounted:true,ridingSkill:40,mount:{id:'h',stamina:100,condition:100},skillPractice:{ridingSkill:39}});
 s=actBattle(s,{type:'move',unitId:1000,x:2,y:1});assert.equal(s.lastError,null);assert.equal(s.units[0].ridingSkill,41);assert.equal(s.units[0].trainedStats.ridingSkill,1);assert.ok(s.units[0].mount.stamina<100);
 s=actBattle(s,{type:'move',unitId:1000,x:1,y:1});const points=s.units[0].skillPractice.ridingSkill;s=actBattle(s,{type:'move',unitId:1000,x:2,y:1});assert.equal(s.units[0].skillPractice.ridingSkill,points);
 const invalid=actBattle(s,{type:'move',unitId:1000,x:-1,y:1});assert.ok(invalid.lastError);assert.deepEqual(invalid.units[0].skillPractice,s.units[0].skillPractice);
});
test('sector re-entry preserves separate sneaking and riding tile histories',async()=>{
 const {enterSector}=await import('../game/world.js');
 const request={sector:'retiro',exploration:true,squad:[{id:1000,weapon:1803,ridingSkill:41,trainedStats:{ridingSkill:1},skillPractice:{ridingSkill:2}}]};
 const previous=enterSector(request);previous.units[0].practiceTiles=['2,1'];previous.units[0].ridingPracticeTiles=['3,1'];
 const current=enterSector(request,JSON.parse(JSON.stringify(previous)));assert.deepEqual(current.units[0].practiceTiles,['2,1']);assert.deepEqual(current.units[0].ridingPracticeTiles,['3,1']);assert.equal(current.units[0].ridingSkill,41);assert.equal(current.units[0].skillPractice.ridingSkill,2);
});
