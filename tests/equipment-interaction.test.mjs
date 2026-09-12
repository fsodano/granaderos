import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';
const {createEquipmentInteraction}=await import('../web/lib/equipment-interaction.ts');
const field=(extra={},options={})=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,condition:71,ammo:8,blade:0,medkits:3,...extra}],{width:10,height:8,exploration:true,enemies:[],...options});
const pocket=(u,item)=>inventoryUsage(u).slots.find(s=>s.entry?.item===item).id;
const owners=()=>[Symbol('pockets'),Symbol('hands')];

test('clicks across panel components reserve then place once without changing items at pickup',()=>{
 const b=field(),u=b.units[0],original=structuredClone(b),store=createEquipmentInteraction('inventory'),[pockets,hands]=owners(),from=pocket(u,'medkits');
 assert.equal(store.click(b,u,from,pockets),null);assert.deepEqual(b,original);
 assert.equal(store.getSnapshot().selection.sourceId,from);
 assert.equal(store.press(u,'hand:left',hands,20,20),false,'a destination press must not replace the picked source');
 store.hover(b,u,'hand:left');assert.equal(store.getSnapshot().target,'hand:left');assert.doesNotMatch(store.getSnapshot().hint,/\bPA\b/);
 const action=store.click(b,u,'hand:left',hands);assert.equal(action.type,'moveEquipment');assert.equal(action.expectedSource,equipmentFingerprint(u,from));
 assert.equal(store.getSnapshot().selection,null);assert.deepEqual(b,original);
 const n=actBattle(b,{...action,unitId:'p'});assert.equal(n.lastError,null);assert.equal(handLayout(n.units[0]).left,'medkits');assert.equal(n.units[0].medkits,3);assert.equal(n.units[0].ap,u.ap);
 assert.equal(store.click(n,n.units[0],'hand:left',hands),null,'a later click starts a new reservation, not a second order');
});
test('same-source cancellation, Escape-style cancellation and old owner cleanup do not spend or transfer equipment',()=>{
 const b=field(),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners(),from=pocket(u,'medkits'),original=structuredClone(b);
 store.click(b,u,from,pockets);assert.equal(store.click(b,u,from,pockets),null);assert.equal(store.getSnapshot().selection,null);
 store.click(b,u,from,pockets);assert.equal(store.cancel(),true);assert.equal(store.cancel(),false);
 store.click(b,u,'hand:right',hands);store.clearOwned(pockets);assert.equal(store.getSnapshot().selection.sourceId,'hand:right');store.clearOwned(hands);assert.equal(store.getSnapshot().selection,null);
 assert.deepEqual(b,original);
});
test('invalid destinations keep the selected source and show the actual placement reason',()=>{
 const b=field({weapon:1800}),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners();
 store.click(b,u,pocket(u,'medkits'),pockets);assert.equal(store.click(b,u,'hand:left',hands),null);assert.match(store.getSnapshot().hint,/dos manos/);assert.equal(store.getSnapshot().selection.owner,pockets);
 store.cancel();store.click(b,u,'hand:right',hands);assert.equal(store.click(b,u,'small-8',pockets),null);assert.ok(store.getSnapshot().selection);assert.equal(store.getSnapshot().target,'');
});
test('source changes and actor unavailability cancel a pending reservation without an order',()=>{
 const b=field(),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners();
 store.click(b,u,'hand:right',hands);const changed={...u,loaded:0};store.revalidate(changed,false);assert.equal(store.getSnapshot().selection,null);assert.match(store.getSnapshot().hint,/Cambió el equipo/);
 store.click(b,u,pocket(u,'medkits'),pockets);store.revalidate(u,true);assert.equal(store.getSnapshot().selection,null);
 store.click(b,u,pocket(u,'medkits'),pockets);store.revalidate({...u,id:'other'},false);assert.equal(store.getSnapshot().selection,null);
});
test('independent inventory panels and different soldiers cannot share a reservation',()=>{
 const b=field(),u=b.units[0],a=createEquipmentInteraction('a'),otherPanel=createEquipmentInteraction('b'),[pockets,hands]=owners();
 a.click(b,u,pocket(u,'medkits'),pockets);assert.equal(otherPanel.getSnapshot().selection,null);
 assert.equal(a.click(b,{...u,id:'q'},'hand:left',hands),null);assert.match(a.getSnapshot().hint,/este combatiente/);assert.equal(a.getSnapshot().selection.unitId,'p');
});
test('a drag keeps the source fingerprint, rejects an outside drop and releases at most one order',()=>{
 const b=field(),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners(),from=pocket(u,'medkits');
 assert.ok(store.press(u,from,pockets,0,0));store.drag(b,u,pockets,3,3,'hand:left');assert.equal(store.getSnapshot().gesture.dragging,false);
 store.drag(b,u,pockets,20,20,'hand:left');assert.equal(store.getSnapshot().target,'hand:left');assert.equal(store.release(hands),null);
 const released=store.release(pockets);assert.equal(released.dragging,true);assert.equal(released.action.expectedSource,equipmentFingerprint(u,from));assert.equal(store.release(pockets),null);
 store.press(u,from,pockets,0,0);store.drag(b,u,pockets,20,20,null);assert.deepEqual(store.release(pockets),{dragging:true,action:null,suppressClick:true});
 store.press(u,'hand:right',hands,0,0);store.drag(b,{...u,loaded:0},hands,20,20,'large-4');assert.equal(store.release(hands).action,null,'a changed gun must not be moved');
});

test('cancellation consumes an outstanding pointer click and campaign previews do not claim time or AP',()=>{
 const b=field(),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners();
 store.press(u,'hand:right',hands,0,0);store.cancel();assert.deepEqual(store.release(hands),{dragging:false,action:null,suppressClick:true});assert.equal(store.release(hands),null);
 store.press(u,'hand:right',hands,0,0);store.revalidate({...u,loaded:0},false);assert.equal(store.release(hands).suppressClick,true);
 store.click(b,u,pocket(u,'medkits'),pockets);store.hover({...b,equipmentContext:'campaign'},u,'hand:left');assert.equal(store.getSnapshot().hint,'Colocar objeto');
});
test('combat previews charge only the accepted placement and a no-AP rejection retains selection',()=>{
 const b=field({}, {exploration:false,enemies:[{id:'e',x:3,y:2,patrol:false,overwatch:false}]}),u=b.units[0],store=createEquipmentInteraction('inventory'),[pockets,hands]=owners();
 store.click(b,u,pocket(u,'medkits'),pockets);store.hover(b,u,'hand:left');assert.match(store.getSnapshot().hint,/4 PA/);
 assert.equal(store.click(b,{...u,ap:3},'hand:left',hands),null);assert.ok(store.getSnapshot().selection);
 const action=store.click(b,u,'hand:left',hands),n=actBattle(b,{...action,unitId:'p'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,u.ap-4);
});
