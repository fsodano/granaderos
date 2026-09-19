import {canSee,grenadeThrowPreview,planReadyMainHand,weaponFor} from './tactical.js';
import {heldGrenade,GRENADE_THROW,grenadeScatterRadius} from './grenade-throw.js';
import {isGrenadeStack} from './grenades.js';
import {grenadeFlight,grenadeBlastExposure} from './grenade-flight.js';
import {surfaceAt,tacticalLevel} from './tactical-space.js';

// Known targets, owned supplies and the ordinary paid equip/stand/throw orders.
// Safety includes every supported miss destination, not just the chosen point.
export function chooseGrenadeThrow(state,unit,targets){
 if(unit.mounted||unit.knockedDown||unit.equipmentCursor||!targets.length)return null;
 const choices=[],held=heldGrenade(unit);
 if(held)choices.push({unit,grenade:held,equip:null});
 else for(const [key,stack] of Object.entries(unit.inventory??{}).sort(([a],[b])=>a.localeCompare(b))){
  if(!isGrenadeStack(stack)||stack.count<1||stack.condition<50)continue;
  try{
   const ready=planReadyMainHand(unit,`inventory:${key}`);ready.ap-=4;
   choices.push({unit:ready,grenade:heldGrenade(ready),equip:{type:'weapon',unitId:unit.id,slot:'item',item:`inventory:${key}`}});
  }catch{/* A full pack must not lose its displaced weapon. */}
 }
 if(!choices.length)return null;
 const known=targets.filter(t=>t.side!==unit.side&&t.hp>0&&!t.unconscious&&!t.departure&&!t.fled&&!t.routed&&!t.surrendered&&canSee(state,unit,t));
 const protectedPeople=[...state.units.filter(t=>t.hp>0&&!t.departure&&!t.fled&&(t.side===unit.side||t.surrendered||t.unconscious)&&
   (t.side===unit.side||canSee(state,unit,t))),...(state.npcs??[]).filter(n=>(n.hp??100)>0&&!n.departure&&!n.fled&&canSee(state,unit,n))];
 const planning={...state,phase:unit.side==='enemy'?'enemy':'player'};
 let best=null;
 for(const candidate of choices){
  if(!candidate.grenade||candidate.grenade.record.condition<50)continue;
  for(const target of known.slice(0,12)){
   const point={x:target.x,y:target.y,tacticalLevel:tacticalLevel(target)},plan=grenadeThrowPreview(planning,candidate.unit,point);
   if(!plan.valid||plan.chance<65||plan.flight.blocked||plan.friendlyRisk)continue;
   const radius=grenadeScatterRadius(Math.hypot(unit.x-point.x,unit.y-point.y));
   let unsafe=false;
   if(protectedPeople.length)for(let y=point.y-radius;y<=point.y+radius&&!unsafe;y++)for(let x=point.x-radius;x<=point.x+radius&&!unsafe;x++){
    const end={x,y,tacticalLevel:point.tacticalLevel};if(!surfaceAt(state,end))continue;
    const flight=grenadeFlight(state,candidate.unit,end);
    if(flight.landing&&protectedPeople.some(t=>grenadeBlastExposure(state,flight.landing,t,GRENADE_THROW.radius).multiplier>0))unsafe=true;
   }
   if(unsafe)continue;
   const value=known.reduce((sum,t)=>sum+Math.min(t.hp,GRENADE_THROW.damage*grenadeBlastExposure(state,plan.flight.landing,t,GRENADE_THROW.radius).multiplier),0);
   const score=value*plan.chance/100-(plan.pa+(candidate.equip?4:0))*.5;
   const usableGun=weaponFor(unit).capacity>0&&unit.loaded>0&&!unit.jammed;
   if(score<(usableGun?45:20))continue;
   if(!best||score>best.score)best={candidate,plan,point,score};
  }
 }
 if(!best)return null;
 if(best.candidate.equip)return best.candidate.equip;
 if(best.plan.costs.stance)return {type:'stance',unitId:unit.id,stance:'standing'};
 return {type:'throwGrenade',unitId:unit.id,...best.point};
}
