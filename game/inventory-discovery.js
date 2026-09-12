import {canSee} from './tactical.js';
import {isInteriorVisible} from './tactical-visibility.js';
import {propCells} from './props.js';

// Discovery survives losing sight. It grants knowledge of loose equipment,
// not of hidden bodies, living opponents' packs or unopened containers.
export function discoverInventory(state){
 const observers=state.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.departure&&!u.routed&&!u.surrendered);
 const rooms=new Set(state.revealedRooms??[]);
 const seen=(point,near=false)=>isInteriorVisible(state,point,rooms)&&observers.some(u=>canSee(state,u,point)&&(!near||Math.hypot(u.x-point.x,u.y-point.y)<=1.5));
 for(const item of state.groundItems??[])if(item.count>0&&!item.heldBy&&seen(item))item.knownToPlayer=true;
 for(const item of state.droppedWeapons??[])if(!item.taken&&seen(item))item.knownToPlayer=true;
 for(const unit of state.units)if(unit.hp<=0&&!unit.departure&&seen(unit,true))unit.knownToPlayer=true;
 for(const prop of state.props??[])if(prop.type==='chest'&&prop.open&&propCells(prop).some(point=>seen(point)))prop.knownToPlayer=true;
}
