import {withLegacyRepairReserve} from './custody-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle} from '../game/tactical.js';
import {serviceReturnSources,MAX_SERVICE_RETURN_STACKS} from '../game/service-equipment-return.js';
import {stackAmmunitionByType} from '../game/physical-ammunition.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {collectReturnedServiceKit} from './returned-service-kit.mjs';

const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
const physical=stack=>{const {item,...record}=stack;return record;};
const sort=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const ammo=rows=>rows.reduce((total,stack)=>{for(const[type,count]of Object.entries(stackAmmunitionByType(stack)))total[type]=(total[type]??0)+count;return total;},{});

test('a local former-carrier return is collected exactly once before rehiring, with physical identity, wear, ammunition and paid clock preserved',()=>{
 let c=initialCampaign(45);c.loadouts[4]={weapon:1800};Object.assign(c.operativeState[4],{weaponInstanceId:'return-test-rifle',condition:61,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'return-test-bayonet',condition:73}}});
 c=withLegacyRepairReserve(c,4);
 // The existing bounded cache is full before the first visit, so ordinary
 // dismissal must retain the finite return on its original former carrier.
 c.serviceEquipmentReturns={version:1,nextId:2,entries:[{id:'service-return-1',siteId:'cordoba',sectorId:'cordoba',entryEdge:'S',entryAnchor:{x:10,y:15},operativeId:3,repairPoints:0,items:Array.from({length:MAX_SERVICE_RETURN_STACKS},(_,i)=>({selection:`stock-${i}`,stack:{item:'rations',count:1,weight:.5}}))}]};
 c=order(c,{type:'dismiss',id:4});assert.ok(c.operativeState[4].serviceEquipmentReturn);assert.equal(contractQuote(c,rosterFor(c).find(op=>op.id===4)).available,false);
 c=order(c,{type:'visitSector'});const request=c.pendingBattle;
 const b=createBattle(request.squad.map((u,i)=>({...u,x:2,y:2+i})),{...request,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[],props:[],npcs:request.npcs.map((n,i)=>({...n,x:10-i,y:8}))});
 c=order(c,{type:'leaveSector',battleId:request.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 const before=structuredClone(c),source=serviceReturnSources(c,'retiro').filter(row=>row.operativeId===4&&row.stack).map(row=>row.stack),ground=c.sectorStates.retiro.groundItems.length;
 const repair=serviceReturnSources(c,'retiro').filter(row=>row.operativeId===4).reduce((sum,row)=>sum+(row.repairPoints??0),0),carriedRepair=[3,10].reduce((sum,id)=>sum+(c.operativeState[id].toolkitPoints??0),0);
 const result=collectReturnedServiceKit(c,'retiro',[3,10]);assert.deepEqual(c,before);
 const placed=result.sectorStates.retiro.groundItems.slice(ground).map(({id,type,x,y,tacticalLevel,knownToPlayer,...stack})=>stack);
 assert.equal([3,10].reduce((sum,id)=>sum+(result.operativeState[id].toolkitPoints??0),0),carriedRepair+repair);
 assert.deepEqual(sort(placed.map(physical)),sort(source.map(physical)));assert.deepEqual(ammo(placed),ammo(source));
 assert.equal(result.operativeState[4].serviceEquipmentReturn,undefined);assert.equal(serviceReturnSources(result,'retiro').filter(row=>row.operativeId===4).length,0);assert.equal(contractQuote(result,rosterFor(result).find(op=>op.id===4)).available,true);
 assert.deepEqual({hour:result.hour,second:result.secondOfHour,treasury:result.resources.treasury},{hour:before.hour,second:before.secondOfHour,treasury:before.resources.treasury});
 const again=collectReturnedServiceKit(result,'retiro',[3,10]);assert.deepEqual(again,result);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
});
