import {sameSurface,spacePoint} from '../game/tactical-space.js';
import assert from 'node:assert/strict';
import {actBattle,getReachable,hasLineOfSight,equipLootPreview} from '../game/tactical.js';
import {handRecord} from '../game/tactical-inventory.js';

const rifles=new Set([1800,1801,1802]);
const distance=(a,b)=>sameSurface(a,b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;

// Prepare the current field squad from equipment left by the actual battle.
// A surviving rifleman keeps his gun; his survival must not fail a route that
// previously depended on that character dying. Enemy remains are valid sources.
export function equipOpeningRifles(battle,receiverIds){
 let next=structuredClone(battle);
 const transfers=[],unfilled=[];
 const order=action=>{const result=actBattle(next,action);assert.equal(result.lastError,null,JSON.stringify(action)+': '+result.lastError);next=result;};
 for(const id of receiverIds){
  let receiver=next.units.find(unit=>unit.id===String(id)&&unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure);
  if(!receiver||!receiver.weaponDropped&&rifles.has(receiver.weapon))continue;
  const reachable=getReachable(next,receiver);
  const sources=next.units.filter(unit=>unit.hp===0&&!unit.departure&&!unit.weaponDropped&&rifles.has(unit.weapon)).flatMap(source=>{
   const approach=reachable.filter(point=>distance(point,source)<=1.5&&hasLineOfSight(next,point,source)).sort((a,b)=>a.cost-b.cost)[0];
   return approach?[{source,approach}]:[];
  }).sort((a,b)=>Number(a.source.side!=='player')-Number(b.source.side!=='player')||a.approach.cost-b.approach.cost||a.source.id.localeCompare(b.source.id));
  const choice=sources[0];
  if(!choice){unfilled.push(receiver.id);continue;}
  const {source,approach}=choice,incoming=handRecord(source,'primary'),outgoing=receiver.weaponDropped||!receiver.weapon?null:handRecord(receiver,'primary');
  const previousKeys=new Set(Object.keys(receiver.inventory));
  if(approach.cost)order({type:'move',unitId:receiver.id,...spacePoint(approach)});
  order({type:'loot',unitId:receiver.id,targetId:source.id,item:'primary',count:1});
  receiver=next.units.find(unit=>unit.id===receiver.id);
  const entry=Object.entries(receiver.inventory).find(([key,item])=>!previousKeys.has(key)&&item.weapon===incoming.weapon&&item.instanceId===incoming.instanceId);
  assert.ok(entry,'the recovered rifle has its own inventory record');
  assert.equal(entry[1].count,1,'one actual rifle was recovered');
  let leftOnGround=false;
  if(outgoing&&!equipLootPreview(next,receiver,entry[0]).valid){
   order({type:'drop',unitId:receiver.id,item:'primary',count:1});
   leftOnGround=true;
  }
  order({type:'equipLoot',unitId:receiver.id,inventoryKey:entry[0]});
  const equipped=next.units.find(unit=>unit.id===receiver.id),looted=next.units.find(unit=>unit.id===source.id);
  assert.deepEqual(handRecord(equipped,'primary'),incoming,'the rifle keeps its loading, condition, fittings and identity');
  if(outgoing){
   const stored=(leftOnGround?next.groundItems:Object.values(equipped.inventory)).find(item=>item.weapon===outgoing.weapon&&item.instanceId===outgoing.instanceId);
   assert.ok(stored,'the replaced gun remains in the pack or on the ground');
   for(const [key,value] of Object.entries(outgoing))assert.deepEqual(stored[key],value,`the replaced gun preserves ${key}`);
  }
  assert.equal(looted.hp,0);assert.equal(looted.weaponDropped,true);assert.equal(looted.loaded,0);assert.equal(looted.ammo,source.ammo);
  transfers.push({receiverId:receiver.id,sourceId:source.id,sourceSide:source.side,weapon:incoming.weapon,instanceId:incoming.instanceId,leftOnGround,outgoing});
 }
 return {battle:next,transfers,unfilled};
}
