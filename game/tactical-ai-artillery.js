import {ARTILLERY,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview,artilleryShotTrace,artilleryCanisterContains,canSee,hasLineOfSight,movementStepCost} from './tactical.js';
import {sameSurface,tacticalLevel} from './tactical-space.js';
import {moveOrder} from './tactical-planning-space.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=u=>u.hp>=15&&!u.unconscious&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered&&!u.knockedDown&&!u.entangled&&!u.mounted&&tacticalLevel(u)===0;
const compareId=(a,b)=>String(a.id).localeCompare(String(b.id));
const near=(s,u,g)=>distance(u,g)<=1.5&&hasLineOfSight(s,u,g)&&(distance(u,g)===0||Number.isFinite(movementStepCost(s,u,u,g)));

// Reserve only the required nearest local soldiers, within the same control
// group. This is a fresh decision, not a saved job or knowledge of enemy gear.
function localPost(s,u){
 if(!available(u))return null;
 const guns=(s.artillery??[]).filter(g=>g.side===u.side&&tacticalLevel(g)===0&&(g.loaded||g.ammo>0)&&distance(u,g)<=6).sort((a,b)=>distance(u,a)-distance(u,b)||compareId(a,b));
 for(const gun of guns){
  const members=s.units.filter(v=>v.side===u.side&&Boolean(v.militia)===Boolean(u.militia)&&available(v)&&distance(v,gun)<=6&&hasLineOfSight(s,v,gun))
   .sort((a,b)=>distance(a,gun)-distance(b,gun)||compareId(a,b)).slice(0,ARTILLERY[gun.type].crew);
  if(members.length===ARTILLERY[gun.type].crew&&members.some(v=>v.id===u.id))return gun;
 }
 return null;
}
export function holdsArtilleryPost(s,u){
 // Autonomous local defenders guard a serviceable emplacement. The hired
 // force's optional auto-resolve can still search for an unseen opponent.
 if(u.side==='player'&&!u.militia)return false;
 const gun=localPost(s,u);return Boolean(gun&&near(s,u,gun));
}
export function chooseArtilleryAction(s,u,targets,paths){
 const gun=localPost(s,u);if(!gun||targets.some(v=>sameSurface(u,v)&&distance(u,v)<=2.5))return null;
 // A loaded gun is not a search objective for the hired advancing force.
 // Otherwise its scout leaves to find contact and immediately walks back on
 // the next decision, spending the whole battle between the same two cells.
 if(u.side==='player'&&!u.militia&&gun.loaded&&!targets.some(v=>tacticalLevel(v)===0&&distance(gun,v)<=ARTILLERY[gun.type].range))return null;
 const reacting=s.phase==='interrupt'||Boolean(s.reactionStack?.length);
 const perceived={...s,units:s.units.filter(v=>v.side===u.side||canSee(s,u,v)),npcs:(s.npcs??[]).filter(n=>(n.hp??100)>0&&!n.departure&&!n.fled&&canSee(s,u,n))};
 if(!near(s,u,gun)){
  if(reacting)return null;
  const routes=paths().filter(p=>p.cost>0&&p.cost<=Math.min(24,u.ap)&&p.path.length<=3&&near(perceived,{...u,...p},gun)&&p.path.every(step=>!targets.some(v=>sameSurface(step,v)&&distance(step,v)<=2.5)));
  routes.sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);
  return routes[0]?moveOrder(s,u,routes[0]):null;
 }
 // Preparation is useful without contact, but never fire at an old sighting.
 if(!gun.loaded){const load=artilleryReloadPreview(s,u,gun);return load.valid?{type:'artilleryReload',unitId:u.id,artilleryId:gun.id}:null;}
 const costs=artilleryCosts(s,u,gun),choices=[];
 const civilians=perceived.npcs;
 for(const target of [...targets].sort(compareId)){
  if(tacticalLevel(target)!==0||!canSee(s,u,target)||distance(gun,target)<1||distance(gun,target)>ARTILLERY[gun.type].range)continue;
  const angle=Math.atan2(target.y-gun.y,target.x-gun.x),pivot=Number.isFinite(gun.facing)&&Math.abs(Math.atan2(Math.sin(angle-gun.facing),Math.cos(angle-gun.facing)))>Math.PI/4;
  if(artilleryCrewPlan(s,u,gun,costs.fire+(pivot?costs.pivot:0)).reason)continue;
  for(const mode of ['solid','canister']){
   const trace=artilleryShotTrace(perceived,u,gun,target,mode),impacts=trace.events.filter(e=>e.type==='impact');
   // Include the whole cone and penetrating line, not only the aimed person.
   if(impacts.some(hit=>{if(hit.victimKind==='npc')return true;const v=perceived.units.find(v=>v.id===hit.unitId);return v.side===u.side||v.surrendered||v.routed||v.unconscious;}))continue;
   if(civilians.some(n=>mode==='canister'?artilleryCanisterContains(s,gun,target,n):tacticalLevel(n)===0&&trace.cells.some(p=>p.x===n.x&&p.y===n.y)))continue;
   if(!impacts.some(hit=>hit.unitId===target.id))continue;
   const damage=impacts.reduce((sum,hit)=>sum+Math.min(hit.damage,perceived.units.find(v=>v.id===hit.unitId).hp),0);
   choices.push({score:damage-(costs.fire+(pivot?costs.pivot:0))*.2,order:{type:pivot?'artilleryPivot':'artillery',unitId:u.id,artilleryId:gun.id,x:target.x,y:target.y,...(!pivot?{mode}:{})}});
  }
 }
 choices.sort((a,b)=>b.score-a.score);
 return choices[0]?.order??null;
}
