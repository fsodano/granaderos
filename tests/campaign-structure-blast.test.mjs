import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {withCarriedGrenades} from './commerce-gear-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle,containerLootPreview} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const sync=(s,b)=>{const result=syncBattleTime(s,b);assert.equal(result.error,null,result.error);return result;};
const wood=b=>b.tiles.find(t=>t.x===5&&t.y===2);
const adobe=b=>b.tiles.find(t=>t.x===4&&t.y===4);
const cache=b=>b.props.find(p=>p.id==='retiro:armory-cache');

test('actual grenade damage and finite cache depletion persist through save, sector return and repeated reentry',()=>{
  // Declared legacy squad and one preexisting owned grenade. The cache uses
  // real authored finite objects; orders, extraction and custody remain real.
  let s=withCarriedGrenades(initialCampaign(45),10,1);Object.assign(s.operativeState[10],{activeSlot:'item',activeItem:'inventory:grenade:arsenal'});
  s=order(s,{type:'visitSector'});const request=s.pendingBattle,authored=enterSector(request),chest=structuredClone(cache(authored));assert.ok(chest);const originalContents=structuredClone(chest.contents);
  const tiles=Array.from({length:216},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
  Object.assign(tiles[2*24+5],{type:'wall',material:'wood',blocked:true,blocksSight:true,cover:40});
  Object.assign(tiles[4*24+4],{type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40});
  Object.assign(chest,{x:6,y:3,roomId:undefined,buildingId:undefined,blocksMovement:true});
  let b=createBattle(request.squad.map((u,i)=>({...u,x:1,y:u.id===10?3:i===0?1:6,facing:2})),{
    ...request,width:24,height:9,tiles,seed:45,buildings:[],props:[chest],decor:[],enemies:[],npcs:request.npcs.map((n,i)=>({...n,x:21+i,y:7})),exploration:true});
  ({campaign:s,battle:b}=save(s,b));b=act(b,{unitId:'10',type:'throwGrenade',x:5,y:3});
  assert.equal(cache(b).destroyed,true);assert.equal(cache(b).open,true);assert.deepEqual(cache(b).contents,originalContents);assert.equal(wood(b).destroyed,true);assert.ok(adobe(b).structureDamage>0&&adobe(b).structureDamage<100);
  ({campaign:s,battle:b}=sync(s,b));({campaign:s,battle:b}=save(s,b));const damage=structuredClone([wood(b),adobe(b)]),metadata=structuredClone(cache(b));
  // Walk to the debris and acquire the exact first cache gun once.
  b=act(b,{unitId:'10',type:'move',x:5,y:3});const u=b.units.find(u=>u.id==='10'),preview=containerLootPreview(b,u,{kind:'container',id:metadata.id},0,1);assert.equal(preview.valid,true,preview.reason);
  b=act(b,preview.action);assert.equal(cache(b).contents.length,originalContents.length-1);const identity=originalContents[0].instanceId;assert.ok(Object.values(b.units.find(u=>u.id==='10').inventory).some(r=>r.instanceId===identity));
  const retained=structuredClone(cache(b));({campaign:s,battle:b}=sync(s,b));({campaign:s,battle:b}=save(s,b));
  s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});({campaign:s}=save(s));assert.deepEqual(cache(s.sectorStates.retiro),retained);
  for(let visit=0;visit<2;visit++){
    s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.deepEqual([wood(b),adobe(b)],damage);assert.deepEqual(cache(b),retained);assert.equal(b.units.find(u=>u.id==='10').inventory['grenade:arsenal'],undefined);
    assert.ok(Object.values(b.units.find(u=>u.id==='10').inventory).some(r=>r.instanceId===identity));
    assert.equal(cache(b).contents.some(r=>r.instanceId===identity),false);({campaign:s,battle:b}=save(s,b));
    s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});({campaign:s}=save(s));
  }
  assert.deepEqual(cache(s.sectorStates.retiro),retained);
});
