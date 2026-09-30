// Compare with a separate checkout through PROFILE_ROOT; leave both checkouts intact.
// Example: PROFILE_ROOT=/tmp/granaderos-motion-baseline node tools/benchmark-motion-routes.mjs
import {register} from 'node:module';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=process.env.PROFILE_ROOT??fileURLToPath(new URL('..',import.meta.url));
register(`${root}/tests/tactical-render-loader.mjs`,import.meta.url);
const {movementRoute}=await import(`${root}/web/app/useUnitMotion.ts`);
const {initialCampaign,dispatchCampaign}=await import(`${root}/game/campaign.js`);
const {enterSector}=await import(`${root}/game/world.js`);
const {actBattle,getReachable}=await import(`${root}/game/tactical.js`);
const {sameCell,tacticalLevel}=await import(`${root}/game/tactical-space.js`);

let campaign=initialCampaign(8);
for(const id of [128,142,123,115,131,110])campaign=dispatchCampaign(campaign,{type:'recruitCivic',id,term:'day'});
campaign=dispatchCampaign(campaign,{type:'attack',sector:'buenos_aires'});
let state={...enterSector(campaign.pendingBattle),night:true};
const ambient=[];
for(let i=0;i<10;i++){
 const next=actBattle(state,{type:'ambient'});ambient.push([state,next]);state=next;
}
const initial=ambient[0][0],unit=initial.units[0];
const destination=getReachable(initial,unit).filter(point=>point.path.length===17).sort((a,b)=>a.cost-b.cost)[0];
const moved=actBattle(initial,{type:'move',unitId:unit.id,x:destination.x,y:destination.y,tacticalLevel:tacticalLevel(destination)});
if(moved.lastError||!sameCell(moved.units[0],destination))throw Error('The fixture must complete its ordinary seventeen-cell move.');

const summary=[];
for(const [name,pairs]of [['ambient',ambient],['seventeenStepMove',[[initial,moved]]]]){
 const timings=[],hashes=[],changedActors=[];
 for(let iteration=0;iteration<13;iteration++)for(const [before,after]of pairs){
  const old=[...before.units,...before.npcs];
  const actors=[...after.units,...after.npcs].filter(actor=>old.some(previous=>previous.id===actor.id&&!sameCell(previous,actor)));
  // Match the effect's per-actor lookup and movementRoute calls. State updates,
  // output hashing, React rendering, and browser paint are outside this timer.
  const start=performance.now();
  const paths=actors.map(actor=>({id:actor.id,path:movementRoute(before,old.find(previous=>previous.id===actor.id),actor)}));
  const ms=performance.now()-start;
  if(iteration>=3){timings.push(ms);hashes.push(createHash('sha256').update(JSON.stringify(paths)).digest('hex'));changedActors.push(actors.length);}
 }
 timings.sort((a,b)=>a-b);
 summary.push({name,samples:timings.length,median:timings[Math.floor(timings.length/2)],mean:timings.reduce((sum,ms)=>sum+ms,0)/timings.length,max:timings.at(-1),changedActors,hashes});
}
console.log(JSON.stringify(summary,null,2));
