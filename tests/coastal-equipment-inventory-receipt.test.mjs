import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {makeOutfit} from '../game/outfits.js';
import {handRecord} from '../game/tactical-inventory.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {assertCoastalEquipmentDebit} from './created-ending-route.mjs';

const sector='camp',operativeId=2000,cacheId='coastal-equipment-receipt-cache';
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const inventory=c=>sectorInventoryModel(c,sector,rosterFor(c),operativeId);
const repair={item:'inventory:receipt-repair-kit',kind:'repair-kit',name:'Herramientas del depósito',count:1,weight:2,repairPoints:73,instanceId:'coastal-receipt-repair-kit'};
const cases=[
 {slot:'headwear',stack:{item:'headwear',...makeOutfit('hat',73),instanceId:'coastal-receipt-hat'}},
 {slot:'blade',stack:{item:'weapon',weapon:1813,count:1,weight:1,loaded:0,condition:67,jammed:false,instanceId:'coastal-receipt-blade'}},
];

function setup(stack){
 const declared=scaffoldDocuments('coastal-equipment-receipt');
 declared.maps.camp.props=[{id:cacheId,type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 declared.world.physical.caches.camp={chest:cacheId,contents:[structuredClone(stack),structuredClone(repair)]};
 const original=structuredClone(declared),content=compileCampaignPackage(declared.manifest,declared);
 assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const quote=contractQuote(c,rosterFor(c).find(op=>op.id===operativeId),'week'),cash=c.resources.treasury;
 assert.equal(quote.available,true);assert.ok(quote.total>0);
 c=order(c,{type:'recruitCivic',id:operativeId,term:'week'});
 assert.equal(c.resources.treasury,cash-quote.total);assert.equal(c.contracts[operativeId].paid,quote.price);
 const beforeClock=clock(c),beforeInventory=structuredClone(c.operativeState[operativeId].inventory);
 c=leaveFiniteCache(takeFiniteCache(visit(c),operativeId,[],{cacheId}));
 assert.ok(clock(c)>beforeClock,'the real visit pays its cache approach and opening');
 assert.deepEqual(c.operativeState[operativeId].inventory===undefined?{}:c.operativeState[operativeId].inventory,beforeInventory===undefined?{}:beforeInventory,'opening the chest grants no equipment');
 const model=inventory(c);assert.equal(model.operativeId,operativeId);assert.equal(model.reason,null);
 assert.deepEqual(declared,original);return saved({campaign:c}).campaign;
}

for(const {slot,stack}of cases)test(`coastal ${slot} receipt preserves finite metadata when exhaustion reuses the container key`,()=>{
 const start=setup(stack),unchanged=structuredClone(start),model=inventory(start),source=model.entries.find(row=>JSON.parse(row.expected).instanceId===stack.instanceId);
 assert.ok(source?.reachable);assert.equal(source.count,1);
 const take={type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1};
 let c=order(start,take),current=inventory(c);
 assert.equal(assertCoastalEquipmentDebit(model,current,source),0);
 const reused=current.entries.find(row=>row.key===source.key);assert.ok(reused);
 assert.deepEqual(JSON.parse(reused.expected),repair,'the old source key now names the unchanged repair item');
 const carried=current.carried.find(row=>row.inventoryKey&&JSON.parse(row.expected??'{}').instanceId===stack.instanceId);assert.ok(carried);
 const {item,...record}=stack;assert.deepEqual(JSON.parse(carried.expected),record);assert.equal(carried.count,1);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(clock(c),clock(start));assert.deepEqual(c.contracts,start.contracts);
 assert.deepEqual(saved({campaign:c}).campaign,c);
 // The stale expected record is refused atomically and is never reused.
 const accepted=structuredClone(c),refused=dispatchCampaign(c,take);
 assert.ok(refused.lastError);assert.deepEqual({...refused,lastError:null},{...accepted,lastError:null});assert.deepEqual(c,accepted);
 const equip={type:'sectorInventory',sector,operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot};
 c=order(c,equip);
 if(slot==='blade')for(const [key,value]of Object.entries(record))assert.deepEqual(handRecord(inventory(c).personal,'blade')[key],value,key);
 else assert.deepEqual(c.operativeState[operativeId][slot],record);
 assert.deepEqual(c.sectorStates[sector].props.find(prop=>prop.id===cacheId).contents,[repair]);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(clock(c),clock(start));assert.deepEqual(c.contracts,start.contracts);
 let replay=saved({campaign:start}).campaign;
 for(const action of [take,equip])replay=saved({campaign:order(replay,action)}).campaign;
 assert.deepEqual(replay,c);assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(start,unchanged);
});
