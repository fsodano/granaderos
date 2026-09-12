import assert from 'node:assert/strict';
import {actBattle} from '../game/tactical.js';
import {approachNPC} from './approach-npc.mjs';
export function deliverPonchos(b,count=2,unitId='1000'){
 for(let i=0;i<count;i++){
  const u=b.units.find(u=>u.id===unitId),key=Object.keys(u.inventory).find(k=>u.inventory[k].kind==='outfit');assert.ok(key,'the courier carries a real garment');
  if(u.activeSlot!=='item'||u.activeItem!==`inventory:${key}`){b=actBattle(b,{type:'weapon',unitId,slot:'item',item:`inventory:${key}`});assert.equal(b.lastError,null);}
  b=approachNPC(b,unitId,'local-retiro');
  const received=b.npcs.find(n=>n.id==='local-retiro').questGifts?.length??0;
  b=actBattle(b,{type:'useItem',unitId,targetId:'local-retiro'});assert.equal(b.lastError,null);assert.equal(b.npcs.find(n=>n.id==='local-retiro').questGifts.length,received+1);
 }
 return approachNPC(b,unitId,'local-retiro');
}
