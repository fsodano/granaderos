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
function offer(b,item='inventory:coat',onChange=next=>next){
 const u=b.units[0],store=createEquipmentInteraction('gift'),slot=inventoryUsage(u).slots.find(s=>s.entry?.item===item).id;
 store.click(b,u,slot,Symbol('source'));const picked=store.getSnapshot().selection,preview=selectedItemMapPreview(b,u,picked,b.npcs[0]);let next,result;
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.kind,'gift');
 placeSelectedItemOnMap(store,b,u,b.npcs[0],'auto',false,action=>{next=actBattle(b,{unitId:u.id,...action});result=getNpcGiftResult(b,next);return onChange(next);});
 return {store,picked,next,result,preview};
}
test('a pocket gift exposes approach and then the matching saved NPC reply without equipping the item',()=>{
 const b=field(),{next,result,preview,store}=offer(b);
 assert.equal(result.status,'accepted');assert.equal(store.getSnapshot().selection,null);assert.equal(next.units[0].weapon,b.units[0].weapon);assert.equal(next.units[0].activeSlot,b.units[0].activeSlot);assert.equal(next.units[0].inventory.coat,undefined);assert.equal(next.npcs[0].questGifts[0].instanceId,'gift');
 assert.equal(preview.pa,0);assert.match(preview.coverNote,/Acercarse/);assert.ok(preview.path.length>1);
 const saved={npcId:'local-retiro',text:'Recibí el primer poncho. Falta uno.',giftCount:1,options:['repeat','friendly','direct']},reply=npcGiftFeedback(next,result,saved);
 assert.equal(reply.kind,'conversation');assert.equal(reply.responseOnly,false);assert.equal(reply.conversation,saved);assert.equal(reply.text,saved.text);
 const html=render(h('svg',null,h(InventoryMapCursor,{state:b,preview,target:b.npcs[0],project:(x,y)=>({x:x*26,y:y*14})})));
 assert.match(html,/data-item-approach/);assert.doesNotMatch(html,/data-item-trajectory|NaN|Infinity/);
});
test('refusal ignores an earlier accepted conversation and retains supplies without treating the NPC',()=>{
 const b=field({x:3,hp:45}),{next,result,store}=offer(b,'medkits');
 assert.equal(result.status,'refused');assert.equal(store.getSnapshot().selection,null);assert.equal(next.units[0].medkits,2);assert.equal(next.npcs[0].hp,45);assert.equal(next.npcs[0].questGifts,undefined);
 const reply=npcGiftFeedback(next,result,{npcId:'local-retiro',giftCount:1,text:'Gracias por el poncho.'});assert.equal(reply.responseOnly,true);assert.equal(reply.text,result.text);assert.notEqual(reply.text,'Gracias por el poncho.');
});
test('ordinary NPCs get a brief refusal; interrupted offers produce no NPC response',()=>{
 const b=field({id:'civilian',mission:false,x:3}),{next,result}=offer(b);
 assert.equal(npcGiftFeedback(next,result).kind,'speech');assert.equal(next.units[0].inventory.coat.instanceId,'gift');
 assert.equal(npcGiftFeedback(next,{...result,status:'interrupted'}),null);assert.equal(npcGiftFeedback(next,null),null);
 const moved=structuredClone(next);moved.npcs[0].x++;assert.equal(npcGiftFeedback(moved,result),null);
});
test('a rejected campaign handoff retains the selection and does not publish its derived receipt',()=>{
 const b=field(),{store,picked,next,result}=offer(b,'inventory:coat',()=>null);
 assert.equal(store.getSnapshot().selection,picked);assert.match(store.getSnapshot().hint,/sigue en su lugar/);assert.equal(b.units[0].inventory.coat.instanceId,'gift');assert.equal(b.npcs[0].questGifts,undefined);assert.equal(result.status,'accepted');assert.notEqual(next,b);
});
test('a stale saved receipt cannot replace the current physical acceptance reply',()=>{
 const b=field(),{next,result}=offer(b);
 for(const saved of [{npcId:'different',giftCount:1,text:'Old.'},{npcId:'local-retiro',giftCount:2,text:'Old.'},{npcId:'local-retiro',text:'Old.'}])assert.equal(npcGiftFeedback(next,result,saved).text,result.text);
});
