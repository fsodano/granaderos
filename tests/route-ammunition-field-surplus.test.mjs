import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';

const family='ammoMusket';
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const carried=(campaign,id)=>carriedAmmunition(rosterFor(campaign).find(person=>person.id===id),campaign.operativeState[id]);
const total=(campaign,id)=>{const unit=carried(campaign,id);return unit.loaded+ammoCount(unit,family);};
const owned=campaign=>campaign.recruited.reduce((sum,id)=>sum+total(campaign,id),campaign.ammunitionStores.retiro?.[family]??0);

function declaredScarcity({fieldSurplus=true}={}){
 const content=defaultContentPackage(),names=['person-110','person-114','person-115','person-123'];
 Object.assign(content,{id:'field-ammunition-scarcity',name:'Reserva finita de cartuchos',scenario:'generic-v1',includeOriginalResidents:false,
  world:structuredClone(DEFAULT_WORLD),characters:content.characters.filter(person=>names.includes(person.id)),placements:[],quests:[],errands:[],roadsideDiscoveries:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 content.rules.startingTreasury=20000;
 content.world.physical={version:1,caches:{},arsenals:{},environment:{}};
 for(const person of content.characters)Object.assign(person,{weapon:'firearm-1800',arrivalHours:0,traits:[],abilities:[]});
 assert.deepEqual(validateContentPackage(content),[]);
 const [donor,recipient,rear,otherRear]=names.map(name=>operativeIdForCharacter(content,name));
 let campaign=initialCampaign(8,content);
 for(const id of [donor,recipient,rear,otherRear])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 assert.equal(owned(campaign),40,'Each paid first hire owns only its actual ten-round issue.');
 campaign=order(campaign,{type:'unloadAmmunition',operativeId:recipient});
 campaign=order(campaign,{type:'ammunition',operativeId:recipient,family,quantity:10,direction:'store'});
 campaign=order(campaign,{type:'ammunition',operativeId:fieldSurplus?donor:rear,family,quantity:10,direction:'take'});
 // A separate rear reserve already owns sixteen rounds. This input floor
 // comes from a real transfer of another paid person's finite loose stock.
 if(fieldSurplus){
  campaign=order(campaign,{type:'ammunition',operativeId:otherRear,family,quantity:6,direction:'store'});
  campaign=order(campaign,{type:'ammunition',operativeId:rear,family,quantity:6,direction:'take'});
 }
 assert.equal(total(campaign,recipient),0);assert.equal(owned(campaign),40);
 assert.equal(campaign.ammunitionStores.retiro[family],0);
 return {campaign,donor,recipient,rear,otherRear};
}

test('paid field surplus reaches the empty member through native store/take, keeping loaded rounds and rear floors exact',()=>{
 const {campaign:start,donor,recipient,rear,otherRear}=declaredScarcity(),before=structuredClone(start);
 const result=supplyRouteAmmunition(start,[donor,recipient],{shareFieldSurplus:true}),after=result.campaign;
 assert.deepEqual(start,before);assert.equal(total(after,donor),10);assert.equal(total(after,recipient),10);
 assert.equal(total(after,rear),16);assert.equal(owned(after),owned(start));assert.equal(carried(after,donor).loaded,carried(start,donor).loaded);
 for(const id of [rear,otherRear])assert.deepEqual(after.operativeState[id],start.operativeState[id]);
 for(const key of ['resources','contracts','hour','secondOfHour','squads','sectorStates','sceneStates'])assert.deepEqual(after[key],start[key],key);
 assert.deepEqual(result.transactions.map(row=>[row.action.operativeId,row.action.direction,row.quantity,row.cost]),[[donor,'store',10,0],[recipient,'take',10,0]]);
 let replay=start;for(const {action}of result.transactions)replay=order(replay,action);
 assert.deepEqual(replay,after);assert.deepEqual(decodeSave(encodeSave(after)).campaign,after);
 assert.deepEqual(supplyRouteAmmunition(after,[donor,recipient],{shareFieldSurplus:true}),{campaign:after,transactions:[]});
});

test('an exhausted field refuses instead of taking a rear reserve or inventing a cache or market purchase',()=>{
 const {campaign:start,donor,recipient,rear}=declaredScarcity({fieldSurplus:false}),before=structuredClone(start),events=[];
 assert.equal(total(start,donor),10);assert.equal(total(start,rear),20);
 assert.throws(()=>supplyRouteAmmunition(start,[donor,recipient],{shareFieldSurplus:true,report:event=>events.push(event)}),/Finite ammunition shortage.*10 ammoMusket rounds are missing/);
 assert.deepEqual(start,before);const shortage=events.at(-1);assert.equal(shortage.event,'ammunitionShortage');
 assert.equal(shortage.publicStock.depot,0);assert.equal(shortage.publicStock.sites.reduce((sum,site)=>sum+site.ammunition.length,0),0);
 assert.ok(shortage.publicStock.localCarriers.some(person=>person.id===rear&&!person.field&&person.loaded+person.loose===20));
 assert.equal(events.some(event=>event.action),false,'No transfer is admitted below a field floor or from the protected rear.');
});

test('field redistribution stays opt-in for existing route callers',()=>{
 const {campaign:start,donor,recipient}=declaredScarcity(),before=structuredClone(start);
 assert.throws(()=>supplyRouteAmmunition(start,[donor,recipient]),/Finite ammunition shortage.*10 ammoMusket/);
 assert.deepEqual(start,before);assert.equal(total(start,donor),20);assert.equal(total(start,recipient),0);
});
