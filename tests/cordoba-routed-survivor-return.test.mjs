import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {worldOwner} from '../game/world-cells.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview,lookPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {spacePoint,sameCell} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {returnRoutedCordobaSurvivors} from './cordoba-routed-survivor-return.mjs';
import {stabilizeCordobaFirstDefense} from './cordoba-first-defense-care.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const canonical=c=>{const n=structuredClone(c);for(const key of ['sectorStates','sceneStates'])for(const id of Object.keys(n[key]??{}))n[key][id]=expandCellScene(n[key][id]);return n;};
const saved=p=>{const n=decodeSave(encodeSave(p.campaign,p.battle??null));assert.deepEqual(canonical(n.campaign),canonical(p.campaign));assert.deepEqual(n.battle,p.battle??null);return n;};
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const body=(b,id)=>b.units.find(u=>u.id===String(id));
function step(p,action){
 const before=structuredClone(p.battle),b=actBattle(p.battle,action);assert.equal(b.lastError,null,JSON.stringify(action)+': '+b.lastError);
 assert.deepEqual(presentedActBattle(p.battle,action).state,b);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(p.battle))),action),b);assert.deepEqual(p.battle,before);
 const n=syncBattleTime(p.campaign,b);assert.equal(n.error,null);return saved(n);
}
const visit=c=>{c=order(c,{type:'visitSector'});return saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.cordoba)});};
const leave=p=>order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
function move(p,id,target,tape){
 for(let n=0;!sameCell(body(p.battle,id),target)&&n<80;n++){
  const route=getReachable(p.battle,body(p.battle,id),{stopAt:q=>sameCell(q,target)})[0];assert.ok(route?.path.length,'The fresh actor needs an actual public path.');
  const action={type:'move',unitId:String(id),...spacePoint(route.path[0])};p=step(p,action);tape.push(action);
 }
 assert.ok(sameCell(body(p.battle,id),target));return p;
}
function open(p,id,chestId,tape){
 const chest=p.battle.props.find(q=>q.id===chestId),cell=getReachable(p.battle,body(p.battle,id)).filter(q=>Math.abs(q.x-chest.x)+Math.abs(q.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(cell);
 p=move(p,id,cell,tape);
 if(lookPreview(p.battle,body(p.battle,id),chest).valid){const a={type:'look',unitId:String(id),...spacePoint(chest)};p=step(p,a);tape.push(a);}
 const a={type:'useItem',unitId:String(id),environment:{kind:'container',id:chestId,verb:'open'}};p=step(p,a);tape.push(a);return p;
}

// People, finite kits, neutral exits, traps and raid pressure precede factory.
// Native trap damage, death and physical exit earn the unsafe rural survivor.
function setup({escape=true,occupied=false,nearExpiry=false,raid=false}={}){
 const d=scaffoldDocuments('cordoba-routed-survivor-return');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.startingTerritory['watch-post'].owner='patriot';d.content.headquarters='watch-post';d.world.defaultHeadquarters='watch-post';
 d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={cordoba:0,'watch-post':0};
 d.content.characters=Array.from({length:occupied?10:4},(_,i)=>({...structuredClone(base),id:'return-'+i,name:'Superviviente '+i,nickname:'Superviviente '+i,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:100,strength:80,medical:i===2?80:0},startingSupplies:{rations:0,torches:0,medkits:i===2?2:0,boleadoras:0}}));
 d.maps.cordoba.spawns=[{id:'entry',x:18,y:8,side:'player'},{id:'opposition',x:1,y:8,side:'enemy'}];
 d.maps.cordoba.props=[{id:'injury',type:'chest',x:18,y:10,footprint:{width:1,height:1},blocksMovement:true},{id:'lethal',type:'chest',x:4,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.environment.cordoba={doors:[],containers:[['injury',18],['lethal',100]].map(([id,damage])=>({selector:{type:'chest',id},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage,breathLoss:0,discoveredBy:[]}}}))};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:12,axis:['cordoba']}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(8,content);
 const ids=rosterFor(c).map(op=>op.id),[patient,guard,doctor,fallen]=ids,alive=ids.filter(id=>id!==fallen),hires=[];
 const hire=id=>{const q=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(q.available,true,q.reason);c=order(c,{type:'recruitCivic',id,term:'day',destination:'cordoba'});assert.equal(cash-c.resources.treasury,q.total);hires.push({id,quote:q});};
 hire(fallen);c=order(c,{type:'createSquad',sector:'cordoba',ids:[fallen],name:'Patrulla caída'});let p=visit(c),deathTape=[];p=open(p,fallen,'lethal',deathTape);assert.equal(body(p.battle,fallen).hp,0);c=leave(p);assert.equal(c.operativeState[fallen].alive,false);
 for(const id of alive)hire(id);
 c=order(c,{type:'createSquad',sector:'cordoba',ids:[doctor],name:'Hospital local'});const clinic=c.activeSquadId;
 if(occupied){for(const id of alive.filter(id=>![patient,doctor].includes(id)))c=order(c,{type:'createSquad',sector:'cordoba',ids:[id],name:'Guardia '+id});const home=c.squads.find(q=>q.members.includes(guard)).id;c=order(c,{type:'selectSquad',id:home});c=order(c,{type:'squad',ids:[guard,patient]});}
 else {while(c.squads.length<8)c=order(c,{type:'createSquad',sector:'cordoba',ids:[guard],name:'Guardia local'});c=order(c,{type:'createSquad',sector:'cordoba',ids:[guard,patient],name:'Patrulla local'});}
 const home=c.activeSquadId;assert.equal(c.squads.length,8);assert.equal(c.squads.filter(q=>q.members.length>0).length,occupied?8:2);
 if(nearExpiry){const expiry=contractExpiresSeconds(c.contracts[patient]);for(let n=0;expiry-clock(c)>3600&&n<24;n++)c=order(c,{type:'wait',hours:1});assert.ok(expiry>clock(c)&&expiry-clock(c)<=3600);}
 if(raid){for(let n=0;c.hour<11&&n<12;n++)c=order(c,{type:'wait',hours:1});assert.equal(c.hour,11);assert.equal(c.enemyGroups.length,0);}
 p=visit(c);const initial=saved(p),tape=[];p=open(p,patient,'injury',tape);assert.ok(body(p.battle,patient).hp<100&&body(p.battle,patient).hp>=15&&body(p.battle,patient).bleeding>0);
 let exit=null;
 if(escape){
  exit=p.battle.exits.find(e=>e.edge==='E'&&worldOwner(c,e.destination)==='neutral');assert.ok(exit);
  const cell=getReachable(p.battle,body(p.battle,patient)).filter(q=>boundaryMatches(p.battle,q,exit.edge)).sort((a,b)=>a.cost-b.cost||a.y-b.y)[0];assert.ok(cell);p=move(p,patient,cell,tape);
  const a={type:'exit',unitIds:[String(patient)],exitId:exit.id},q=exitPreview(p.battle,a);assert.equal(q.available,true,q.reason);p=step(p,a);tape.push(a);
 }
 let replay=saved(initial);for(const a of tape)replay=step(replay,a);assert.deepEqual(replay,p);c=leave(p);assert.deepEqual(canonical(leave(replay)),canonical(c));
 assert.ok(c.operativeState[patient].hp>=15&&c.operativeState[patient].bleeding>0);assert.equal(c.operativeState[doctor].medkits,2);assert.equal(c.operativeState[fallen].alive,false);
 assert.equal(operativeLocation(c,guard),'cordoba');assert.equal(c.activeSquadId,home);assert.equal(c.squads.length,8);
 if(escape){assert.equal(operativeLocation(c,patient),exit.destination);assert.equal(c.operativeState[patient].arrival.fromSector,'cordoba');assert.equal(c.squads.some(q=>q.members.includes(patient)),false);assert.equal(worldOwner(c,exit.destination),'neutral');}
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,ids,alive,patient,guard,doctor,fallen,clinic,home,hires,exit,tape};
}
function replay(start,result){
 let c=saved({campaign:start}).campaign;for(const [i,row]of result.receipt.orders.entries()){
  assert.equal(row.accepted,true);assert.equal(clock(c),row.from);const cash=c.resources.treasury;c=order(c,row.action);assert.equal(clock(c),row.to);assert.equal(cash-c.resources.treasury,row.cost);
  // Care is an explicit external boundary, not a fabricated flat order tape.
  if(result.receipt.care&&row===result.receipt.orders.findLast(r=>r.to<=result.receipt.care.from)){const boundary=result.receipt.care;c=stabilizeCordobaFirstDefense(c,{deadlineSeconds:result.receipt.deadlineSeconds}).campaign;assert.equal(clock(c),boundary.to);}
  if(i===Math.floor(result.receipt.orders.length/2))c=saved({campaign:c}).campaign;
 }
 assert.deepEqual(canonical(saved({campaign:c}).campaign),canonical(result.campaign));return c;
}
const run=(s,options={})=>returnRoutedCordobaSurvivors(s.campaign,{deadlineSeconds:clock(s.campaign)+96*3600,...options});

test('an actual wounded neutral departure reuses one of eight records, returns, then pays finite local care before safe rest',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),r=run(s),c=r.campaign;assert.deepEqual(r.receipt.departures,[s.patient]);assert.equal(r.receipt.completed,true);assert.equal(r.receipt.journeys.length,1);
 assert.equal(operativeLocation(c,s.patient),'cordoba');assert.equal(c.operativeState[s.patient].bleeding,0);assert.ok(c.operativeState[s.patient].hp>=15);assert.equal(c.operativeState[s.doctor].medkits,1);assert.equal(c.operativeState[s.fallen].alive,false);
 assert.equal(r.receipt.care.completed,true);assert.equal(r.receipt.care.receipt.dressingsSpent,1);assert.equal(r.receipt.care.to-r.receipt.care.from,3600);assert.equal(r.receipt.care.nativeOrderTape,null);
 assert.ok(r.receipt.journeys[0].arrivalSeconds<r.receipt.care.to);assert.ok(r.receipt.orders.some(row=>row.action.type==='travel'&&row.action.queue===true));assert.equal(c.squads.length,8);assert.equal(c.activeSquadId,s.home);
 for(const group of start.squads.filter(q=>q.members.length))assert.deepEqual(c.squads.find(q=>q.id===group.id),group);assert.ok(s.alive.every(id=>c.recruited.includes(id)&&c.operativeState[id].alive));assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);
 const rested=order(c,{type:'assignCare',operativeId:s.patient,assignment:'rest'});assert.equal(rested.operativeState[s.patient].assignment,'rest');saved({campaign:rested});replay(start,r);assert.deepEqual(run({...s,campaign:saved({campaign:start}).campaign}),r);assert.deepEqual(start,before);
});

test('all actual serving terms are paid through the return and the first finite care hour',()=>{
 const s=setup({nearExpiry:true}),start=s.campaign,r=run(s);assert.ok(r.receipt.renewals.length+(r.receipt.care?.receipt.renewals.length??0)>0);
 assert.ok(s.alive.every(id=>contractExpiresSeconds(r.campaign.contracts[id])>clock(r.campaign)));assert.ok(r.campaign.resources.treasury<start.resources.treasury);assert.equal(r.campaign.operativeState[s.doctor].medkits,1);replay(start,r);
});

test('the optional clinic deadline refuses before an unfunded hour and admits the exact real one-hour boundary',()=>{
 const s=setup({escape:false}),start=s.campaign,before=structuredClone(start);let failure;
 try{stabilizeCordobaFirstDefense(start,{deadlineSeconds:clock(start)+3599});}catch(error){failure=error;}
 assert.match(failure?.message??'',/absolute recovery deadline/);assert.equal(failure.cordobaFirstDefenseCare.orders.length,0);assert.equal(clock(failure.campaign),clock(start));assert.deepEqual(canonical(failure.campaign),canonical(start));assert.deepEqual(start,before);
 // The refusal stays terminal. Both successful runs use independent copies of
 // the original successful fresh setup, never the refused result.
 const exact=stabilizeCordobaFirstDefense(saved({campaign:start}).campaign,{deadlineSeconds:clock(start)+3600}),ordinary=stabilizeCordobaFirstDefense(saved({campaign:start}).campaign);
 assert.equal(clock(exact.campaign)-clock(start),3600);assert.equal(exact.campaign.operativeState[s.patient].bleeding,0);assert.equal(exact.campaign.operativeState[s.doctor].medkits,1);assert.deepEqual(canonical(exact.campaign),canonical(ordinary.campaign));assert.deepEqual(exact.receipt.orders,ordinary.receipt.orders);saved({campaign:exact.campaign});
});

test('local wounded survivors keep the existing care path without any new return order',()=>{
 const s=setup({escape:false}),before=structuredClone(s.campaign),r=run(s);assert.strictEqual(r.campaign,s.campaign);assert.deepEqual(r.receipt.departures,[]);assert.deepEqual(r.receipt.orders,[]);assert.equal(r.receipt.care,null);assert.equal(r.campaign.operativeState[s.doctor].medkits,2);assert.deepEqual(s.campaign,before);
});

test('eight genuinely occupied homes refuse the unassigned return without inventing a ninth squad',()=>{
 const s=setup({occupied:true}),before=structuredClone(s.campaign);let failure;try{run(s);}catch(error){failure=error;}
 assert.match(failure?.message??'',/existing vacant squad/);assert.equal(failure.cordobaRoutedSurvivorReturn.orders.length,0);assert.equal(failure.campaign.squads.length,8);assert.deepEqual(failure.campaign,before);assert.deepEqual(s.campaign,before);
});

test('an actual critical rural survivor refuses an unsupported march instead of receiving invented field aid',()=>{
 const s=setup();let c=s.campaign;
 for(let n=0;c.operativeState[s.patient].hp>=15&&n<96;n++){
  for(const id of s.alive){const contract=c.contracts[id];if(contractExpiresSeconds(contract)<=clock(c)+3601)c=order(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});}
  c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter,null);assert.ok(s.alive.every(id=>c.operativeState[id].alive));
 }
 assert.ok(c.operativeState[s.patient].hp>0&&c.operativeState[s.patient].hp<15&&c.operativeState[s.patient].bleeding>0);assert.equal(operativeLocation(c,s.patient),s.exit.destination);
 const before=structuredClone(c);let failure;try{returnRoutedCordobaSurvivors(c,{deadlineSeconds:clock(c)+96*3600});}catch(error){failure=error;}
 assert.match(failure?.message??'',/remain capable/);assert.deepEqual(failure.cordobaRoutedSurvivorReturn.orders,[]);assert.deepEqual(failure.campaign,before);assert.deepEqual(c,before);
});

test('a real announced raid stops the actual paid return prefix with the pending encounter intact',()=>{
 const s=setup({raid:true}),start=s.campaign,before=structuredClone(start);let failure;try{run(s);}catch(error){failure=error;}
 assert.match(failure?.message??'',/actual encounter/);assert.equal(failure.campaign.pendingEncounter?.sector,'cordoba');const receipt=failure.cordobaRoutedSurvivorReturn;
 assert.ok(receipt.orders.some(row=>row.action.type==='travel'));assert.equal(receipt.orders.at(-1).action.type,'wait');assert.equal(receipt.orders.at(-1).accepted,true);assert.ok(receipt.orders.at(-1).to>clock(start));assert.equal(receipt.care,null);assert.equal(receipt.completed,false);assert.equal(failure.campaign.operativeState[s.doctor].medkits,2);assert.ok(start.operativeState[s.patient].hp>=failure.campaign.operativeState[s.patient].hp);assert.deepEqual(start,before);
 // Raw pending output only. No Native query, save, replay or resumed input.
});
