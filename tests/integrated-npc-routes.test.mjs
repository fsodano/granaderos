import test from 'node:test';
import assert from 'node:assert/strict';
import {npcRoutes,advanceNpc,runCivilianPhase} from '../game/npc-ai.js';
const corridor=()=>{
 const actor={id:'speaker',name:'Anfitrión',hp:100,energy:100,x:1,y:0,scriptedMove:{target:{x:5,y:0}}};
 return {width:7,height:1,phase:'player',tiles:Array.from({length:7},(_,x)=>({x,y:0,type:'grass',blocked:false})),units:[],npcs:[actor],props:[],buildings:[],elapsedSeconds:0};
};
test('scripted civilian movement waits for every living occupant and can cross dead bodies',()=>{
 for(const owner of ['units','npcs'])for(const condition of [{hp:100},{hp:1,unconscious:true},{hp:100,routed:true},{hp:100,surrendered:true}]){
  const s=corridor(),actor=s.npcs[0],blocker={id:'blocker',x:3,y:0,...condition};s[owner].push(blocker);
  assert.equal(npcRoutes(s,actor).records.has('5,0'),false);
  advanceNpc(s,actor,80);assert.equal(actor.x,1);assert.equal(actor.ai.activity,'meeting');
  blocker.hp=0;advanceNpc(s,actor,80);assert.equal(actor.x,5);assert.equal(actor.ai.activity,'meeting');
  assert.deepEqual(actor.lastMovePath.map(p=>p.x),[2,3,4,5]);
 }
});
test('a released occupant no longer blocks the civilian route',()=>{
 for(const status of [{fled:true},{departure:{edge:'W'}}]){
  const s=corridor();s.units.push({id:'gone',x:3,y:0,hp:100,...status});
  advanceNpc(s,s.npcs[0],80);assert.equal(s.npcs[0].x,5);
 }
});
test('breath recovery does not move an unconscious resident in the same phase',()=>{
 const s=corridor(),n=s.npcs[0];Object.assign(n,{civilianHealthVersion:1,maxHp:100,energy:0,unconscious:true});
 runCivilianPhase(s);assert.equal(n.x,1);assert.equal(n.energy,10);assert.equal(n.unconscious,false);assert.equal(s.phase,'player');
 runCivilianPhase(s);assert.equal(n.x,4);assert.equal(n.ai.activity,'meeting');
});
