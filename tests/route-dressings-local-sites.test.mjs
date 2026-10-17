import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {enterSector} from '../game/world.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {order,saved,tactical,leave} from './local-contract-fixture.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';

const dressings=model=>model.entries.filter(row=>JSON.parse(row.expected).item==='medkits');

function localMissionStock(){
 const content=defaultContentPackage();content.headquarters='tucuman';delete content.startingTerritory;
 for(const name of ['person-110','person-123'])content.characters.find(person=>person.id===name).arrivalHours=0;
 assert.deepEqual(validateContentPackage(content),[]);
 let campaign=initialCampaign(42,content);
 for(const id of [110,123])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 // This declared conference-access state is fixed before its Native factory.
 // Stock comes only from the current paid donor's issued finite pack.
 campaign.phase=2;campaign=order(saved({campaign}).campaign,{type:'visitMission',mission:'yatasto'});
 let pair=saved({campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0})});
 assert.ok(pair.battle.units.find(unit=>unit.id==='123').medkits>1);
 pair=tactical(pair,{type:'drop',unitId:'123',item:'medkits',count:1});
 campaign=saved({campaign:leave(pair)}).campaign;
 return campaign;
}

test('route dressings collect a local secondary scene through its exact Native source, preserving town, paid packs and saved replay',()=>{
 const start=localMissionStock(),before=structuredClone(start),events=[];
 assert.deepEqual(sectorInventorySites(start,'tucuman').map(site=>site.id),['tucuman','yatasto']);
 const model=sectorInventoryModel(start,'yatasto',rosterFor(start),110),row=dressings(model).find(row=>row.reachable);
 assert.ok(row);assert.equal(model.operativeId,110);const target=start.operativeState[110].medkits+1;
 const reserves=Object.fromEntries(start.recruited.map(id=>[id,start.operativeState[id].medkits]));
 const result=supplyRouteDressings(start,110,target,{reserves,report:event=>events.push(event)});
 const expected=saved({campaign:order(start,{type:'sectorInventory',sector:'yatasto',operativeId:110,direction:'take',sourceKey:row.key,expected:row.expected,count:1})}).campaign;
 assert.deepEqual(result,expected);assert.deepEqual(start,before);
 assert.equal(result.operativeState[110].medkits,target);assert.equal(result.operativeState[123].medkits,start.operativeState[123].medkits);
 for(const key of ['sectorStates','resources','contracts','hour','secondOfHour','squads','activeSquadId'])assert.deepEqual(result[key],start[key],key);
 assert.equal(dressings(sectorInventoryModel(result,'yatasto',rosterFor(result),110)).length,0);
 assert.ok(events.some(event=>event.event==='routeDressingsCollected'&&event.sector==='tucuman'&&event.siteId==='yatasto'));
 assert.equal(events.some(event=>event.event==='routeDressingDonation'),false);assert.deepEqual(saved({campaign:result}).campaign,result);
});

test('a selected alternate finite cache is discovered and debited through paid Native movement instead of the stock cache ID',()=>{
 const declared=scaffoldDocuments('declared-local-dressings'),cacheId='local-dressing-chest';
 declared.maps.camp.props=[{id:cacheId,type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 declared.world.physical.caches.camp={chest:cacheId,contents:[{item:'medkits',count:3,weight:.2}]};
 const input=structuredClone(declared),content=compileCampaignPackage(declared.manifest,declared);
 let start=order(initialCampaign(8,content),{type:'recruitCivic',id:2000,term:'week'});start=saved({campaign:start}).campaign;
 const before=structuredClone(start),target=start.operativeState[2000].medkits+2,events=[],result=supplyRouteDressings(start,2000,target,{report:event=>events.push(event)});
 assert.deepEqual(declared,input);assert.deepEqual(start,before);assert.equal(result.operativeState[2000].medkits,target);
 const chest=result.sectorStates.camp.props.find(prop=>prop.id===cacheId);assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents.find(stack=>stack.item==='medkits').count,1);
 assert.equal(result.resources.treasury,start.resources.treasury);assert.deepEqual(result.contracts,start.contracts);
 assert.ok(result.hour*3600+(result.secondOfHour??0)>start.hour*3600+(start.secondOfHour??0),'Discovery spends only the actual Native approach/open clock.');
 assert.equal(result.operativeState[2000].hp,start.operativeState[2000].hp);
 assert.deepEqual(supplyRouteDressings(saved({campaign:before}).campaign,2000,target),result);
 assert.deepEqual(saved({campaign:result}).campaign,result);assert.ok(events.some(event=>event.siteId==='camp'));
});
