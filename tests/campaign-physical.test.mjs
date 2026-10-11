import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {DEFAULT_PHYSICAL,physicalSourcesFor,finiteCachesFor,finiteArsenalsFor} from '../game/campaign-physical.js';
import {validateCampaignPhysical} from '../game/campaign-physical-validation.js';
import {authoredEnvironment} from '../game/environment-interactions.js';
import {buildSectorMap} from '../game/maps.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {prepareFiniteArsenalRequest,finiteArsenalHint} from '../game/finite-artillery-arsenals.js';
import {order,visit,saved,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const empty=()=>({version:1,caches:{},arsenals:{},environment:{}});
function customPackage({physical=true}={}){
 const content=defaultContentPackage(),merc=structuredClone(content.characters.find(c=>c.id==='person-110'));
 Object.assign(content,{id:'physical-test',name:'La posta',scenario:'generic-v1',includeOriginalResidents:false,world:structuredClone(DEFAULT_WORLD),characters:[merc],placements:[],quests:[],errands:[],roadsideDiscoveries:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 Object.assign(merc,{name:'Guardia de la posta',recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],abilities:[],arrivalHours:0});
 delete content.world.physical;
 if(physical){
  const cache=DEFAULT_PHYSICAL.caches.retiro;
  content.world.physical=empty();
  content.world.physical.caches.retiro={chest:cache.chest,contents:[{item:'medkits',count:4,weight:.2},{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos de la posta',count:9,weight:.04}]};
  content.world.physical.arsenals.retiro={version:1,sector:'retiro',chest:cache.chest,pieces:[{id:'arsenal:post:1',type:'swivel',side:'player',loaded:false,ammo:2}]};
 }
 return content;
}

test('stock physical source is one world object and its generated metadata stays unchanged',()=>{
 assert.equal(DEFAULT_PHYSICAL,DEFAULT_WORLD.physical);assert.deepEqual(validateCampaignPhysical(DEFAULT_PHYSICAL),[]);
 const records=Object.fromEntries([...Object.keys(DEFAULT_PHYSICAL.caches),...Object.keys(DEFAULT_PHYSICAL.environment)].map(sector=>[sector,authoredEnvironment(sector,buildSectorMap({sector,squad:[],enemies:[]}))]));
 assert.equal(createHash('sha256').update(JSON.stringify(records)).digest('hex'),'73a8f8358a740dcda3b900a3ee1bf512911bce4e3e8e3a66c59500ee64a831b5');
});

test('generic stock sector names do not enable inherited caches, locks, or arsenal guns',()=>{
 const content=customPackage({physical:false});assert.deepEqual(validateContentPackage(content),[]);
 for(const sector of ['retiro','buenos_aires','mendoza','yatasto']){
  const request={sector,squad:[],enemies:[],campaignPackage:content},map=buildSectorMap(request);
  assert.deepEqual(authoredEnvironment(sector,map,request),{doors:[],containers:[]});
 }
 assert.deepEqual(finiteCachesFor(content),{});assert.deepEqual(finiteArsenalsFor(content),{});
 const state={contentCampaign:{package:content},sectors:{buenos_aires:{owner:'patriot'}},location:'buenos_aires'},request={sector:'buenos_aires',exploration:true,squad:[{id:2000}]};
 prepareFiniteArsenalRequest(state,request);assert.equal(request.finiteArtilleryArsenal,undefined);assert.deepEqual(request.finiteResourceDefinitions,empty());assert.equal(finiteArsenalHint(state),null);
});

test('custom physical sources use configured quantities and retain exact custody through save and reentry',()=>{
 const content=customPackage(),id=operativeIdForCharacter(content,'person-110');assert.deepEqual(validateContentPackage(content),[]);
 let state=order(initialCampaign(8,content),{type:'recruitCivic',id,term:'week'}),pair=visit(state);
 assert.deepEqual(pair.campaign.pendingBattle.finiteResourceDefinitions,content.world.physical);
 const cacheId=content.world.physical.caches.retiro.chest,chest=()=>pair.battle.props.find(prop=>prop.id===cacheId);
 assert.deepEqual(chest().contents,content.world.physical.caches.retiro.contents);assert.deepEqual(pair.battle.artillery,[]);
 pair=takeFiniteCache(pair,id,[{item:'medkits',count:1}],{cacheId});
 assert.equal(chest().contents.find(item=>item.item==='medkits').count,3);
 assert.deepEqual(pair.battle.artillery.map(({id,type,side,loaded,ammo})=>({id,type,side,loaded,ammo})),content.world.physical.arsenals.retiro.pieces);
 const retained=structuredClone(chest().contents);pair=saved(pair);assert.deepEqual(chest().contents,retained);
 state=saved({campaign:leave(pair)}).campaign;assert.ok(state.artilleryArsenalRecoveries.retiro);
 pair=visit(state);assert.deepEqual(chest().contents,retained);assert.equal(pair.battle.artillery.length,1);assert.equal(pair.battle.artillery[0].ammo,2);assert.equal(pair.campaign.pendingBattle.finiteArtilleryArsenal,undefined);
 const restored=restoreCampaign(serializeCampaign(pair.campaign));assert.deepEqual(physicalSourcesFor(restored),content.world.physical);
 const forged=structuredClone(pair.campaign);forged.sectorStates.retiro.finiteResourceDefinitions.arsenals.retiro.pieces[0].ammo=6;
 assert.throws(()=>restoreCampaign(serializeCampaign(forged)),/fuentes físicas|arsenal/i);
 const refill=structuredClone(pair.campaign);refill.sectorStates.retiro.artillery[0].ammo=3;
 assert.throws(()=>restoreCampaign(serializeCampaign(refill)),/munición añadida|arsenal/i);
});

test('physical admission rejects invalid stacks, duplicated identities and impossible arsenal ammunition',()=>{
 for(const alter of [
  physical=>physical.caches.retiro.contents[0].count=0,
  physical=>physical.arsenals.retiro.pieces[0].ammo=-1,
  physical=>physical.arsenals.retiro.pieces.push(structuredClone(physical.arsenals.retiro.pieces[0])),
  physical=>physical.arsenals.retiro.pieces[0].id='piece-1',
  physical=>physical.environment.retiro={doors:[],containers:[{selector:{type:'chest',id:'bad'},configuration:{type:'chest',locked:true,open:true}}]},
 ]){const content=customPackage();alter(content.world.physical);assert.ok(validateCampaignPhysical(content.world.physical,content.world).length>0);assert.ok(validateContentPackage(content).length>0);}
});
