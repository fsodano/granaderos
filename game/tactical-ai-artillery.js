import {ARTILLERY,artilleryCosts,artilleryContact,artilleryCrewPlan,artilleryReloadPreview,artilleryShotTrace,artilleryCanisterContains,canSee,hasLineOfSight,getReachable} from './tactical.js';
import {isUnconscious} from './actor-condition.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=u=>u.hp>=15&&!isUnconscious(u)&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered&&!u.knockedDown&&!u.entangled&&!u.mounted;
const compareId=(a,b)=>String(a.id).localeCompare(String(b.id));
function localPost(s,u){
 if(!available(u)||u.side==='player'&&!u.militia)return null;
 const guns=(s.artillery??[]).filter(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&distance(u,g)<=6).sort((a,b)=>distance(u,a)-distance(u,b)||compareId(a,b));
 for(const gun of guns){const count=ARTILLERY[gun.type].crew,members=s.units.filter(v=>v.side===u.side&&Boolean(v.militia)===Boolean(u.militia)&&available(v)&&distance(v,gun)<=6&&hasLineOfSight(s,v,gun)).sort((a,b)=>distance(a,gun)-distance(b,gun)||compareId(a,b)).slice(0,count);if(members.length===count&&members.some(v=>v.id===u.id))return gun;}
 return null;
}
export function holdsArtilleryPost(s,u){const gun=localPost(s,u);return Boolean(gun&&artilleryContact(s,u,gun));}
export function chooseArtilleryAction(s,u,targets){
 const gun=localPost(s,u);if(!gun||targets.some(v=>distance(u,v)<=2.5))return null;
 const perceived={...s,units:s.units.filter(v=>v.side===u.side||canSee(s,u,v)),npcs:(s.npcs??[]).filter(n=>(n.hp??100)>0&&!n.departure&&canSee(s,u,n))};
 if(!artilleryContact(s,u,gun)){
  const routes=getReachable(perceived,u).filter(p=>p.cost>0&&p.cost<=Math.min(24,u.ap)&&p.path.length<=3&&distance(p,gun)<distance(u,gun)&&p.path.every(step=>!targets.some(v=>distance(step,v)<=2.5))).sort((a,b)=>Number(artilleryContact(perceived,{...u,...b},gun))-Number(artilleryContact(perceived,{...u,...a},gun))||distance(a,gun)-distance(b,gun)||a.cost-b.cost||a.y-b.y||a.x-b.x);
  return routes[0]?{type:'move',unitId:u.id,x:routes[0].x,y:routes[0].y}:null;
 }
 if(u.stance==='prone')return u.ap>=6?{type:'stance',unitId:u.id,stance:'standing'}:null;
 if(!gun.loaded){const p=artilleryReloadPreview(s,u,gun);return p.valid?{type:'artilleryReload',unitId:u.id,artilleryId:gun.id}:null;}
 const costs=artilleryCosts(s,u,gun),choices=[];
 for(const target of [...targets].sort(compareId)){
  if(target.hp<15||target.surrendered||target.routed||isUnconscious(target)||!canSee(s,u,target)||distance(gun,target)<1||distance(gun,target)>ARTILLERY[gun.type].range)continue;
  const angle=Math.atan2(target.y-gun.y,target.x-gun.x),pivot=Number.isFinite(gun.facing)&&Math.abs(Math.atan2(Math.sin(angle-gun.facing),Math.cos(angle-gun.facing)))>Math.PI/4;
  if(artilleryCrewPlan(s,u,gun,costs.fire+(pivot?costs.pivot:0)).reason)continue;
  for(const mode of ['solid','canister']){
   const trace=artilleryShotTrace(perceived,u,gun,target,mode),impacts=trace.events.filter(e=>e.type==='impact');
   if(impacts.some(hit=>{if(hit.victimKind==='npc')return true;const v=perceived.units.find(v=>v.id===hit.unitId);return v.side===u.side||v.surrendered||v.routed||isUnconscious(v);}))continue;
   if(perceived.npcs.some(n=>mode==='canister'?artilleryCanisterContains(s,gun,target,n):trace.cells.some(p=>p.x===n.x&&p.y===n.y)))continue;
   if(!impacts.some(hit=>hit.unitId===target.id))continue;
   const damage=impacts.reduce((sum,hit)=>sum+Math.min(hit.damage,perceived.units.find(v=>v.id===hit.unitId).hp),0);
   choices.push({score:damage-(costs.fire+(pivot?costs.pivot:0))*.2,order:{type:pivot?'artilleryPivot':'artillery',unitId:u.id,artilleryId:gun.id,x:target.x,y:target.y,...(!pivot?{mode}:{})}});
  }
 }
 choices.sort((a,b)=>b.score-a.score);return choices[0]?.order??null;
}
