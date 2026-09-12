import {canSee,getReachable,stanceCost} from './tactical.js';
import {chooseEnemyAction} from './tactical-ai.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const able=u=>u.hp>=15&&!u.unconscious&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled;

export function automaticOrder(b,u){
 const action=chooseEnemyAction(b,u);if(action)return action;
 return searchOrder(b,u);
}

// Map waypoints do not disclose the position of an unseen opponent.
export function searchOrder(b,u,{changeStance=true}={}){
 if(!able(u)||u.knockedDown||u.entangled)return null;
 const visible=b.units.some(v=>v.side!==u.side&&able(v)&&b.units.some(p=>p.side===u.side&&able(p)&&canSee(b,p,v)));
 if(visible||b.phase==='interrupt'||u.ap<25)return null;
 // Sweep fixed map waypoints when there is no contact. Stopping permanently at
 // the center leaves defenders unable to discover a concealed flank.
 const patrol=[[.55,.5],[.75,.25],[.85,.5],[.75,.75],[.4,.75],[.4,.25]],waypoint=patrol[Math.floor((b.turn-1)/8)%patrol.length];
 const center={x:Math.floor((b.width-1)*waypoint[0]),y:Math.floor((b.height-1)*waypoint[1])};
 if(distance(u,center)<=3)return null;
 if(changeStance&&u.stance!=='standing'&&!u.mounted&&u.ap>=stanceCost(u,'standing'))return {type:'stance',unitId:u.id,stance:'standing'};
 const perceived={...b,units:b.units.filter(v=>v.side===u.side||canSee(b,u,v))};
 const moves=getReachable(perceived,u).filter(p=>p.cost>0&&p.cost<=Math.min(32,u.ap-20)&&distance(p,center)<distance(u,center));
 moves.sort((a,c)=>distance(a,center)-distance(c,center)||a.cost-c.cost||a.y-c.y||a.x-c.x);
 return moves[0]?{type:'move',unitId:u.id,x:moves[0].x,y:moves[0].y}:null;
}
