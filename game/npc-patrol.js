import {getReachable,canSee} from './tactical.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function choosePatrolAction(state,unit){
 if(!unit.patrolOrigin||unit.patrol===false||unit.patrolTurn===state.turn||unit.hp<=0||unit.unconscious||unit.routed||unit.departure||unit.knockedDown||unit.entangled)return null;
 const directions=[[0,-4],[4,0],[0,4],[-4,0]],offset=[...String(unit.id)].reduce((sum,c)=>sum+c.charCodeAt(0),0);
 const [dx,dy]=directions[(state.turn+offset)%4],goal={x:unit.patrolOrigin.x+dx,y:unit.patrolOrigin.y+dy};
 const perceived={...state,units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
 const choices=getReachable(perceived,unit).filter(p=>p.cost>0&&p.cost<=24&&p.path.length<=3&&distance(p,unit.patrolOrigin)<=6);
 choices.sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 const next=choices[0];return next&&distance(next,goal)<distance(unit,goal)?{type:'move',unitId:unit.id,x:next.x,y:next.y,patrol:true}:null;
}
