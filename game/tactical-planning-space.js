import {sameSurface,tacticalLevel} from './tactical-space.js';
// Keep legacy flat reports unchanged; elevated orders must say ground explicitly.
export const planningPoint=(point,elevated=false)=>({x:point.x,y:point.y,...(elevated||point.tacticalLevel!==undefined?{tacticalLevel:tacticalLevel(point)}:{})});
export const moveOrder=(state,unit,destination,extra={})=>({type:'move',unitId:unit.id,...planningPoint(destination,Boolean(state.upperSurfaces?.length)),...extra});
export const atHand=(a,b,range=1.5)=>sameSurface(a,b)&&Math.hypot(a.x-b.x,a.y-b.y)<=range;
