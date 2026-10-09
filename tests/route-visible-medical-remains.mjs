import assert from 'node:assert/strict';
import {operativeLocation} from '../game/squads.js';
import {canSee,getReachable,lootSearchPreview,lootPreview,lookPreview,climbPreview} from '../game/tactical.js';
import {nearbyLootOptions} from '../game/ja2-hud.js';
import {spacePoint,sameSurface,sameCell} from '../game/tactical-space.js';
import {order,visit,tactical,saved,leave} from './local-contract-fixture.mjs';

// Search the public battlefield in ordinary map bounds. A visible body can be
// approached for inspection; its supplies are selected only from the hand UI.
// This helper neither reads hidden contents nor moves their discovery flags.
export function recoverVisibleRouteDressings(start,operativeId,requested,{report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(requested)&&requested>0);
 let s=saved({campaign:start}).campaign;
 const sector=operativeLocation(s,operativeId),previous=s.activeSquadId,home=s.squads.find(q=>q.members.includes(operativeId)&&!q.journey),assignment=s.operativeState[operativeId].assignment;
 assert.ok(s.recruited.includes(operativeId)&&s.operativeState[operativeId].alive&&!s.operativeState[operativeId].captured);
 assert.ok(!s.operativeState[operativeId].asleep&&s.operativeState[operativeId].energy>10,'visible recovery needs an actual awake carrier');
 if(home)s=order(s,{type:'selectSquad',id:home.id});
 s=order(s,{type:'assignCare',operativeId,assignment:'active'});
 if(!home||home.members.length>1)s=order(s,{type:'createSquad',ids:[operativeId],name:'Recuperación de vendas',sector});
 let p=visit(s),collected=0;const actions=[],receipts=[],inspected=new Set(),unitId=String(operativeId),startSeconds=start.hour*3600+(start.secondOfHour??0);
 const actor=()=>p.battle.units.find(u=>u.id===unitId);
 const perform=action=>{p=saved(tactical(p,action));actions.push(action);};
 // Sweep public map bounds at six-cell spacing, looking in each direction.
 // Night sight and the facing cone cannot reveal the whole map in one walk.
 const xs=Array.from({length:Math.ceil((p.battle.width-6)/6)},(_,i)=>Math.min(p.battle.width-2,6+i*6)),ys=Array.from({length:Math.ceil((p.battle.height-6)/6)},(_,i)=>Math.max(1,p.battle.height-6-i*6)),waypoints=ys.flatMap((y,row)=>(row%2?[...xs].reverse():xs).map(x=>({x,y,tacticalLevel:0}))),directions=[[0,-2],[2,0],[0,2],[-2,0]];
 let waypoint=0,looking=0,stopReason=null;
 for(let attempt=0;collected<requested&&attempt<600;attempt++){
  const unit=actor();if(unit.hp<15||unit.unconscious||unit.asleep||unit.energy<=15){stopReason='rest';break;}
  const visible=p.battle.units.filter(body=>body.id!==unitId&&canSee(p.battle,unit,body)&&body.hp<=0&&!body.departure&&!inspected.has(body.id)).map(body=>({body,preview:lootSearchPreview(p.battle,unit,spacePoint(body))})).filter(row=>row.preview.valid).sort((a,b)=>a.preview.movePa-b.preview.movePa||String(a.body.id).localeCompare(String(b.body.id)));
  if(visible.length){
   const {body}=visible[0];perform({type:'approachLoot',unitId,...spacePoint(body)});
   const current=p.battle.units.find(u=>u.id===body.id),near=lootSearchPreview(p.battle,actor(),spacePoint(current));
   if(!near.valid||near.path.length)continue;
   const option=nearbyLootOptions(p.battle,actor(),spacePoint(current)).find(row=>row.action.targetId===current.id&&row.action.item==='medkits');
   inspected.add(current.id);if(!option)continue;
   let count=Math.min(requested-collected,option.count);
   while(count&&!lootPreview(p.battle,actor(),{...option.action,count}).valid)count--;
   if(!count)continue;
   const before=current.medkits,carried=actor().medkits;perform({...option.action,unitId,count});
   assert.equal(p.battle.units.find(u=>u.id===current.id).medkits,before-count);assert.equal(actor().medkits,carried+count);
   collected+=count;receipts.push({bodyId:current.id,count,before,after:before-count});continue;
  }
  if(looking<directions.length){const [dx,dy]=directions[looking++],point={x:Math.max(0,Math.min(p.battle.width-1,unit.x+dx)),y:Math.max(0,Math.min(p.battle.height-1,unit.y+dy)),tacticalLevel:unit.tacticalLevel??0};if(lookPreview(p.battle,unit,point).valid)perform({type:'look',unitId,...point});continue;}
  if(waypoint>=waypoints.length)break;
  const target=waypoints[waypoint],distance=point=>Math.hypot(point.x-target.x,point.y-target.y);
  if(sameSurface(unit,target)&&distance(unit)<=1){waypoint++;continue;}
  const view={...p.battle,units:p.battle.units.filter(u=>u.side==='player'||canSee(p.battle,unit,u))},reachable=getReachable(view,unit),step=reachable.filter(point=>point.path.length&&sameSurface(point,target)&&distance(point)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];
  if(!step){waypoint++;continue;}
  const before=spacePoint(unit),climb=step.path.findIndex(point=>point.kind==='climb');
  if(climb===0){const action={type:'climb',unitId,linkId:step.path[0].linkId};assert.ok(climbPreview(p.battle,unit,action).valid);perform(action);}
  else {const destination=climb>0?reachable.find(point=>sameCell(point,step.path[climb-1])):step;assert.ok(destination);perform({type:'move',unitId,...spacePoint(destination)});}
  assert.notDeepEqual(spacePoint(actor()),before,'the real public-map patrol must make progress');looking=0;
 }
 s=saved({campaign:leave(saved(p))}).campaign;
 if(home&&!s.squads.find(q=>q.id===home.id).members.includes(operativeId))s=order(s,{type:'assignToSquad',operativeId,squadId:home.id});
 if(assignment!=='active'&&(!['doctor','militia_doctor'].includes(assignment)||s.operativeState[operativeId].medkits>0&&s.operativeState[operativeId].energy>10))s=order(s,{type:'assignCare',operativeId,assignment});
 if(s.activeSquadId!==previous)s=order(s,{type:'selectSquad',id:previous});
 assert.equal(s.operativeState[operativeId].medkits,start.operativeState[operativeId].medkits+collected);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(s.operativeState[id].alive,false);
 assert.equal(s.resources.treasury,start.resources.treasury);
 const elapsedSeconds=s.hour*3600+(s.secondOfHour??0)-startSeconds;assert.ok(elapsedSeconds>=0);
 const evidence={event:'visibleMedicalRemains',operativeId,sector,collected,elapsedSeconds,stopReason,receipts,actions};report(evidence);
 return {campaign:saved({campaign:s}).campaign,collected,evidence};
}
