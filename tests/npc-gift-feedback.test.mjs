import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,getNpcGiftResult} from '../game/tactical.js';
import {makeOutfit} from '../game/outfits.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const {selectedItemMapPreview,placeSelectedItemOnMap}=await import('../web/lib/inventory-map-controls.ts');
const {npcGiftFeedback}=await import('../web/lib/npc-gift-feedback.ts');
const {default:InventoryMapCursor}=await import('../web/app/InventoryMapCursor.tsx');
const field=(recipient={})=>createBattle([{id:'p',name:'Soldado',x:2,y:2,weapon:1805,medkits:2,inventory:{coat:{...makeOutfit('poncho',67),instanceId:'gift'}}}],{width:12,height:8,exploration:true,enemies:[],npcs:[{id:'local-retiro',name:'Sargento',x:6,y:2,mission:true,...recipient}],tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}))});
function offer(initial,item='inventory:coat',onChange=next=>next){
 let battle=initial;const store=createEquipmentInteraction('gift'),owner=Symbol('source'),slot=inventoryUsage(battle.units[0]).slots.find(s=>s.entry?.item===item).id,orders=[];
 const reduce=action=>{orders.push(action);battle=actBattle(battle,{unitId:'p',...action});return battle;};
 store.revalidate(battle.units[0],false,reduce,battle);
 const pickup=store.click(battle,battle.units[0],slot,owner);assert.equal(pickup.type,'pickupEquipment');assert.equal(store.getSnapshot().selection,null);
 store.dispatch({...pickup,unitId:'p'},reduce,owner);assert.equal(battle.lastError,null,battle.lastError);store.revalidate(battle.units[0],false,reduce,battle);
 const beforeOffer=battle,u=battle.units[0],picked=store.getSnapshot().selection,preview=selectedItemMapPreview(battle,u,picked,battle.npcs[0]);let next,result;
 assert.equal(picked.sourceId,'cursor');assert.equal(picked.count,1);assert.equal(u.equipmentCursor.stack.count,1);assert.equal(preview.valid,true,preview.reason);assert.equal(preview.kind,'gift');assert.equal(preview.action.sourceId,'cursor');
 placeSelectedItemOnMap(store,battle,u,battle.npcs[0],'auto',false,action=>{
  orders.push(action);next=actBattle(battle,{unitId:u.id,...action});result=getNpcGiftResult(battle,next);const accepted=onChange(next);
  if(accepted&&!accepted.lastError)battle=accepted;return accepted;
 });
 store.revalidate(battle.units[0],false,reduce,battle);
 return {store,picked,next,result,preview,battle,beforeOffer,orders};
}
test('a pocket gift exposes approach and then the matching saved NPC reply without equipping the item',()=>{
 const b=field(),{next,result,preview,store,beforeOffer,orders}=offer(b);
 assert.equal(result.status,'accepted');assert.deepEqual(orders.map(action=>action.type),['pickupEquipment','inventoryMap']);assert.equal(beforeOffer.units[0].inventory.coat,undefined);assert.equal(beforeOffer.units[0].equipmentCursor.stack.instanceId,'gift');assert.equal(next.units[0].equipmentCursor,undefined);assert.equal(store.getSnapshot().selection,null);assert.equal(next.units[0].weapon,b.units[0].weapon);assert.equal(next.units[0].activeSlot,b.units[0].activeSlot);assert.equal(next.units[0].inventory.coat,undefined);assert.equal(next.npcs[0].questGifts[0].instanceId,'gift');
 assert.equal(preview.pa,0);assert.match(preview.coverNote,/Acercarse/);assert.ok(preview.path.length>1);
 const saved={npcId:'local-retiro',text:'Recibí el primer poncho. Falta uno.',giftCount:1,options:['repeat','friendly','direct']},reply=npcGiftFeedback(next,result,saved);
 assert.equal(reply.kind,'conversation');assert.equal(reply.responseOnly,false);assert.equal(reply.conversation,saved);assert.equal(reply.text,saved.text);
 const html=render(h('svg',null,h(InventoryMapCursor,{state:b,preview,target:b.npcs[0],project:(x,y)=>({x:x*26,y:y*14})})));
 assert.match(html,/data-item-approach/);assert.doesNotMatch(html,/data-item-trajectory|NaN|Infinity/);
});
test('refusal ignores an earlier accepted conversation and retains supplies without treating the NPC',()=>{
 const b=field({x:3,hp:45}),{next,result,store}=offer(b,'medkits');
 assert.equal(result.status,'refused');assert.equal(store.getSnapshot().selection.sourceId,'cursor');assert.equal(store.getSnapshot().selection.count,1);assert.equal(next.units[0].medkits,1);assert.deepEqual(next.units[0].equipmentCursor.stack,{item:'medkits',count:1,weight:.2});assert.equal(next.units[0].medkits+next.units[0].equipmentCursor.stack.count,b.units[0].medkits);assert.equal(next.npcs[0].hp,45);assert.equal(next.npcs[0].questGifts,undefined);
 const reply=npcGiftFeedback(next,result,{npcId:'local-retiro',giftCount:1,text:'Gracias por el poncho.'});assert.equal(reply.responseOnly,true);assert.equal(reply.text,result.text);assert.notEqual(reply.text,'Gracias por el poncho.');
});
test('ordinary NPCs get a brief refusal; interrupted offers produce no NPC response',()=>{
 const b=field({id:'civilian',mission:false,x:3}),{next,result}=offer(b);
 assert.equal(npcGiftFeedback(next,result).kind,'speech');assert.equal(next.units[0].inventory.coat,undefined);assert.equal(next.units[0].equipmentCursor.stack.instanceId,'gift');
 assert.equal(npcGiftFeedback(next,{...result,status:'interrupted'}),null);assert.equal(npcGiftFeedback(next,null),null);
 const moved=structuredClone(next);moved.npcs[0].x++;assert.equal(npcGiftFeedback(moved,result),null);
});
test('a rejected campaign handoff retains the selection and does not publish its derived receipt',()=>{
 const b=field(),{store,picked,next,result,battle,beforeOffer}=offer(b,'inventory:coat',()=>null);
 assert.equal(store.getSnapshot().selection,picked);assert.match(store.getSnapshot().hint,/sigue en su lugar/);assert.equal(battle,beforeOffer);assert.equal(battle.units[0].inventory.coat,undefined);assert.equal(battle.units[0].equipmentCursor.stack.instanceId,'gift');assert.equal(battle.npcs[0].questGifts,undefined);assert.equal(b.units[0].inventory.coat.instanceId,'gift','the reducer must not mutate the initial input');assert.equal(result.status,'accepted');assert.notEqual(next,battle);
});
test('a stale saved receipt cannot replace the current physical acceptance reply',()=>{
 const b=field(),{next,result}=offer(b);
 for(const saved of [{npcId:'different',giftCount:1,text:'Old.'},{npcId:'local-retiro',giftCount:2,text:'Old.'},{npcId:'local-retiro',text:'Old.'}])assert.equal(npcGiftFeedback(next,result,saved).text,result.text);
});
