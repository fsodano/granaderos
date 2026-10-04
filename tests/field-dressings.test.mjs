import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutfit} from '../game/outfits.js';
import {fieldDressingsSource,planFieldDressings} from '../game/field-dressings.js';
import {inventoryUsage,planStowOutfit,readItemStack} from '../game/tactical-inventory.js';
import {handLayout} from '../game/hand-layout.js';

const shirt=(condition=100)=>({...makeOutfit('linen_shirt',condition),instanceId:'linen:owned',origin:'finite-chest'});
const soldier=(extra={})=>({id:'p',weapon:1805,loaded:1,condition:81,activeSlot:'primary',blade:1811,bladeCondition:64,medkits:2,hp:48,bleeding:3,inventory:{linen:shirt(),token:{count:1,name:'Documento',weight:0,instanceId:'document:owned'}},...extra});

test('planning consumes the exact packed shirt once and preserves other equipment, hands and wounds',()=>{
 const u=soldier(),before=structuredClone(u),source=fieldDressingsSource(u,'linen'),plan=planFieldDressings(u,'linen',source);
 assert.deepEqual(u,before);assert.deepEqual(plan.consumed,readItemStack(u,'inventory:linen',1));
 assert.equal(plan.unit.inventory.linen,undefined);assert.equal(plan.unit.medkits,5);
 assert.deepEqual(plan.unit.inventory.token,u.inventory.token);assert.deepEqual(handLayout(plan.unit),handLayout(u));
 for(const key of ['hp','bleeding','weapon','loaded','condition','blade','bladeCondition','activeSlot'])assert.deepEqual(plan.unit[key],u[key],key);
 assert.equal(Math.round(plan.consumed.weight*10),Math.round((plan.unit.medkits-u.medkits)*.2*10));
 assert.throws(()=>planFieldDressings(plan.unit,'linen',source));
});

test('a legacy stack loses one garment and retains its remaining exact metadata',()=>{
 const u=soldier({inventory:{linen:{...makeOutfit('linen_shirt',50),count:2,origin:'legacy-store'}}}),source=fieldDressingsSource(u,'linen');
 const first=planFieldDressings(u,'linen',source);assert.deepEqual(first.unit.inventory.linen,{...u.inventory.linen,count:1});assert.equal(first.unit.medkits,5);
 assert.throws(()=>planFieldDressings(first.unit,'linen',source),/Cambió la camisa/);
 const second=planFieldDressings(first.unit,'linen',fieldDressingsSource(first.unit,'linen'));
 assert.equal(second.unit.inventory.linen,undefined);assert.equal(second.unit.medkits,8);assert.equal(second.consumed.origin,'legacy-store');
});

test('worn, held, cursor and unsuitable sources cannot be converted, while ordinary stow permits it',()=>{
 const worn=soldier({outfit:shirt(),inventory:{}}),before=structuredClone(worn);
 assert.throws(()=>planFieldDressings(worn,'outfit'));assert.deepEqual(worn,before);
 const packed=planStowOutfit(worn),key=Object.keys(packed.inventory)[0];assert.equal(planFieldDressings(packed,key).unit.medkits,5);
 for(const extra of [{activeSlot:'item',activeItem:'inventory:linen'},{leftHandItem:'inventory:linen'},
   {inventory:{},equipmentCursor:{stack:{item:'inventory:linen',...shirt()},origin:{kind:'pocket',slotId:'large-1'}}},
   {inventory:{linen:shirt(49)}},{inventory:{linen:makeOutfit('poncho')}}]){
  const u=soldier(extra),snapshot=structuredClone(u);assert.throws(()=>planFieldDressings(u,'linen'));assert.deepEqual(u,snapshot);
 }
});

test('replacement identity, changed metadata, owner and quantity invalidate a pinned source',()=>{
 const u=soldier(),source=fieldDressingsSource(u,'linen');
 for(const mutate of [v=>v.id='other',v=>v.inventory.linen.instanceId='replacement',v=>v.inventory.linen.origin='different-chest',v=>v.inventory.linen.condition=99]){
  const changed=structuredClone(u);mutate(changed);assert.throws(()=>planFieldDressings(changed,'linen',source),/Cambió la camisa/);
 }
 const legacy=soldier({inventory:{linen:{...makeOutfit('linen_shirt'),count:2}}}),legacySource=fieldDressingsSource(legacy,'linen');legacy.inventory.linen.count=1;
 assert.throws(()=>planFieldDressings(legacy,'linen',legacySource),/Cambió la camisa/);
});

test('normal pocket capacity accepts a full valid pack and refuses an overloaded source atomically',()=>{
 const packed=count=>soldier({weapon:0,blade:0,activeSlot:'unarmed',medkits:0,inventory:{linen:shirt(),
  ...Object.fromEntries(Array.from({length:3},(_,i)=>[`large${i}`,{name:`Carga ${i}`,count:1,weight:3,instanceId:`large:${i}`}])),
  ...Object.fromEntries(Array.from({length:count},(_,i)=>[`small${i}`,{name:`Objeto ${i}`,count:1,weight:0,instanceId:`small:${i}`}]))}});
 const full=packed(8);assert.equal(inventoryUsage(full).free,0);assert.equal(inventoryUsage(full).overloaded,false);
 const result=planFieldDressings(full,'linen').unit;assert.equal(result.medkits,3);assert.equal(inventoryUsage(result).overloaded,false);assert.equal(inventoryUsage(result).free,0);
 const overflow=packed(9),before=structuredClone(overflow);assert.throws(()=>planFieldDressings(overflow,'linen'),/espacio|sobrecargado/);assert.deepEqual(overflow,before);
});
