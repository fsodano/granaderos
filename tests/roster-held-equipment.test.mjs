import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';

function ready(){
 const content=defaultContentPackage(),rifle=content.weapons.find(weapon=>weapon.id==='firearm-1802');
 rifle.name='Fusil de autor';rifle.damage=63;
 return order(initialCampaign(8,content),{type:'createOfficer',name:'Custodio',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
}
const model=(s,id=1000)=>sectorInventoryModel(s,'retiro',rosterFor(s),id);

for(const weapon of [1800,1802])test(`actual raw ${weapon} replacement retains its own profile and save, including a shared template`,()=>{
 let start=ready();const original=handRecord(model(start).personal,'primary');assert.equal(original.weapon,1802);assert.equal(weaponSpecification(rosterFor(start).find(op=>op.id===1000)).damage,63);
 // One declared preexisting subsystem stack, replaced through real controls.
 const incoming={weapon,count:1,weight:weapon===1800?4:3.8,loaded:1,condition:62,jammed:true,instanceId:`raw-replacement-${weapon}`};
 start.operativeState[1000].inventory.declared=structuredClone(incoming);start=saved({campaign:start}).campaign;
 const before=structuredClone(start),action={type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',inventoryKey:'declared',expected:JSON.stringify(incoming),slot:'primary'};
 const result=order(start,action),held=handRecord(model(result).personal,'primary'),operative=rosterFor(result).find(op=>op.id===1000);
 assert.deepEqual(start,before);for(const [key,value]of Object.entries(incoming))assert.deepEqual(held[key],value);
 assert.equal(operative.weaponMetadata?.contentWeapon,undefined);assert.equal(held.contentWeapon,undefined);assert.notEqual(weaponSpecification(operative).name,'Fusil de autor');
 const retained=Object.values(result.operativeState[1000].inventory).find(row=>row.weapon===1802&&row.contentWeapon?.name==='Fusil de autor');assert.ok(retained);
 for(const [key,value]of Object.entries(original))assert.deepEqual(retained[key],value);
 assert.equal(result.resources.treasury,before.resources.treasury);assert.equal(result.hour,before.hour);assert.equal(result.secondOfHour,before.secondOfHour);
 assert.deepEqual(saved({campaign:result}).campaign,result);assert.deepEqual(order(saved({campaign:before}).campaign,action),result);
 const pair=visit(result),deployed=pair.battle.units.find(unit=>unit.id==='1000');assert.equal(deployed.weapon,weapon);assert.equal(deployed.weaponMetadata?.contentWeapon,undefined);
 const returned=leave(saved(pair));assert.deepEqual(handRecord(model(returned).personal,'primary'),held);assert.deepEqual(saved({campaign:returned}).campaign,returned);
});

test('actual authored primary drop preserves its ground definition and admits an empty-hand campaign save',()=>{
 const start=leave(visit(ready())),original=handRecord(model(start).personal,'primary'),before=structuredClone(start);
 const dropped=order(start,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'drop',item:'primary'});
 assert.deepEqual(start,before);assert.equal(dropped.operativeState[1000].weaponDropped,true);
 assert.equal(rosterFor(dropped).find(op=>op.id===1000).weaponMetadata,undefined);
 const ground=model(dropped).entries.find(row=>JSON.parse(row.expected).contentWeapon?.name==='Fusil de autor');assert.ok(ground);
 const stack=JSON.parse(ground.expected);for(const [key,value]of Object.entries(original))assert.deepEqual(stack[key],value);
 assert.deepEqual(saved({campaign:dropped}).campaign,dropped);
 const forged=structuredClone(dropped);forged.operativeState[1000].weaponMetadata={contentWeapon:original.contentWeapon};
 assert.throws(()=>restoreCampaign(serializeCampaign(forged)),/arma ausente/,'explicit metadata on an absent hand remains invalid');
});

test('actual same-template raw blade replacement does not inherit the outgoing authored blade definition',()=>{
 const id=119;let start=order(initialCampaign(8,defaultContentPackage()),{type:'recruitCivic',id,term:'week'});const old=handRecord(model(start,id).personal,'blade');assert.ok(old.contentWeapon);
 const incoming={weapon:old.weapon,count:1,weight:1.1,loaded:0,condition:47,instanceId:'raw-secondary'};
 start.operativeState[id].inventory.declared=structuredClone(incoming);start=saved({campaign:start}).campaign;
 const before=structuredClone(start),result=order(start,{type:'sectorInventory',sector:'retiro',operativeId:id,direction:'equip',inventoryKey:'declared',expected:JSON.stringify(incoming),slot:'blade'});
 assert.deepEqual(start,before);const held=handRecord(model(result,id).personal,'blade');
 for(const [key,value]of Object.entries(incoming))assert.deepEqual(held[key],value);
 assert.equal(rosterFor(result).find(op=>op.id===id).bladeMetadata?.contentWeapon,undefined);assert.equal(held.contentWeapon,undefined);
 const retained=Object.values(result.operativeState[id].inventory).find(row=>row.contentWeapon?.id===old.contentWeapon.id);assert.ok(retained);
 for(const [key,value]of Object.entries(old))assert.deepEqual(retained[key],value);
 assert.deepEqual(saved({campaign:result}).campaign,result);
 const returned=leave(saved(visit(result)));assert.deepEqual(handRecord(model(returned,id).personal,'blade'),held);assert.deepEqual(saved({campaign:returned}).campaign,returned);
});
