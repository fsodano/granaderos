import {atHand,moveOrder,planningPoint} from './tactical-planning-space.js';
import {canSee,hasLineOfSight,weaponFor,transferPreview,actionCosts} from './tactical.js';
import {ammunitionByType,weaponAmmoType} from './ammunition-types.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=u=>u.hp>0&&!u.unconscious&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered;
const present=u=>u.hp>0&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered;
const observed=(state,u,other)=>atHand(u,other)&&hasLineOfSight(state,u,other)||canSee(state,u,other);
const compareId=(a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0;

// Donors act with their own AP and finite pack. No remote requests or supply
// promises survive a move: every decision checks the current field again.
export function chooseSupplySharingAction(state,unit,targets,paths){
  if(!available(unit)||unit.knockedDown||unit.entangled||unit.ap<4)return null;
  const reserve=ammunitionByType(unit),needed={};
  // Each owned gun retains its next full load in its own caliber. A second
  // pistol may use different cartridges; a derived display total is no stock.
  const ownGuns=[...(!unit.weaponDropped?[{weapon:unit.weapon,loaded:unit.loaded}]:[]),...(unit.offHand?[unit.offHand]:[])];
  for(const gun of ownGuns){const type=weaponAmmoType(gun.weapon),capacity=weaponFor({...unit,weapon:gun.weapon,activeSlot:'primary',weaponDropped:false}).capacity??0;if(type&&capacity>0)needed[type]=(needed[type]??0)+Math.max(0,capacity-(gun.loaded??0));}
  const spare=Object.fromEntries(Object.entries(reserve).map(([type,count])=>[type,Math.max(0,count-(needed[type]??0))]));
  const sources=Object.entries(unit.inventory??{}).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([,stack])=>stack?.kind==='ammunition'&&stack.count>0);
  const spareDressings=Math.max(0,(unit.medkits??0)-(unit.medical>0?1:0));
  if(!Object.values(spare).some(count=>count>0)&&!spareDressings)return null;
  const allies=state.units.filter(other=>other.id!==unit.id&&other.side===unit.side&&available(other)&&
    !other.knockedDown&&!other.entangled&&distance(unit,other)<=5&&observed(state,unit,other)).sort(compareId);
  const needs=[];
  for(const ally of allies){
    const capacity=ally.weaponDropped?0:weaponFor({...ally,activeSlot:'primary'}).capacity??0;
    const type=weaponAmmoType(ally.weapon);
    if(type&&spare[type]>0&&capacity>0&&!ally.jammed&&ally.loaded===0&&!(ammunitionByType(ally)[type]>0))
      for(const [key,stack] of sources)if(stack.ammoType===type)needs.push({ally,item:`inventory:${key}`,count:Math.min(capacity,spare[type],stack.count),priority:1});
    if(spareDressings&&ally.medical>0&&ally.medkits===0){
      // A dressing has a present purpose only when the recipient can reach a
      // bleeding patient at hand and enough AP to treat this turn. A handover
      // must not consume a rescue opportunity for a medic who cannot act.
      // Do not inspect unseen casualties for demand.
      const patients=state.units.filter(p=>p.side===unit.side&&present(p)&&p.bleeding>0&&
        atHand(ally,p)&&hasLineOfSight(state,ally,p)&&(p.id===unit.id||observed(state,unit,p)));
      const treatment=actionCosts(state,{...ally,activeSlot:'medical',medkits:1});
      const prepare=ally.activeSlot==='medical'?0:treatment.weapon;
      if(patients.length&&ally.ap>=prepare+treatment.heal)needs.push({ally,item:'medkits',count:1,priority:0});
    }
  }
  if(!needs.length)return null;
  const reacting=state.phase==='interrupt'||Boolean(state.reactionStack?.length);
  const recentContact=[unit.lastKnownEnemy,unit.lastHeardNoise].some(known=>known&&state.turn-known.turn>=0&&state.turn-known.turn<=3);
  // Passing to a neighbor is useful under fire. A multi-soldier supply trip
  // can pull a fighter away while the intended recipient takes other orders;
  // defer that trip until neither current nor recent contact is present.
  const canApproach=!reacting&&!targets.length&&!recentContact;
  const threats=targets.filter(other=>weaponFor(other).capacity>0);
  // Visible firearms remain threats regardless of their private load or AP.
  const exposure=point=>threats.filter(other=>canSee(state,other,{...unit,...point})).length;
  const currentExposure=exposure(unit);
  let approaches;
  const safeApproaches=()=>approaches??=paths().filter(cell=>cell.cost>0&&cell.cost<=24&&cell.path.length<=3&&cell.cost+4<=unit.ap&&
    cell.path.every(point=>!targets.some(other=>distance(point,other)<=2.5)&&exposure(point)<=currentExposure));
  const choices=[];
  for(const need of needs){
    const local=atHand(unit,need.ally)&&hasLineOfSight(state,unit,need.ally);
    if(!local&&!canApproach)continue;
    const route=local?{...planningPoint(unit),cost:0}:safeApproaches().filter(cell=>atHand(cell,need.ally)&&hasLineOfSight(state,cell,need.ally))
      .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
    if(!route)continue;
    for(let count=need.count;count>0;count--){
      const preview=transferPreview(state,{...unit,...planningPoint(route,Boolean(state.upperSurfaces?.length)),ap:unit.ap-route.cost},need.ally,need.item,count);
      if(!preview.valid||preview.kind!=='give')continue;
      choices.push({...need,count,route,action:local?{type:'transfer',unitId:unit.id,targetId:need.ally.id,item:need.item,count}:
        moveOrder(state,unit,route)});
      break;
    }
  }
  choices.sort((a,b)=>a.priority-b.priority||a.route.cost-b.route.cost||compareId(a.ally,b.ally));
  return choices[0]?.action??null;
}
