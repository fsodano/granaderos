import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {visit,leave} from './local-contract-fixture.mjs';
import {returnCreatedCuyoArsenalField} from './created-cuyo-artillery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const canonical=c=>{const next=structuredClone(c);for(const key of ['sectorStates','sceneStates'])if(next[key])for(const id of Object.keys(next[key]))next[key][id]=expandCellScene(next[key][id]);return next;};
const saved=pair=>{const next=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(canonical(next.campaign),canonical(pair.campaign));assert.deepEqual(next.battle,pair.battle??null);return next;};
const person=(b,id)=>b.units.find(u=>u.id===String(id));
function step(pair,action){
 const original=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,original);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return saved(next);
}

// People, finite packs and injury traps are declared before the factory.
// Native opening/exit/settlement earns every wound, death and arrival marker.
function setup({kits=4,escape=true,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-cuyo-escaped-physician');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','buenos_aires').replaceAll('"camp"','"ensenada"').replaceAll('camp:','ensenada:'));
 // Author two adjacent localities so the real east exit reaches the other
 // controlled sector, and the return still needs its ordinary world march.
 const oldAnchor=d.world.cells.find(cell=>cell.anchor&&cell.location==='buenos_aires'),nextAnchor=d.world.cells.find(cell=>cell.col===16&&cell.row===16);
 Object.assign(oldAnchor,{location:oldAnchor.id,locality:null,anchor:false,district:false,name:'Celda de la frontera'});
 Object.assign(nextAnchor,{location:'buenos_aires',locality:'buenos_aires',anchor:true,district:true,name:'Puesto de regreso'});
 d.world.sectors.find(row=>row.id==='buenos_aires').grid=nextAnchor.grid;
 d.world.places.buenos_aires={lon:(nextAnchor.x-36)/18,lat:33-(nextAnchor.y-36)/18,label:'Puesto de regreso',dx:12,dy:0};
 d.world.districts.buenos_aires=[{id:'buenos_aires:0',sectorId:'buenos_aires',col:nextAnchor.col,row:nextAnchor.row,name:'Puesto de regreso',x:nextAnchor.x,y:nextAnchor.y,urban:false}];
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.startingTerritory.buenos_aires.owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={ensenada:0,buenos_aires:0};
 d.content.characters=Array.from({length:4},(_,i)=>({...structuredClone(base),id:'field-'+i,name:'Campo '+i,nickname:'Campo '+i,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:100,medical:i===0?90:0},startingSupplies:{rations:0,torches:0,medkits:i===0?kits:0,boleadoras:0}}));
 d.maps.ensenada.spawns=[{id:'entry',x:17,y:8,side:'player'},{id:'opposition',x:2,y:8,side:'enemy'}];
 d.maps.ensenada.props=[{id:'wounding-trap',type:'chest',x:17,y:10,footprint:{width:1,height:1},blocksMovement:true},{id:'fatal-trap',type:'chest',x:18,y:10,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.environment.ensenada={doors:[],containers:[['wounding-trap',18],['fatal-trap',100]].map(([id,damage])=>({selector:{type:'chest',id},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage,breathLoss:0,discoveredBy:[]}}}))};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:24,reserve:1,raidEveryHours:240,axis:['buenos_aires']}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id),quotes=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day'});assert.equal(cash-c.resources.treasury,quote.total);quotes.push({id,quote});}
 c=order(c,{type:'createSquad',ids,sector:'ensenada',name:'Campo del arsenal'});const home=c.activeSquadId;
 if(nearExpiry)c=order(c,{type:'wait',hours:23});
 if(escape){
  let pair=visit(c);
  // Pay for the other three bodies to clear the small authored cache apron.
  // Their original deployment is real occupancy, not a reason to move a body
  // or open a trap by editing the returned scene.
  for(const id of ids.slice(1)){
   const actor=person(pair.battle,id),traps=pair.battle.props.filter(prop=>['wounding-trap','fatal-trap'].includes(prop.id));
   const cell=getReachable(pair.battle,actor).filter(point=>point.cost>0&&traps.every(prop=>Math.abs(point.x-prop.x)+Math.abs(point.y-prop.y)>=3)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(cell);
   pair=step(pair,{type:'move',unitId:String(id),x:cell.x,y:cell.y});
  }
  const before=person(pair.battle,ids[0]).hp;pair=takeFiniteCache(pair,ids[0],[],{cacheId:'wounding-trap'});
  assert.ok(person(pair.battle,ids[0]).hp<before&&person(pair.battle,ids[0]).bleeding>0);
  pair=takeFiniteCache(pair,ids[3],[],{cacheId:'fatal-trap'});assert.equal(person(pair.battle,ids[3]).hp,0);
  const exit=pair.battle.exits.find(e=>e.destination==='buenos_aires');assert.ok(exit);
  const actor=person(pair.battle,ids[0]),cell=getReachable(pair.battle,actor).filter(p=>boundaryMatches(pair.battle,p,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(cell);
  pair=step(pair,{type:'move',unitId:String(ids[0]),x:cell.x,y:cell.y});const preview=exitPreview(pair.battle,{unitIds:[String(ids[0])],exitId:exit.id});assert.ok(preview.available,preview.reason);
  pair=step(pair,{type:'exit',unitIds:[String(ids[0])],exitId:exit.id});c=leave(pair);
  assert.equal(c.operativeState[ids[3]].alive,false);assert.equal(operativeLocation(c,ids[0]),'buenos_aires');assert.equal(c.operativeState[ids[0]].arrival.fromSector,'ensenada');assert.ok(c.operativeState[ids[0]].bleeding>0);
  c=order(c,{type:'selectSquad',id:home});
 }
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,ids,home,quotes};
}

function replay(start,events){
 let c=saved({campaign:start}).campaign;
 for(const event of events){
  if(event.event==='createdCuyoFieldAid'){
   const restore=event.orders.findIndex(action=>['assignToSquad','selectSquad'].includes(action.type));assert.ok(restore>0);
   for(const action of event.orders.slice(0,restore))c=order(c,action);
   let pair=visit(c);for(const action of event.steps)pair=step(pair,action);c=leave(pair);
   for(const action of event.orders.slice(restore))c=order(c,action);
   assert.deepEqual(canonical(c),canonical(event.campaign));
  }
  if(['freshRouteOrder','freshRouteRenewal'].includes(event.event))c=order(c,event.action);
 }
 return saved({campaign:c}).campaign;
}

for(const nearExpiry of [false,true])test(`an actual escaped physician earns finite local aid and physical return before the Ensenada care group${nearExpiry?' with current paid renewal':''}`,()=>{
 const {campaign:start,ids,home}=setup({nearExpiry}),original=structuredClone(start),events=[],doctor=ids[0],dead=ids[3],alive=ids.slice(0,3);
 const refused=dispatchCampaign(start,{type:'squad',ids:alive});assert.match(refused.lastError,/mismo sector/,'The old local grouping must reject the real remote survivor.');
 const c=returnCreatedCuyoArsenalField(start,ids,{report:event=>events.push(structuredClone(event))});
 assert.equal(c.activeSquadId,home);assert.deepEqual(c.squad,start.squad);assert.equal(c.operativeState[dead].alive,false);
 assert.ok(alive.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&operativeLocation(c,id)==='ensenada'));
 assert.equal(c.operativeState[doctor].bleeding,0);assert.ok(c.operativeState[doctor].hp>=15&&c.operativeState[doctor].hp<=start.operativeState[doctor].hp);
 const aid=events.find(event=>event.event==='createdCuyoFieldAid');assert.ok(aid&&aid.sector==='buenos_aires');assert.equal(aid.doctor,doctor);assert.ok(aid.steps.some(action=>action.type==='useItem'&&action.unitId===String(doctor)&&action.targetId===String(doctor)));
 assert.equal(start.operativeState[doctor].medkits-c.operativeState[doctor].medkits,aid.steps.filter(action=>action.type==='useItem').length);
 const returned=events.find(event=>event.event==='createdCuyoEscapedFieldReturned');assert.ok(returned&&returned.columns.length===1);assert.deepEqual(returned.ids,[doctor]);assert.ok(returned.columns[0].elapsedSeconds>0&&returned.columns[0].elapsedSeconds<=24*3600);assert.equal(returned.columns[0].journey.mode,'march');
 const routeRenewals=events.filter(event=>event.event==='freshRouteRenewal'),careRenewals=aid.orders.filter(action=>action.type==='renewContract');
 assert.equal(start.resources.treasury-c.resources.treasury,routeRenewals.reduce((sum,event)=>sum+event.price,0)+careRenewals.reduce((sum,action)=>sum+contractQuote(start,rosterFor(start).find(op=>op.id===action.id),'day').price,0));
 if(nearExpiry)assert.ok(routeRenewals.length+careRenewals.length>=alive.length);
 assert.ok(alive.every(id=>contractExpiresSeconds(c.contracts[id])>clock(c)));for(const id of ids)for(const key of ['maxHp','inventory','ammoStock','weaponDropped','condition'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
 assert.deepEqual(canonical(replay(start,events)),canonical(c));assert.deepEqual(returnCreatedCuyoArsenalField(saved({campaign:start}).campaign,ids),c);assert.deepEqual(start,original);
 const grouped=order(c,{type:'squad',ids:alive});assert.deepEqual(grouped.squad,alive);saved({campaign:grouped});
});

test('without an actual field departure the existing local force has no recovery orders',()=>{
 const {campaign:start,ids}=setup({escape:false}),before=structuredClone(start),events=[];const c=returnCreatedCuyoArsenalField(start,ids,{report:event=>events.push(event)});
 assert.equal(c,start);assert.deepEqual(events,[]);assert.deepEqual(start,before);
});

test('a real escaped physician without finite dressings refuses care before a return is claimed',()=>{
 const {campaign:start,ids}=setup({kits:0}),before=structuredClone(start),events=[];
 assert.throws(()=>returnCreatedCuyoArsenalField(start,ids,{report:event=>events.push(event)}),/finite dressings/);
 assert.ok(!events.some(event=>event.event==='createdCuyoEscapedFieldReturned'));assert.deepEqual(start,before);
});
