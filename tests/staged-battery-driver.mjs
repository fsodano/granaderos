import {coastalBatteryController} from './coastal-command-driver.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {artilleryContact,artilleryCrewPlan,artilleryCosts} from '../game/tactical.js';

// Closely packed arrival guns share nearby soldiers. Select a legal move with
// the engine's actual crew, rather than reserving pairs that block each other.
// The cache is only for an immutable state; replay makes the same decisions.
export function stagedBatteryController(){
 const plans=new WeakMap(),controllers=new WeakMap();
 return (battle,unit)=>{
  // A lone gun has no arrival conflict. Let the existing coastal controller
  // move its infantry screen before the crew advances into contact.
  const loadedGuns=battle.artillery.filter(g=>g.side==='player'&&(g.loaded||g.ammo>0));
  if(battle.mode==='exploration'&&loadedGuns.length>1){
   if(!plans.has(battle)){
    const goal={x:Math.floor(battle.width*.65),y:Math.floor(battle.height*.5)};
    const distance=gun=>Math.hypot(gun.x-goal.x,gun.y-goal.y);
    const guns=[...loadedGuns]
     .sort((a,b)=>distance(b)-distance(a)||a.id.localeCompare(b.id));
    let action=null;
    for(const gun of guns){
     const actors=battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&artilleryContact(battle,u,gun));
     for(const actor of actors){
      const plan=artilleryCrewPlan(battle,actor,gun,artilleryCosts(battle,actor,gun).move);
      if(plan.reason)continue;
      const candidate=mountainBatteryOrder(battle,actor,{
       leaderId:actor.id,helperId:plan.crew.find(id=>id!==actor.id)??'none',
       artilleryId:gun.id,routeAroundObstacles:true,sharedArtillerySight:true,
      });
      if(candidate?.type==='artilleryMove'){action=candidate;break;}
     }
     if(action)break;
    }
    plans.set(battle,action);
   }
   const action=plans.get(battle);
   if(action)return action.unitId===unit.id?action:null;
  }
  // Once the arrival lane is clear, form crews from their current positions.
  if(!controllers.has(battle))controllers.set(battle,coastalBatteryController(battle,{sharedArtillerySight:true}));
  return controllers.get(battle)(battle,unit);
 };
}
