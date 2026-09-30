import {atHand,moveOrder,planningPoint} from './tactical-planning-space.js';
import {canSee,hasLineOfSight,weaponFor,hasFirearm,actionCosts,planLoot,planEquipLoot} from './tactical.js';
import {availableAmmunition,weaponAmmoType} from './ammunition-types.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const usable=unit=>weaponFor(unit).capacity>0&&unit.loaded>0&&!unit.jammed;

// Recover combat supplies through separate ordinary moves, pickups and equips.
// Search bounds and exposure limits are Granaderos policy, not extra action rules.
export function chooseScavengingAction(state,unit,targets,paths){
  const costs=actionCosts(state,unit);
  if(unit.ap<costs.loot||unit.knockedDown||unit.entangled||usable(unit))return null;
  if(hasFirearm(unit)&&(unit.jammed||availableAmmunition(unit,weaponFor(unit))>0))return null;
  if(!hasFirearm(unit)&&!unit.weaponDropped)return null;
  // A carried ready spare already supplies this need, even if its shot must wait.
  if(Object.keys(unit.inventory??{}).some(key=>{try{return usable(planEquipLoot(unit,key));}catch{return false;}}))return null;
  const type=weaponAmmoType(weaponFor(unit)),needAmmo=hasFirearm(unit)&&availableAmmunition(unit,weaponFor(unit))===0&&!unit.jammed;
  const sources=[];
  for(const ground of state.groundItems??[]){
    if(!ground.count||ground.heldBy||distance(unit,ground)>5||!canSee(state,unit,ground))continue;
    if(ground.kind==='ammunition'&&ground.ammoType===type&&needAmmo)sources.push({point:ground,action:{groundId:ground.id},count:Math.min(12,ground.count),ammo:true});
    else if(ground.weapon&&usable({...unit,weapon:ground.weapon,activeSlot:'primary',weaponDropped:false,loaded:ground.loaded,jammed:ground.jammed}))
      sources.push({point:ground,action:{groundId:ground.id},count:1});
  }
  for(const [dropIndex,drop] of (state.droppedWeapons??[]).entries()){
    if(drop.taken||distance(unit,drop)>5||!canSee(state,unit,drop))continue;
    if(usable({...unit,weapon:drop.weapon,activeSlot:'primary',weaponDropped:false,loaded:drop.loaded,jammed:drop.jammed}))sources.push({point:drop,action:{dropIndex},count:1});
  }
  // Body contents are known only at search distance, just as in the player picker.
  // Do not take an injured ally's gear or infer distant/hidden pack contents.
  for(const body of state.units){
    if(body.id===unit.id||body.departure||body.fled||body.hp>0&&(body.side===unit.side||!body.unconscious&&!body.surrendered)||!atHand(unit,body)||!canSee(state,unit,body))continue;
    if(needAmmo)for(const [key,stack] of Object.entries(body.inventory??{}).sort(([a],[b])=>a<b?-1:a>b?1:0))if(stack?.kind==='ammunition'&&stack.ammoType===type&&stack.count>0)sources.push({point:body,action:{targetId:body.id,item:`inventory:${key}`},count:Math.min(12,stack.count),ammo:true});
    if(!body.weaponDropped&&usable({...body,activeSlot:'primary'}))sources.push({point:body,action:{targetId:body.id,item:'primary'},count:1});
  }
  if(!sources.length)return null;
  const reacting=state.phase==='interrupt'||Boolean(state.reactionStack?.length);
  const threats=targets.filter(other=>weaponFor(other).capacity>0);
  // Treat every observed firearm as a threat; do not inspect its reserve ammo.
  const exposure=point=>threats.filter(other=>canSee(state,other,{...unit,...point})).length;
  const currentExposure=exposure(unit);
  let approaches;
  const safeApproaches=()=>approaches??=paths().filter(cell=>cell.cost>0&&cell.cost<=24&&cell.path.length<=3&&cell.cost+costs.loot<=unit.ap&&cell.path.every(point=>!targets.some(other=>distance(point,other)<=2.5)&&exposure(point)<=currentExposure));
  const choices=[];
  for(const source of sources){
    const local=atHand(unit,source.point)&&hasLineOfSight(state,unit,source.point);
    if(!local&&reacting)continue;
    const route=local?{...planningPoint(unit),cost:0}:safeApproaches().filter(cell=>atHand(cell,source.point)&&hasLineOfSight(state,cell,source.point)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
    if(!route)continue;
    for(let count=source.count;count>0;count--){
      const action={type:'loot',unitId:unit.id,...source.action,count};
      try{
        const {receiver}=planLoot(state,{...unit,...planningPoint(route,Boolean(state.upperSurfaces?.length))},action);
        let value=30+count*2;
        if(!source.ammo){
          if(route.cost+costs.loot+costs.equipLoot>unit.ap)break;
          const key=Object.keys(receiver.inventory).find(key=>!Object.hasOwn(unit.inventory??{},key));
          if(!key)break;
          const equipped=planEquipLoot(receiver,key);
          if(!usable(equipped))break;
          value=50+weaponFor(equipped).damage*.3;
        }
        choices.push({action:local?action:moveOrder(state,unit,route),score:value-route.cost,rank:JSON.stringify(source.action)});
        break;
      }catch{/* Try a smaller legal ammunition quantity; never discard gear to fit it. */}
    }
  }
  choices.sort((a,b)=>b.score-a.score||(a.rank<b.rank?-1:a.rank>b.rank?1:0));
  return choices[0]?.action??null;
}
