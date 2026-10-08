import {atHand} from './tactical-planning-space.js';
import {hasFirearm,canSee,hasLineOfSight,transferPreview,equipLootPreview,planEquipLoot,actionCosts,meleePreview} from './tactical.js';
import {transferItemQuantity} from './tactical-inventory.js';
import {ammunitionLoadsFor,ammoCount} from './ammo-types.js';
import {firearmServiceable} from './firearm-serviceability.js';
import {chooseSupplySharingAction} from './tactical-ai-sharing.js';
import {isGrenadeStack} from './grenades.js';
import {sameSurface} from './tactical-space.js';

const available=u=>u.hp>0&&!u.unconscious&&!u.departure&&!u.fled&&!u.routed&&!u.surrendered&&!u.knockedDown&&!u.entangled;
const compare=(a,b)=>String(a)<String(b)?-1:String(a)>String(b)?1:0;

function actsAfter(state,unit,ally){
  if(Boolean(ally.militia)!==Boolean(unit.militia))return false;
  const queue=state.reactionStack?.at(-1)??(unit.side==='enemy'?state.enemyTurn:state.alliedTurn);
  // A receiver that already passed, or did not qualify for this reaction,
  // cannot spend its AP on the incoming gun during the donor's current window.
  const ids=queue?.unitIds??state.units.filter(other=>other.side===unit.side&&Boolean(other.militia)===Boolean(unit.militia)&&available(other)).map(other=>other.id);
  const giver=ids.indexOf(unit.id),receiver=ids.indexOf(ally.id);
  return giver>=(queue?.unitIndex??0)&&receiver>giver;
}

// This is a local paid handover, never a supply trip or a promise. Retain the
// donor's ready held gun and preflight the exact incoming item and next shot.
export function choosePackedGunHandover(state,unit,targets,{readyGun,bestShot,backupWeapon}){
  if(!available(unit)||unit.ap<4||!hasFirearm(unit)||!firearmServiceable(unit)||!readyGun(unit)||!targets.length)return null;
  const guns=Object.entries(unit.inventory??{}).sort(([a],[b])=>compare(a,b))
    .filter(([,gun])=>gun?.count===1&&typeof gun.instanceId==='string'&&gun.instanceId&&gun.loaded>0&&!gun.jammed&&firearmServiceable(gun));
  if(!guns.length)return null;
  const ownTurn={...state,phase:unit.side==='enemy'?'enemy':'player'};
  // Between-turn scoring can project this actor's window. Existing local ammo
  // or dressing demand still outranks a gun; this guard starts no supply trip.
  if(chooseSupplySharingAction(ownTurn,unit,targets,()=>[]))return null;
  const allies=state.units.filter(ally=>ally.id!==unit.id&&ally.side===unit.side&&available(ally)&&
    atHand(unit,ally)&&hasLineOfSight(state,unit,ally)&&actsAfter(state,unit,ally)).sort((a,b)=>compare(a.id,b.id));
  for(const ally of allies){
    // Bound this increment to ordinary primary-gun recipients. Existing care,
    // grenade, artillery and slot duties retain their next-order AP; do not
    // donate based on an equip/fire budget those higher priorities will spend.
    if((ally.activeSlot??'primary')!=='primary'||ally.equipmentCursor||
      ally.medical>0&&ally.medkits>0||
      Object.values(ally.inventory??{}).some(stack=>isGrenadeStack(stack)&&stack.count>0&&stack.condition>=50)||
      (state.artillery??[]).some(gun=>gun.side===ally.side&&sameSurface(ally,gun)&&(gun.loaded||gun.ammo>0)&&Math.hypot(ally.x-gun.x,ally.y-gun.y)<=6))continue;
    const primary={...ally,activeSlot:'primary'};
    if(!hasFirearm(primary))continue;
    // A working gun with a current charge, unfinished work or any supported
    // reserve has not exhausted its own supply. Maintenance keeps its priority.
    if(firearmServiceable(primary)&&(primary.loaded>0||primary.jammed||primary.reloadProgress>0||
      ammunitionLoadsFor(primary).some(load=>ammoCount(primary,load.family)>0)))continue;
    // A donor may react only to its own admitted contacts. The recipient must
    // independently see that same contact before a prospective shot is useful.
    const seen=targets.filter(target=>canSee(state,unit,target)&&canSee(state,ally,target));
    if(!seen.length||backupWeapon(ownTurn,ally,actionCosts(state,ally),seen)||
      seen.some(target=>meleePreview(ownTurn,ally,target).valid))continue;
    for(const [key] of guns){
      const item=`inventory:${key}`,give=transferPreview(ownTurn,unit,ally,item,1);
      if(!give.valid||give.kind!=='give'||give.route.length!==2)continue;
      try{
        const transfer=transferItemQuantity(unit,ally,item,1);
        const incoming=Object.keys(transfer.target.inventory??{}).find(name=>transfer.target.inventory[name].instanceId===transfer.stack.instanceId);
        if(!incoming)continue;
        const equip=equipLootPreview(ownTurn,transfer.target,incoming);
        if(!equip.valid)continue;
        const next={...planEquipLoot(transfer.target,incoming),ap:ally.ap-equip.pa};
        if(!readyGun(next)||!firearmServiceable(next))continue;
        const shot=bestShot(state,next,seen);
        if(shot?.effectiveness>=25)return {type:'transfer',unitId:unit.id,targetId:ally.id,item,count:1};
      }catch{/* Capacity, exact item or displaced-gun retention can reject this handover. */}
    }
  }
  return null;
}
