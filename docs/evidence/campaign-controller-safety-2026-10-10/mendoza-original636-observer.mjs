import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {enterSector} from '/Users/fsodano/fibradev/games/granaderos/game/world.js';
import {actBattle,endTurn,firearmShotOptions,firearmFlightPreview,canSee,actionCosts} from '/Users/fsodano/fibradev/games/granaderos/game/tactical.js';
const source='/Users/fsodano/fibradev/games/granaderos';
const capture='/tmp/granaderos-campaign-post-san-lorenzo-full-2026-10-10T064452281Z/native-failures/17926-1-mendoza-514-2591988814-9a6Ddj';
const output='/tmp/granaderos-mendoza-original636-replay-20261010';
mkdirSync(output);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>JSON.parse(readFileSync(`${capture}/${name}`,'utf8'));
const input=read('native-input.json'),result=read('native-result.json'),receipt=read('receipt.json');
const inputs=receipt.artifacts.filter(row=>['native-input.json','native-result.json'].includes(row.path)).map(row=>{
 const bytes=readFileSync(`${capture}/${row.path}`);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);return row;
});
assert.equal(inputs.length,2);assert.equal(result.orders.length,636);
const sources=['game/world.js','game/tactical.js','game/tactical-ai.js','game/civilian-ai.js','game/civilian-health.js','game/civilian-harm.js','game/projectiles.js'].filter(path=>{try{readFileSync(`${source}/${path}`);return true;}catch{return false;}}).map(path=>({path,sha256:sha(readFileSync(`${source}/${path}`))}));
let battle=enterSector(input.request,input.previous),changes=[],shotWitnesses=[],firstInjury=null;
const npc=state=>state.npcs.find(n=>n.operativeId===57);
const health=n=>({hp:n.hp,bleeding:n.bleeding??0,energy:n.energy,stance:n.stance,x:n.x,y:n.y,civilianHarm:n.civilianHarm??null});
const aidWitness=state=>state.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&u.medical>0&&u.medkits>0&&canSee(state,u,npc(state))).map(u=>({id:u.id,hp:u.hp,bleeding:u.bleeding??0,medical:u.medical,medkits:u.medkits,ap:u.ap,activeSlot:u.activeSlot,x:u.x,y:u.y,distance:Math.hypot(u.x-npc(state).x,u.y-npc(state).y),healCost:actionCosts(state,u).heal}));
const t0=Date.now();
for(let i=0;i<result.orders.length;i++){
 const order=result.orders[i],before=npc(battle),beforeHealth=health(before),visibleDoctors=before.hp>0&&before.hp<before.maxHp?aidWitness(battle):[];
 let shot=null;
 if(order.type==='fire'){
  const actor=battle.units.find(u=>u.id===order.unitId),target=battle.units.find(u=>u.id===order.targetId);
  if(actor&&target){
   const options=firearmShotOptions(battle,actor,target,order.aim??0);
   const preview=options.find(o=>o.aim===(order.aim??0)&&o.hitLocation===(order.hitLocation??'torso'));
   const flight=firearmFlightPreview(battle,actor,target,order.hitLocation??'torso');
   shot={orderIndex:i,order,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds,actor:{id:actor.id,hp:actor.hp,medical:actor.medical,medkits:actor.medkits,x:actor.x,y:actor.y,stance:actor.stance},target:{id:target.id,x:target.x,y:target.y,stance:target.stance},commander:beforeHealth,commanderVisible:canSee(battle,actor,before),preview,bodyImpacts:flight.bodyImpacts??[],visibleDoctors};
  }
 }
 const next=order.type==='endTurn'?endTurn(battle):actBattle(battle,order);assert.equal(next.lastError,null,JSON.stringify({i,order,error:next.lastError}));
 const after=npc(next),afterHealth=health(after);
 if(after.hp!==before.hp||(after.bleeding??0)!==(before.bleeding??0)){
  const row={orderIndex:i,order,turnBefore:battle.turn,turnAfter:next.turn,elapsedBefore:battle.elapsedSeconds,elapsedAfter:next.elapsedSeconds,before:beforeHealth,after:afterHealth,visibleDoctors};changes.push(row);
  if(firstInjury===null&&after.hp<before.hp)firstInjury=i;
  if(shot){shot.afterCommander=afterHealth;shotWitnesses.push(shot);writeFileSync(`${output}/before-commander-damage-order-${i}.json`,JSON.stringify({battle,order},null,2)+'\n');}
 }
 battle=next;
 if(i%100===0)process.stdout.write(JSON.stringify({progress:i,turn:battle.turn,commanderHp:npc(battle).hp})+'\n');
}
assert.deepEqual(battle,result.battle);
for(const row of sources)assert.equal(sha(readFileSync(`${source}/${row.path}`)),row.sha256);
const report={schemaVersion:1,completedAt:new Date().toISOString(),source,sourceRows:sources,inputs,orders:636,ordersReplayedExactly:true,terminalEqualsOriginal:true,commanderFirstInjuryOrder:firstInjury,changes,shotWitnesses,durationMs:Date.now()-t0,terminal:{status:battle.status,turn:battle.turn,commander:health(npc(battle))},scope:'Derived exact original636 tape replay. No original independent pre-decision witness; no controller, alternative action, campaign settlement or rule/resource/health/casualty change. Before-shot states derive from the bound retained request and exact prefix.'};
writeFileSync(`${output}/receipt.json`,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({finished:true,output,orders:636,changes:changes.length,shotWitnesses:shotWitnesses.length,terminalEqualsOriginal:true,durationMs:report.durationMs})+'\n');
