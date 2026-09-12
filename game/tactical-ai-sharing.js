import {canSee,hasLineOfSight,weaponFor,transferPreview,actionCosts} from './tactical.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=u=>u.hp>0&&!u.unconscious&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered;
const present=u=>u.hp>0&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered;
const observed=(state,u,other)=>distance(u,other)<=1.5&&hasLineOfSight(state,u,other)||canSee(state,u,other);
const compareId=(a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0;

// Donors act with their own AP and finite pack. No remote requests or supply
// promises survive a move: every decision checks the current field again.
export function chooseSupplySharingAction(state,unit,targets,paths){
  if(!available(unit)||unit.knockedDown||unit.entangled||unit.ap<4)return null;
  const ownCapacity=unit.weaponDropped?0:weaponFor({...unit,activeSlot:'primary'}).capacity??0;
  const spareAmmo=Math.max(0,(unit.ammo??0)-Math.max(0,ownCapacity-(unit.loaded??0)));
  const spareDressings=Math.max(0,(unit.medkits??0)-(unit.medical>0?1:0));
  if(!spareAmmo&&!spareDressings)return null;
  const allies=state.units.filter(other=>other.id!==unit.id&&other.side===unit.side&&available(other)&&
    !other.knockedDown&&!other.entangled&&distance(unit,other)<=5&&observed(state,unit,other)).sort(compareId);
  const needs=[];
  for(const ally of allies){
    const capacity=ally.weaponDropped?0:weaponFor({...ally,activeSlot:'primary'}).capacity??0;
    if(spareAmmo&&capacity>0&&!ally.jammed&&ally.loaded===0&&ally.ammo===0)
      needs.push({ally,item:'ammo',count:Math.min(capacity,spareAmmo),priority:1});
    if(spareDressings&&ally.medical>0&&ally.medkits===0){
      // A dressing has a present purpose only when the recipient can reach a
      // bleeding patient at hand and enough AP to treat this turn. A handover
      // must not consume a rescue opportunity for a medic who cannot act.
      // Do not inspect unseen casualties for demand.
      const patients=state.units.filter(p=>p.side===unit.side&&present(p)&&p.bleeding>0&&
        distance(ally,p)<=1.5&&hasLineOfSight(state,ally,p)&&(p.id===unit.id||observed(state,unit,p)));
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
    const local=distance(unit,need.ally)<=1.5&&hasLineOfSight(state,unit,need.ally);
    if(!local&&!canApproach)continue;
    const route=local?{x:unit.x,y:unit.y,cost:0}:safeApproaches().filter(cell=>distance(cell,need.ally)<=1.5&&hasLineOfSight(state,cell,need.ally))
      .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
    if(!route)continue;
    for(let count=need.count;count>0;count--){
      const preview=transferPreview(state,{...unit,x:route.x,y:route.y,ap:unit.ap-route.cost},need.ally,need.item,count);
      if(!preview.valid||preview.kind!=='give')continue;
      choices.push({...need,count,route,action:local?{type:'transfer',unitId:unit.id,targetId:need.ally.id,item:need.item,count}:
        {type:'move',unitId:unit.id,x:route.x,y:route.y}});
      break;
    }
  }
  choices.sort((a,b)=>a.priority-b.priority||a.route.cost-b.route.cost||compareId(a.ally,b.ally));
  return choices[0]?.action??null;
}
