import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';

const ready=()=>order(initialCampaign(8,defaultContentPackage()),{type:'createOfficer',name:'Custodio',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const model=state=>sectorInventoryModel(state,'retiro',rosterFor(state),1000);

test('route recovery keeps a present primary and does not discover or consume a cache unnecessarily',()=>{
 const start=ready(),before=structuredClone(start),campaign=recoverRoutePrimary(start,1000);
 assert.deepEqual(start,before);assert.deepEqual(campaign,before);assert.notEqual(campaign,start);
});

test('a dropped firearm returns through public pickup and equip with its complete finite record',()=>{
 let start=ready();
 // One preexisting subsystem gun, independent of new-campaign route stocks.
 const incoming={weapon:1800,count:1,weight:4,loaded:1,condition:62,jammed:true,instanceId:'route-held-musket',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'route-socket',condition:47}}};
 start.operativeState[1000].inventory['declared:gun']=structuredClone(incoming);
 start=order(start,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',inventoryKey:'declared:gun',expected:JSON.stringify(incoming),slot:'primary'});
 let pair=visit(start);start=leave(pair);
 const previous=model(start).carried.find(row=>row.inventoryKey&&JSON.parse(row.expected??'{}').weapon===1802);
 assert.ok(previous);start=order(start,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'drop',item:previous.item});
 start=order(start,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'drop',item:'primary'});
 const before=structuredClone(start),source=model(start).entries.find(row=>JSON.parse(row.expected).instanceId===incoming.instanceId);assert.ok(source?.reachable);
 const campaign=recoverRoutePrimary(start,1000,{preferredWeapon:1800}),equipped=handRecord(model(campaign).personal,'primary');
 assert.deepEqual(start,before);for(const [key,value]of Object.entries(incoming))assert.deepEqual(equipped[key],value);
 assert.equal(campaign.resources.treasury,before.resources.treasury);assert.equal(campaign.hour,before.hour);assert.equal(campaign.secondOfHour,before.secondOfHour);
 assert.ok(!model(campaign).entries.some(row=>JSON.parse(row.expected).instanceId===incoming.instanceId));
 assert.deepEqual(saved({campaign}).campaign,campaign);
});

test('an explicit primary replacement takes one actual cache gun and preserves the previous gun',()=>{
 const start=ready(),before=structuredClone(start),oldGun=handRecord(model(start).personal,'primary');
 const campaign=recoverRoutePrimary(start,1000,{replace:true,preferredWeapon:1801});
 assert.deepEqual(start,before);assert.equal(model(campaign).personal.weapon,1801);
 const oldCarried=Object.values(campaign.operativeState[1000].inventory).find(row=>row.weapon===oldGun.weapon);
 assert.ok(oldCarried);for(const [key,value]of Object.entries(oldGun))assert.deepEqual(oldCarried[key],value);
 const chest=campaign.sectorStates.retiro.props.find(prop=>prop.id===FINITE_SECTOR_CACHES.retiro.chest);
 assert.ok(!chest.contents.some(row=>row.weapon===1801));assert.equal(chest.contents.filter(row=>row.weapon).reduce((sum,row)=>sum+row.count,0),2);
 assert.equal(campaign.resources.treasury,before.resources.treasury);
 assert.deepEqual(saved({campaign}).campaign,campaign);
});
