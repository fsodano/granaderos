import {militiaPatrolRules} from './militia-patrol-rules.js';
import {canSee,getReachable} from './tactical.js';
import {isUnconscious} from './actor-condition.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const able=u=>u.hp>=15&&!isUnconscious(u)&&!u.routed&&!u.fled&&!u.surrendered&&!u.departure;

// Fixed map waypoints do not expose or follow unseen opponents. The clock and
// each actor's position already belong to the validated tactical snapshot.
export function militiaPatrolOrder(state,unit){
 const rules=militiaPatrolRules(state);
 if(!rules.enabled||!unit.militia||!able(unit)||unit.knockedDown||unit.entangled||unit.patrol===false||unit.ap<25)return null;
 if(state.units.some(v=>v.side!==unit.side&&able(v)&&state.units.some(p=>p.side===unit.side&&able(p)&&canSee(state,p,v))))return null;
 const points=[[.55,.5],[.75,.25],[.85,.5],[.75,.75],[.4,.75],[.4,.25]],point=points[Math.floor((state.turn-1)/rules.waypointTicks)%points.length];
 const goal={x:Math.floor((state.width-1)*point[0]),y:Math.floor((state.height-1)*point[1])};
 if(distance(unit,goal)<=3)return null;
 const perceived={...state,units:state.units.filter(v=>v.side===unit.side||canSee(state,unit,v))};
 const moves=getReachable(perceived,unit).filter(p=>p.cost>0&&p.cost<=Math.min(32,unit.ap-20)&&distance(p,goal)<distance(unit,goal));
 moves.sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return moves[0]?{type:'move',unitId:unit.id,x:moves[0].x,y:moves[0].y,patrol:true}:null;
}
