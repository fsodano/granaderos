import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {assertNorthernMedicalTransfer} from './northern-route.mjs';

const sector='camp',operativeId=2000,cacheId='medical-receipt-cache';
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const inventory=c=>sectorInventoryModel(c,sector,rosterFor(c),operativeId);
const medkits=model=>model.entries.filter(row=>JSON.parse(row.expected).item==='medkits');

function setup(){
 const declared=scaffoldDocuments('northern-medical-receipt');
 declared.content.characters[0].attributes.medical=80;
 declared.maps.camp.props=[{id:cacheId,type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 declared.world.physical.caches.camp={chest:cacheId,contents:[
  {item:'medkits',count:2,weight:.2},
  {item:'inventory:receipt-repair-kit',kind:'repair-kit',name:'Herramientas del depósito',count:1,weight:2,repairPoints:73,instanceId:'receipt-repair-kit'},
 ]};
 const original=structuredClone(declared),content=compileCampaignPackage(declared.manifest,declared);
 assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const cash=c.resources.treasury,quote=contractQuote(c,rosterFor(c).find(op=>op.id===operativeId),'week');
 assert.equal(quote.available,true);assert.ok(quote.total>0);
 c=order(c,{type:'recruitCivic',id:operativeId,term:'week'});
 assert.equal(cash-c.resources.treasury,quote.total);assert.equal(c.contracts[operativeId].paid,quote.price);
 const startClock=clock(c),startKits=c.operativeState[operativeId].medkits;
 const opened=takeFiniteCache(visit(c),operativeId,[],{cacheId});
 c=leaveFiniteCache(opened);
 assert.ok(clock(c)>startClock,'the actual cache visit pays its approach and opening clock');
 assert.equal(c.operativeState[operativeId].medkits,startKits,'opening the chest cannot grant its supplies');
 const chest=c.sectorStates[sector].props.find(prop=>prop.id===cacheId);
 assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents[0].count,2);
 assert.equal(inventory(c).operativeId,operativeId);assert.equal(inventory(c).reason,null);
 assert.deepEqual(declared,original);return saved({campaign:c}).campaign;
}

test('paid cache collection conserves the medical pool when an exhausted container key becomes a different finite item',()=>{
 const start=setup(),unchanged=structuredClone(start),tape=[],originalRepair=structuredClone(start.sectorStates[sector].props.find(prop=>prop.id===cacheId).contents[1]);
 let c=start;
 for(const remaining of [1,0]){
  const model=inventory(c),row=medkits(model).find(row=>row.reachable);assert.ok(row);assert.equal(row.count,remaining+1);
  const before=c,action={type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1};
  c=order(c,action);tape.push(action);assertNorthernMedicalTransfer(before,c,operativeId,sector);
  assert.equal(medkits(inventory(c)).reduce((sum,row)=>sum+row.count,0),remaining);
  assert.equal(c.operativeState[operativeId].medkits,start.operativeState[operativeId].medkits+2-remaining);
  assert.deepEqual(c.sectorStates[sector].props.find(prop=>prop.id===cacheId).contents.find(stack=>stack.instanceId===originalRepair.instanceId),originalRepair);
  assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(clock(c),clock(start));
  assert.deepEqual(saved({campaign:c}).campaign,c);
  const current=inventory(c).entries.find(entry=>entry.key===row.key);
  if(remaining){assert.equal(JSON.parse(current.expected).item,'medkits');assert.equal(current.count,1);}
  else {assert.deepEqual(JSON.parse(current.expected),originalRepair);assert.equal(current.count,1,'the exhausted medkit index is now the unrelated repair item');}
  // Each refused result is terminal. Continue only from the successful input.
  const accepted=structuredClone(c),refused=dispatchCampaign(c,action);
  assert.ok(refused.lastError);assert.deepEqual({...refused,lastError:null},{...accepted,lastError:null});assert.deepEqual(c,accepted);
 }
 let replay=saved({campaign:start}).campaign;
 for(const action of tape)replay=saved({campaign:order(replay,action)}).campaign;
 assert.deepEqual(replay,c);assert.deepEqual(start,unchanged);
 assert.deepEqual(c.sectorStates[sector].props.find(prop=>prop.id===cacheId).contents,[originalRepair]);
});
