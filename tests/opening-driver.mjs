import {enterSector} from '../game/world.js';
import {buildSectorMap} from '../game/maps.js';
import {actBattle,endTurn,getReachable,bladeFor,hasLineOfSight,shotChance} from '../game/tactical.js';
export function fight(request){const map=buildSectorMap(request);let b=enterSector(request),actions=0;
for(let round=0;round<80&&b.status==='active';round++){
for(const id of b.units.filter(u=>u.side==='player').map(u=>u.id)){
for(let attempt=0;attempt<20&&b.status==='active';attempt++){
const u=b.units.find(u=>u.id===id);if(u.hp<=0||u.routed||u.ap<6)break;
const targets=b.units.filter(t=>t.side==='enemy'&&t.hp>0&&!t.routed).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y));const t=targets[0];if(!t)break;
const opts=[];if((u.bleeding||u.hp<u.maxHp-15)&&u.medkits)opts.push({type:'heal'});
if(Math.hypot(t.x-u.x,t.y-u.y)<=bladeFor(u).reach)opts.push({type:'melee',targetId:t.id});

if(u.jammed)opts.push({type:'reprime'});
if(u.loaded&&hasLineOfSight(b,u,t)&&shotChance(b,u,t)>20)opts.push({type:'fire',targetId:t.id});
if(!u.loaded&&u.ammo)opts.push({type:'reload'});
opts.push({type:'charge',targetId:t.id});
const moves=getReachable(b,u).filter(p=>p.cost>0).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)||a.cost-b.cost);if(moves[0])opts.push({type:'move',x:moves[0].x,y:moves[0].y});
if(!u.loaded&&u.ammo)opts.push({type:'reload'});
let done=false;for(const a of opts){const n=actBattle(b,{...a,unitId:id});if(!n.lastError){b=n;actions++;done=true;break;}}if(!done)break;
}}
if(b.status==='active')b=endTurn(b);
}
return {battle:b,actions};}
