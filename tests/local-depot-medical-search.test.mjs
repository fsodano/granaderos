import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,lookPreview,climbPreview,carriedWeight,carryCapacity} from '../game/tactical.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {wallEdgeCells} from '../game/wall-geometry.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint,sameCell,sameSurface} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {searchLocalDepotDressings} from './local-depot-medical-search.mjs';

const sector='cordoba',clinic='tucuman',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=pair=>{const next=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(next,{campaign:pair.campaign,battle:pair.battle??null});return next;};
const unit=(b,id)=>b.units.find(u=>u.id===String(id));
function step(pair,action){
 const before=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,before);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return saved(next);
}
function move(pair,id,point){
 for(let n=0;!sameCell(unit(pair.battle,id),point)&&n<80;n++){
  const u=unit(pair.battle,id),route=getReachable(pair.battle,u,{stopAt:p=>sameCell(p,point)})[0];assert.ok(route?.path.length,JSON.stringify({from:spacePoint(u),to:point,stance:u.stance,energy:u.energy,mode:pair.battle.mode,status:pair.battle.status}));const before=spacePoint(u),next=route.path[0];
  if(!sameSurface(u,next)){const quote=climbPreview(pair.battle,u,{linkId:next.linkId});assert.equal(quote.valid,true,quote.reason);pair=step(pair,{type:'climb',unitId:String(id),linkId:next.linkId});}
  else pair=step(pair,{type:'move',unitId:String(id),...spacePoint(next)});assert.notDeepEqual(spacePoint(unit(pair.battle,id)),before);
 }
 assert.ok(sameCell(unit(pair.battle,id),point));return pair;
}

// All content is validated before the factory. The finite body is earned by
// an actual lethal trap, while the guard is not present to inspect it.
function setup({kits=6,closed=false,nearExpiry=false,raid=false,guardHP=80,packedGuard=false,wide=false,sharedHome=false}={}){
 const d=scaffoldDocuments('declared-local-depot-search');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector).replaceAll('"camp"','"tucuman"').replaceAll('camp:', 'tucuman:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={[clinic]:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=Array.from({length:sharedHome?15:10},(_,i)=>({...structuredClone(base),id:'depot-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:i===2?90:0,strength:packedGuard&&i===0?30:100},startingSupplies:{rations:packedGuard&&i===0?6:0,torches:packedGuard&&i===0?4:0,medkits:i===1?kits:i===2?2:0,boleadoras:packedGuard&&i===0?2:0},
  ...(i===0?{startingCondition:{hp:guardHP,bleeding:0,bandaged:80-guardHP,energy:100,fatigue:0}}:{}),
  ...(i===10?{startingCondition:{hp:80,bleeding:0,bandaged:0,energy:34,fatigue:60}}:{}),
  ...(i===3?{startingCondition:{hp:50,bleeding:0,bandaged:30,energy:100,fatigue:0}}:{})}));
 const trapPoint=wide?{x:19,y:15}:{x:4,y:12},roofOrigin=wide?{x:0,y:0}:{x:12,y:5};
 d.maps[sector].props=[{id:'actual-trap',type:'chest',...trapPoint,footprint:{width:1,height:1},blocksMovement:true}];
 d.maps[sector].upperSurfaces=Array.from({length:6},(_,i)=>({id:'depot-post-'+i,x:roofOrigin.x+i%3,y:roofOrigin.y+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'depot-access',kind:'climb',from:{x:roofOrigin.x,y:roofOrigin.y+2,tacticalLevel:0},to:{x:roofOrigin.x,y:roofOrigin.y+1,tacticalLevel:1}}];
 if(closed)d.maps[sector].wallEdges=Array.from({length:16},(_,y)=>({id:y===8?'depot-gate':'partition-'+y,axis:'y',x:9,y,tacticalLevel:0,type:y===8?'door':'wall',material:'adobe',blocked:y!==8,blocksSight:y!==8,cover:y===8?0:40,...(y===8?{doorId:'depot-gate',open:true,locked:false}:{})}));
 d.world.physical.environment[sector]={doors:[],containers:[{selector:{type:'chest',id:'actual-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?1:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const ids=rosterFor(c).map(op=>op.id),guard=ids[0],fallen=ids[1],doctor=ids[2],patient=ids[3],companions=ids.slice(10),hires=[];
 const hire=(id,at)=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:at});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});};
 for(const id of ids.slice(1,10))hire(id,id===fallen?sector:clinic);
 c=order(c,{type:'createSquad',sector,ids:[fallen],name:'Inspección del depósito'});const home=c.activeSquadId;
 c=order(c,{type:'createSquad',sector:clinic,ids:[doctor,patient],name:'Clínica en servicio'});
 for(const id of ids.slice(4,10))c=order(c,{type:'createSquad',sector:clinic,ids:[id],name:'Guardia '+id});assert.equal(c.squads.filter(q=>q.members.length).length,8);
 c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'visitSector'});let pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});
 assert.equal(inventoryUsage(unit(pair.battle,fallen)).overloaded,false,'The living stock carrier starts with legal finite pockets.');assert.ok(carriedWeight(unit(pair.battle,fallen))<=carryCapacity(unit(pair.battle,fallen)),'The actual stock carrier can lawfully approach the trap with its declared load.');
 const chest=pair.battle.props.find(p=>p.id==='actual-trap'),approach=getReachable(pair.battle,unit(pair.battle,fallen)).filter(p=>Math.abs(p.x-chest.x)+Math.abs(p.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(approach);pair=move(pair,fallen,approach);
 const look={type:'look',unitId:String(fallen),...spacePoint(chest)};if(lookPreview(pair.battle,unit(pair.battle,fallen),chest).valid)pair=step(pair,look);
 pair=step(pair,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:'actual-trap',verb:'open'}});assert.equal(unit(pair.battle,fallen).hp,0);assert.equal(unit(pair.battle,fallen).medkits,kits);assert.equal(pair.battle.props.find(p=>p.id==='actual-trap').trap.armed,false);
 c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(c.operativeState[fallen].alive,false);assert.equal(c.sectorStates[sector].units.find(u=>u.id===String(fallen)).knownToPlayer,undefined);
 hire(guard,sector);c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'squad',ids:[guard]});c=stageRouteRoofDefenders(c,[guard]);
 if(closed){
  const post=spacePoint(c.operativeState[guard].residentPosition);c=order(c,{type:'visitSector'});pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});pair=step(pair,{type:'movement',unitId:String(guard),movement:'walk'});
  const gate=pair.battle.wallEdges.find(edge=>edge.doorId==='depot-gate'),right=wallEdgeCells(gate).find(point=>point.x===gate.x);pair=move(pair,guard,right);assert.equal(unit(pair.battle,guard).x,gate.x);assert.ok(wallEdgeCells(gate).some(point=>sameCell(point,unit(pair.battle,guard))));assert.ok(post.x>=gate.x,'The roof is on the guard\'s right-hand side of this vertical edge.');
  pair=step(pair,{type:'door',unitId:String(guard),doorId:'depot-gate',open:false});const back=getReachable(pair.battle,unit(pair.battle,guard),{stopAt:p=>sameCell(p,post)})[0];assert.ok(back?.path.every(point=>point.x>=gate.x),'The exact roof return stays on the same right side after the gate closes.');pair=move(pair,guard,post);pair=step(pair,{type:'stance',unitId:String(guard),stance:'crouched'});
  c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 }
 if(sharedHome){
  for(const id of companions)hire(id,sector);c=order(c,{type:'squad',ids:[guard,...companions]});
  c=order(c,{type:'visitSector'});pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});
  c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
  for(const id of companions)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});c=order(c,{type:'setSleep',operativeId:companions[0],asleep:true});
  for(const id of companions)assert.ok(c.operativeState[id].residentPosition);assert.equal(c.operativeState[companions[0]].energy,34);
 }
 c=order(c,{type:'assignCare',operativeId:guard,assignment:'rest'});
 if(nearExpiry){const expiry=contractExpiresSeconds(c.contracts[guard]);for(let n=0;expiry-clock(c)>1800&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,expiry-clock(c)-1800)});assert.equal(expiry-clock(c),1800);}
 if(raid){
  for(let n=0;!c.enemyGroups.some(g=>g.status==='marching'&&g.target===sector)&&n<3;n++)c=order(c,{type:'wait',hours:1});const group=c.enemyGroups.find(g=>g.status==='marching'&&g.target===sector);assert.ok(group);const target=group.arrivalAt*3600-2;
  for(let n=0;clock(c)<target&&n<10;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);
 }else if(!nearExpiry&&!sharedHome){const target=(Math.floor(clock(c)/3600)+1)*3600-2;for(let n=0;clock(c)<target&&n<2;n++)c=order(c,{type:'advanceStrategicTime',seconds:target-clock(c)});assert.equal(clock(c),target);}
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:doctor,assignment:'doctor'});c=order(c,{type:'selectSquad',id:c.squads.find(q=>q.members.includes(doctor)).id});
 assert.equal(c.squads.filter(q=>q.members.length).length,8);assert.equal(c.sectorStates[sector].units.find(u=>u.id===String(fallen)).knownToPlayer,sharedHome?true:undefined);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,guard,fallen,doctor,patient,ids,home,companions,hires};
}
const search=(c,guard,options={})=>searchLocalDepotDressings(c,{sector,operativeId:guard,requested:4,deadlineSeconds:clock(c)+72*3600,...options});
const corpse=(c,id)=>c.sectorStates[sector].units.find(u=>u.id===String(id));
function replay(start,result){
 let c=start,b=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  assert.equal(clock(c),row.from);assert.equal(typeof row.cost,'number');
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,b);c=order(c,row.action);
   if(row.action.type==='visitSector'){b=enterSector(c.pendingBattle,c.sectorStates[sector]);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));}
   if(row.action.type==='leaveSector')b=null;
  }else{
   b=actBattle(b,row.action);assert.equal(b.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,b);assert.deepEqual(validated,b);
   const next=syncBattleTime(c,b);assert.equal(next.error,null);c=next.campaign;b=next.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
  }
  assert.equal(clock(c),row.to);if(index===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign:c,battle:b});c=pair.campaign;b=pair.battle;}
 }
 assert.deepEqual({campaign:c,battle:b},{campaign:result.campaign,battle:result.battle});saved({campaign:c,battle:b});
}
function rawStoppedPair(start,result){
 const c=result.campaign,b=result.battle,id=result.receipt.operativeId;
 if(b)assert.equal(c.pendingBattle?.id,b.battleId);else assert.equal(c.pendingBattle,null);
 assert.deepEqual(c.squads,start.squads);assert.ok([start.activeSquadId,start.squads.find(q=>q.members.includes(id)).id].includes(c.activeSquadId));assert.deepEqual(c.squad,c.squads.find(q=>q.id===c.activeSquadId).members);assert.deepEqual(c.recruited,start.recruited);
 const oldBody=start.sectorStates[sector].units.find(u=>u.hp===0&&u.medkits!==undefined),body=(b?.units??c.sectorStates[sector].units).find(u=>u.id===oldBody.id),guard=b?.units.find(u=>u.id===String(id))??c.operativeState[id];
 assert.equal(body.medkits,oldBody.medkits-result.collected);assert.equal(guard.medkits,start.operativeState[id].medkits+result.collected);assert.equal(guard.hp,start.operativeState[id].hp);
 for(const member of start.recruited){const old=start.operativeState[member],now=c.operativeState[member];assert.equal(now.alive,old.alive);assert.equal(now.captured,old.captured);assert.ok(now.hp>=old.hp&&now.hp<=now.maxHp);if(member!==id){assert.equal(now.assignment,old.assignment);assert.ok(now.medkits>=0&&now.medkits<=old.medkits);}if(old.residentPosition)assert.deepEqual(now.residentPosition,old.residentPosition);}
 assert.ok(result.receipt.orders.every(row=>!['respondToEncounter','travel','recruitCivic','createSquad','setSleep'].includes(row.action.type)));
}

function sharedHomeSearchControl(selectLocal){
 const state=setup({sharedHome:true}),start=selectLocal?order(state.campaign,{type:'selectSquad',id:state.home}):state.campaign,{guard,fallen,doctor,patient,companions,hires}=state,before=structuredClone(start),home=start.squads.find(q=>q.id===state.home);
 assert.deepEqual(home.members,[guard,...companions]);assert.equal(home.members.length,6);assert.equal(start.squads.filter(q=>q.members.length).length,8);assert.equal(hires.length,15);
 assert.ok(home.members.every(id=>start.operativeState[id].assignment==='rest'));assert.equal(start.operativeState[companions[0]].asleep,true);assert.equal(start.operativeState[companions[0]].energy,34);
 const r=search(start,guard),c=r.campaign;assert.equal(r.reason,'fulfilled');assert.equal(r.collected,4);assert.equal(r.battle,null);assert.equal(r.receipt.restored,true);
 assert.deepEqual(r.receipt.initial.units.filter(u=>u.side==='player'&&u.hp>0).map(u=>u.id),[String(guard)]);assert.deepEqual(r.receipt.returned.units.filter(u=>u.side==='player'&&u.hp>0).map(u=>u.id),[String(guard)]);
 assert.deepEqual(r.receipt.orders.filter(row=>row.kind==='campaign'&&row.action.type==='squad').map(row=>row.action.ids),[[guard],home.members]);assert.ok(r.receipt.orders.every(row=>!['createSquad','setSleep'].includes(row.action.type)));assert.ok(r.receipt.orders.filter(row=>row.kind==='campaign'&&row.action.type==='assignCare').every(row=>row.action.operativeId===guard));
 for(const id of companions){const old=start.operativeState[id],now=c.operativeState[id];for(const key of ['hp','energy','fatigue','assignment','asleep','medkits','residentPosition','location'])assert.deepEqual(now[key],old[key]);assert.equal(operativeLocation(c,id),sector);}
 assert.equal(c.operativeState[doctor].assignment,'doctor');assert.equal(c.operativeState[patient].assignment,'patient');assert.equal(c.operativeState[fallen].alive,false);assert.equal(corpse(c,fallen).medkits,corpse(start,fallen).medkits-4);assert.equal(c.operativeState[guard].medkits,start.operativeState[guard].medkits+4);
 assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.squad,start.squad);assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.squads.filter(q=>q.members.length).length,8);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=3600);assert.ok(r.receipt.orders.filter(row=>row.kind==='battle').length<=600);assert.deepEqual(start,before);replay(start,r);assert.deepEqual(search(saved({campaign:start}).campaign,guard),r);
}

test('a scout visits alone from its six-member home while five resting local companions keep their posts and the remote clinic remains selected',()=>sharedHomeSearchControl(false));
test('a selected six-member home is restored in its exact order after only the scout searches and its sleeping companion stays at rest',()=>sharedHomeSearchControl(true));

test('an existing guard discovers Native-earned unknown linen and pays its exact roof return while the remote clinic keeps working and all eight groups remain',()=>{
 const {campaign:start,guard,fallen,doctor,patient}=setup(),before=structuredClone(start),r=search(start,guard),c=r.campaign;
 assert.equal(sectorInventoryModel(start,sector,rosterFor(start),guard).entries.some(row=>JSON.parse(row.expected).item==='medkits'),false);
 assert.equal(r.reason,'fulfilled');assert.equal(r.collected,4);assert.equal(r.battle,null);assert.equal(r.receipt.restored,true);assert.equal(corpse(c,fallen).medkits,corpse(start,fallen).medkits-4);assert.equal(c.operativeState[guard].medkits,start.operativeState[guard].medkits+4);assert.equal(c.operativeState[fallen].alive,false);
 assert.equal(unit(r.receipt.returned,guard).facing,unit(r.receipt.initial,guard).facing);assert.equal(unit(r.receipt.returned,guard).movementMode,unit(r.receipt.initial,guard).movementMode);assert.equal(unit(r.receipt.returned,guard).activeSlot,unit(r.receipt.initial,guard).activeSlot);
 assert.ok(r.receipt.orders.some(row=>row.kind==='battle'&&row.action.type==='look'));assert.ok(r.receipt.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));assert.ok(r.receipt.orders.some(row=>row.kind==='battle'&&row.action.type==='loot'));assert.ok(r.receipt.orders.filter(row=>row.kind==='battle').every(row=>row.action.unitId===String(guard)));
 assert.equal(c.operativeState[doctor].assignment,'doctor');assert.equal(c.operativeState[patient].assignment,'patient');assert.ok(c.operativeState[patient].hp>start.operativeState[patient].hp);assert.equal(c.operativeState[doctor].medkits,start.operativeState[doctor].medkits-1);assert.ok(r.receipt.care.some(row=>row.changes.some(change=>change.id===patient)));
 assert.equal(c.operativeState[guard].medkits+corpse(c,fallen).medkits,start.operativeState[guard].medkits+corpse(start,fallen).medkits);assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=3600);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.operativeState[guard].residentPosition,start.operativeState[guard].residentPosition);assert.equal(operativeLocation(c,guard),sector);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(start,before);replay(start,r);assert.deepEqual(search(saved({campaign:start}).campaign,guard),r);
});

test('a public sweep reaches distant unknown linen within the unchanged action and return allowance',()=>{
 const {campaign:start,guard,fallen}=setup({wide:true}),before=structuredClone(start),r=search(start,guard),c=r.campaign;
 assert.equal(sectorInventoryModel(start,sector,rosterFor(start),guard).entries.some(row=>JSON.parse(row.expected).item==='medkits'),false);
 assert.equal(r.reason,'fulfilled',JSON.stringify({reason:r.reason,collected:r.collected,actions:r.receipt.orders.filter(row=>row.kind==='battle').length,elapsedSeconds:clock(c)-clock(start)}));assert.equal(r.collected,4);assert.equal(r.battle,null);assert.equal(r.receipt.restored,true);
 assert.equal(corpse(c,fallen).medkits,corpse(start,fallen).medkits-4);assert.equal(c.operativeState[guard].medkits,start.operativeState[guard].medkits+4);assert.equal(c.operativeState[fallen].alive,false);
 const actions=r.receipt.orders.filter(row=>row.kind==='battle');assert.ok(actions.length<=600);assert.ok(actions.some(row=>row.action.type==='climb'));assert.ok(actions.some(row=>row.action.type==='loot'));
 assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=3600);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);
 assert.deepEqual(c.operativeState[guard].residentPosition,start.operativeState[guard].residentPosition);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);
 assert.equal(c.operativeState[guard].medkits+corpse(c,fallen).medkits,start.operativeState[guard].medkits+corpse(start,fallen).medkits);
 assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(start,before);
});

test('empty or inaccessible remains give no supply credit and retain all actual posts, duties and finite stock',()=>{
 for(const options of [{kits:0},{closed:true}]){
  const {campaign:start,guard,fallen}=setup(options),before=structuredClone(start),r=search(start,guard);assert.notEqual(r.reason,'fulfilled');assert.equal(r.collected,0);assert.equal(r.battle,null);assert.equal(r.receipt.restored,true);assert.equal(corpse(r.campaign,fallen).medkits,corpse(start,fallen).medkits);assert.equal(r.campaign.operativeState[guard].medkits,start.operativeState[guard].medkits);assert.deepEqual(r.campaign.operativeState[guard].residentPosition,start.operativeState[guard].residentPosition);assert.deepEqual(r.campaign.squads,start.squads);assert.deepEqual(start,before);replay(start,r);
 }
});

test('carrying capacity leaves uncollected finite linen on the actual body and still pays the exact return',()=>{
 const {campaign:start,guard,fallen}=setup({kits:50,packedGuard:true}),before=structuredClone(start),r=search(start,guard,{requested:50});assert.equal(r.reason,'carrying-capacity');assert.ok(r.collected>0&&r.collected<50);assert.equal(r.battle,null);assert.equal(r.receipt.restored,true);assert.equal(corpse(r.campaign,fallen).medkits,50-r.collected);assert.equal(r.campaign.operativeState[guard].medkits,r.collected);assert.ok(carriedWeight(unit(r.receipt.initial,guard))<=carryCapacity(unit(r.receipt.initial,guard)));assert.equal(inventoryUsage(unit(r.receipt.initial,guard)).overloaded,false);assert.equal(inventoryUsage(unit(r.receipt.returned,guard)).overloaded,false);assert.deepEqual(r.campaign.operativeState[guard].residentPosition,start.operativeState[guard].residentPosition);assert.deepEqual(start,before);replay(start,r);
});

test('a real short service term is paid before any search time and every finite debit survives the official replay',()=>{
 const {campaign:start,guard}=setup({nearExpiry:true}),before=structuredClone(start),r=search(start,guard);assert.equal(r.reason,'fulfilled');assert.ok(r.receipt.renewals.some(row=>row.id===guard));assert.equal(r.campaign.resources.treasury,start.resources.treasury-r.receipt.renewals.reduce((n,row)=>n+row.quote.price,0));for(const id of r.campaign.recruited)assert.ok(contractExpiresSeconds(r.campaign.contracts[id])===null||contractExpiresSeconds(r.campaign.contracts[id])>clock(r.campaign));assert.deepEqual(start,before);replay(start,r);
});

test('the original clinical deadline cannot be reset to fit a new search and retains the actual open pair',()=>{
 const {campaign:start,guard}=setup(),before=structuredClone(start),r=search(start,guard,{deadlineSeconds:clock(start)+1});assert.ok(['return-time-unavailable','return-reserve'].includes(r.reason));assert.equal(r.collected,0);assert.ok(!r.receipt.orders.some(row=>row.kind==='battle'&&['move','climb','loot'].includes(row.action.type)));assert.ok(clock(r.campaign)<=clock(start)+1);
 if(r.battle){assert.equal(r.receipt.restored,false);assert.ok(r.campaign.pendingBattle);}else {assert.equal(r.receipt.restored,true);assert.deepEqual(r.campaign.operativeState[guard].residentPosition,start.operativeState[guard].residentPosition);}rawStoppedPair(start,r);assert.deepEqual(start,before);
});

test('an actual raid interrupts the local search without a synthetic defense, false roof restoration or lost accepted pair',()=>{
 const {campaign:start,guard}=setup({raid:true}),before=structuredClone(start),r=search(start,guard);assert.equal(r.reason,'interrupted');assert.equal(r.receipt.restored,false);assert.ok(r.campaign.pendingEncounter||r.battle?.mode==='combat');assert.ok(clock(r.campaign)>clock(start));assert.ok(clock(r.campaign)-clock(start)<=3600);assert.ok(r.receipt.orders.every(row=>!['respondToEncounter','travel','recruitCivic','createSquad'].includes(row.action.type)));assert.deepEqual(start,before);rawStoppedPair(start,r);
});

test('an actual wounded or working guard is rejected before a search order rather than borrowing a required duty',()=>{
 for(const wounded of [true,false]){
  const state=setup(wounded?{guardHP:70}:{});let start=state.campaign;if(!wounded)start=order(start,{type:'assignWork',operativeId:state.guard,assignment:'practice',skill:'marksmanship'});const before=structuredClone(start);let failure;try{search(start,state.guard);}catch(error){failure=error;}
  assert.match(failure?.message??'',wounded?/fit free local guard/:/medical or working duty/);assert.deepEqual(failure.campaign,start);assert.equal(failure.battle,null);assert.deepEqual(failure.localDepotMedicalSearch.orders,[]);assert.deepEqual(start,before);
 }
});
