// Player test orders can use a teammate's current sighting. Enemy autonomy
// retains personal sight. Every crew, shot, pivot and reload uses engine rules.
import {artilleryProfile} from '../game/artillery-definitions.js';
import {isUnconscious} from '../game/actor-condition.js';
import {artilleryCosts,artilleryContact,artilleryCrewPlan,artilleryReloadPreview,artilleryShotTrace,artilleryCanisterContains,teamCanSee,hasLineOfSight,getReachable,stanceCost} from '../game/tactical.js';
import {sameSurface,tacticalLevel} from '../game/tactical-space.js';
import {moveOrder} from '../game/tactical-planning-space.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=u=>u.hp>=15&&!u.unconscious&&!isUnconscious(u)&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered&&!u.knockedDown&&!u.entangled&&!u.mounted&&tacticalLevel(u)===0;
const compareId=(a,b)=>String(a.id).localeCompare(String(b.id));
const near=artilleryContact;

// Reserve only the required nearest local soldiers, within the same control
// group. This is a fresh decision, not a saved job or knowledge of enemy gear.
function localPost(s,u){
 if(!available(u))return null;
 const guns=(s.artillery??[]).filter(g=>g.side===u.side&&tacticalLevel(g)===0&&(g.loaded||g.ammo>0)&&distance(u,g)<=6).sort((a,b)=>distance(u,a)-distance(u,b)||compareId(a,b));
 for(const gun of guns){
  const members=s.units.filter(v=>v.side===u.side&&Boolean(v.militia)===Boolean(u.militia)&&available(v)&&distance(v,gun)<=6&&hasLineOfSight(s,v,gun))
   .sort((a,b)=>distance(a,gun)-distance(b,gun)||compareId(a,b)).slice(0,artilleryProfile(s,gun).crew);
  if(members.length===artilleryProfile(s,gun).crew&&members.some(v=>v.id===u.id))return gun;
 }
 return null;
}
export function teamArtilleryOrder(s,u,targets,paths){
 const gun=localPost(s,u);if(!gun||targets.some(v=>sameSurface(u,v)&&distance(u,v)<=2.5))return null;
 // A loaded gun is not a search objective for the hired advancing force.
 // Otherwise its scout leaves to find contact and immediately walks back on
 // the next decision, spending the whole battle between the same two cells.
 if(u.side==='player'&&!u.militia&&gun.loaded&&!targets.some(v=>tacticalLevel(v)===0&&distance(gun,v)<=artilleryProfile(s,gun).range))return null;
 const reacting=s.phase==='interrupt'||Boolean(s.reactionStack?.length);
 const perceived={...s,units:s.units.filter(v=>v.side===u.side||teamCanSee(s,u.side,v)),npcs:(s.npcs??[]).filter(n=>(n.hp??100)>0&&!n.departure&&!n.fled&&teamCanSee(s,u.side,n))};
 if(!near(s,u,gun)){
  if(reacting)return null;
  const routes=(paths?paths():getReachable(perceived,u)).filter(p=>p.cost>0&&p.cost<=Math.min(24,u.ap)&&p.path.length<=3&&distance(p,gun)<distance(u,gun)&&p.path.every(step=>!targets.some(v=>sameSurface(step,v)&&distance(step,v)<=2.5)));
  routes.sort((a,b)=>Number(near(perceived,{...u,...b},gun))-Number(near(perceived,{...u,...a},gun))||distance(a,gun)-distance(b,gun)||a.cost-b.cost||a.y-b.y||a.x-b.x);
  return routes[0]?moveOrder(s,u,routes[0]):null;
 }
 // Crew members must pay to rise before they can handle the gun.
 if(u.stance==='prone')return u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
 // Preparation is useful without contact, but never fire at an old sighting.
 if(!gun.loaded){const load=artilleryReloadPreview(s,u,gun);return load.valid?{type:'artilleryReload',unitId:u.id,artilleryId:gun.id}:null;}
 const costs=artilleryCosts(s,u,gun),choices=[];
 const civilians=perceived.npcs;
 for(const target of [...targets].sort(compareId)){
  if(target.hp<15||target.unconscious||isUnconscious(target)||target.routed||target.surrendered||tacticalLevel(target)!==0||!teamCanSee(s,u.side,target)||distance(gun,target)<1||distance(gun,target)>artilleryProfile(s,gun).range)continue;
  const angle=Math.atan2(target.y-gun.y,target.x-gun.x),pivot=Number.isFinite(gun.facing)&&Math.abs(Math.atan2(Math.sin(angle-gun.facing),Math.cos(angle-gun.facing)))>Math.PI/4;
  if(artilleryCrewPlan(s,u,gun,costs.fire+(pivot?costs.pivot:0)).reason)continue;
  for(const mode of ['solid','canister']){
   const trace=artilleryShotTrace(perceived,u,gun,target,mode),impacts=trace.events.filter(e=>e.type==='impact');
   // Include the whole cone and penetrating line, not only the aimed person.
   if(impacts.some(hit=>{if(hit.victimKind==='npc')return true;const v=perceived.units.find(v=>v.id===hit.unitId);return v.side===u.side||v.surrendered||v.routed||v.unconscious||isUnconscious(v);}))continue;
   if(civilians.some(n=>mode==='canister'?artilleryCanisterContains(s,gun,target,n):tacticalLevel(n)===0&&trace.cells.some(p=>p.x===n.x&&p.y===n.y)))continue;
   if(!impacts.some(hit=>hit.unitId===target.id))continue;
   const damage=impacts.reduce((sum,hit)=>sum+Math.min(hit.damage,perceived.units.find(v=>v.id===hit.unitId).hp),0);
   choices.push({score:damage-(costs.fire+(pivot?costs.pivot:0))*.2,order:{type:pivot?'artilleryPivot':'artillery',unitId:u.id,artilleryId:gun.id,x:target.x,y:target.y,...(!pivot?{mode}:{})}});
  }
 }
 choices.sort((a,b)=>b.score-a.score);
 return choices[0]?.order??null;
}
