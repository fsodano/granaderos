import test from 'node:test';
import assert from 'node:assert/strict';
import {OUTFITS,BODY_SLOTS,makeOutfit,outfitSlot,validateOutfit,regionalGarmentWear,normalizeOutfit,issueInitialOutfit} from '../game/outfits.js';

const garment=(kind,condition=100,id=kind)=>({...makeOutfit(kind,condition),instanceId:`garment-${id}`});
const wearer=()=>({id:'actual-recipient',hp:61,ap:87,energy:73,loaded:1,ammo:4,condition:51,headwear:garment('hat',64),outfit:garment('linen_shirt',81),legwear:garment('trousers',72),inventory:{spare:garment('poncho',90,'packed')},equipmentCursor:{stack:garment('linen_shirt',43,'cursor')}});

test('the linen shirt is a canonical finite torso garment without changing initial service clothing',()=>{
 assert.deepEqual(OUTFITS.linen_shirt,{name:'Camisa de lino',weight:.6,slot:'outfit'});
 const shirt=garment('linen_shirt',47.5,'owned-shirt');assert.equal(outfitSlot(shirt),'outfit');assert.doesNotThrow(()=>validateOutfit(shirt,{worn:true,slot:'outfit'}));
 assert.throws(()=>validateOutfit(shirt,{worn:true,slot:'headwear'}));assert.throws(()=>validateOutfit({...shirt,count:2},{worn:true,slot:'outfit'}));assert.throws(()=>validateOutfit({...shirt,weight:0},{worn:true,slot:'outfit'}));
 const restored=JSON.parse(JSON.stringify(shirt));assert.deepEqual(restored,shirt);assert.doesNotThrow(()=>validateOutfit(restored,{worn:true,slot:'outfit'}));
 const canonical=normalizeOutfit({outfit:restored});assert.deepEqual(canonical.outfit,shirt);assert.equal(canonical.headwear,null);assert.equal(canonical.legwear,null);
 const campaign={operativeState:{1:{}}};issueInitialOutfit(campaign,1);assert.deepEqual(BODY_SLOTS.map(slot=>campaign.operativeState[1][slot].outfit),['hat','poncho','trousers']);
});

test('positive real health loss wears only its physical body slot and preserves exact garment custody',()=>{
 for(const [region,slot]of [['head','headwear'],['torso','outfit'],['legs','legwear']]){
  const unit=wearer(),before=structuredClone(unit),record=unit[slot],result=regionalGarmentWear(unit,region,11);
  assert.equal(result.slot,slot);assert.equal(result.wear,3);assert.deepEqual(result.garment,{...record,condition:record.condition-3});assert.notEqual(result.garment,record);
  assert.equal(result.garment.instanceId,record.instanceId);assert.equal(result.garment.count,1);assert.equal(result.garment.weight,record.weight);assert.deepEqual(unit,before,'the pure helper cannot spend AP, health, ammunition or another item');
  unit[result.slot]=result.garment;for(const other of BODY_SLOTS.filter(other=>other!==slot))assert.deepEqual(unit[other],before[other]);assert.deepEqual(unit.inventory,before.inventory);assert.deepEqual(unit.equipmentCursor,before.equipmentCursor);
  assert.doesNotThrow(()=>validateOutfit(result.garment,{worn:true,slot}));
 }
});

test('wear rounds up each positive five-health interval and caps at the actual remaining condition',()=>{
 const unit=wearer();for(const [loss,wear]of [[.01,1],[1,1],[5,1],[5.01,2],[10,2],[10.01,3],[400,80],[1000,81]]){
  const result=regionalGarmentWear(unit,'torso',loss);assert.equal(result.wear,wear);assert.equal(result.garment.condition,81-wear);
 }
 for(const condition of [1,.25]){unit.outfit=garment('linen_shirt',condition,'last-thread');const result=regionalGarmentWear(unit,'torso',6);assert.equal(result.wear,condition);assert.equal(result.garment.condition,0);assert.deepEqual(result.garment,{...unit.outfit,condition:0});assert.doesNotThrow(()=>validateOutfit(result.garment,{worn:true,slot:'outfit'}));}
});

test('zero loss, invalid input and empty or already ruined slots cannot issue or damage clothing',()=>{
 const unit=wearer(),before=structuredClone(unit);
 for(const loss of [0,-1,Infinity,-Infinity,NaN,null,undefined,'5',true])assert.equal(regionalGarmentWear(unit,'torso',loss),null);
 for(const region of [null,undefined,'hands','body','outfit','HEAD','constructor',{}])assert.equal(regionalGarmentWear(unit,region,5),null);
 for(const invalid of [null,undefined,{},[],{poncho:true},{outfit:null,inventory:{packed:unit.outfit}},{outfit:undefined,equipmentCursor:{stack:unit.outfit}},{outfit:garment('linen_shirt',0)}])assert.equal(regionalGarmentWear(invalid,'torso',5),null);
 assert.deepEqual(unit,before);
 const ruined={outfit:garment('linen_shirt',0,'still-owned')},record=ruined.outfit;assert.equal(regionalGarmentWear(ruined,'torso',100),null);assert.equal(ruined.outfit,record);assert.equal(record.count,1);assert.equal(record.instanceId,'garment-still-owned');
});

test('malformed or misplaced garments are inert and valid nested ownership metadata is preserved without mutation',()=>{
 const unit=wearer(),record=unit.outfit;
 for(const patch of [{kind:'tool'},{outfit:'unknown'},{count:2},{count:0},{condition:101},{condition:-1},{condition:NaN},{weight:2},{weapon:1805},{loaded:0},{instanceId:'constructor'}]){
  const invalid={...unit,outfit:{...record,...patch}},before=structuredClone(invalid);assert.equal(regionalGarmentWear(invalid,'torso',7),null);assert.deepEqual(invalid,before);
 }
 assert.equal(regionalGarmentWear({...unit,outfit:unit.headwear},'torso',7),null);
 const original={...record,provenance:{source:'finite-cache',receipt:['opened','taken']}},recipient={...unit,outfit:original},before=structuredClone(recipient);Object.freeze(original.provenance.receipt);Object.freeze(original.provenance);Object.freeze(original);
 const result=regionalGarmentWear(recipient,'torso',7);assert.deepEqual(result.garment,{...before.outfit,condition:79});assert.notEqual(result.garment.provenance,original.provenance);result.garment.provenance.receipt.push('returned');assert.deepEqual(recipient,before);
});
