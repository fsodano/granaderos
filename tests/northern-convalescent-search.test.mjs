import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {doctorRate} from '../game/medical-care.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,lookPreview,climbPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint,sameCell,sameSurface} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {searchNorthernConvalescentDressing} from './northern-route.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0),unit=(b,id)=>b.units.find(u=>u.id===String(id));
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=pair=>{const next=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(next,{campaign:pair.campaign,battle:pair.battle??null});return next;};
function step(pair,action){
 const before=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,before);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return saved(next);
}
function move(pair,id,target){
 for(let n=0;!sameCell(unit(pair.battle,id),target)&&n<80;n++){
  const actor=unit(pair.battle,id),route=getReachable(pair.battle,actor,{stopAt:p=>sameCell(p,target)})[0];assert.ok(route?.path.length);const next=route.path[0],before=spacePoint(actor);
  if(!sameSurface(actor,next)){const quote=climbPreview(pair.battle,actor,{linkId:next.linkId});assert.equal(quote.valid,true,quote.reason);pair=step(pair,{type:'climb',unitId:String(id),linkId:next.linkId});}
  else pair=step(pair,{type:'move',unitId:String(id),...spacePoint(next)});assert.notDeepEqual(spacePoint(unit(pair.battle,id)),before);
 }
 assert.ok(sameCell(unit(pair.battle,id),target));return pair;
}

// Validated declarations supply only finite property and a lethal trap. A
// real paid carrier dies before the future scout is hired; no body or stock
// is inserted after the factory. Clinical duties start only after setup.
function setup({kits=6,qualified=false,workingScout=false,raid=false}={}){
 const d=scaffoldDocuments('northern-convalescent-search');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector).replaceAll('"camp"','"tucuman"').replaceAll('camp:','tucuman:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={tucuman:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=Array.from({length:5},(_,i)=>({...structuredClone(base),id:'search-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,strength:100,medical:i===0?(qualified?70:0):i===2?80:i===4?90:0},
  startingSupplies:{rations:0,torches:0,medkits:i===1?kits:i===3?13:i===4?1:0,boleadoras:0},
  startingCondition:{hp:i===3?50:80,bleeding:0,bandaged:i===3?30:0,energy:100,fatigue:0}}));
 d.maps[sector].props=[{id:'actual-trap',type:'chest',x:4,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.maps[sector].upperSurfaces=Array.from({length:6},(_,i)=>({id:'search-post-'+i,x:12+i%3,y:5+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'search-access',kind:'climb',from:{x:12,y:7,tacticalLevel:0},to:{x:12,y:6,tacticalLevel:1}}];
 d.world.physical.environment[sector]={doors:[],containers:[{selector:{type:'chest',id:'actual-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?1:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const ids=rosterFor(c).map(op=>op.id),[scout,fallen,doctor,patient,worker]=ids,hires=[];
 const hire=id=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);c=order(c,{type:'recruitCivic',id,term:'day',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});};
 hire(fallen);c=order(c,{type:'createSquad',sector,ids:[fallen],name:'Inspección del depósito'});const fallenHome=c.activeSquadId;
 c=order(c,{type:'visitSector'});let pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates[sector])});
 const chest=pair.battle.props.find(p=>p.id==='actual-trap'),approach=getReachable(pair.battle,unit(pair.battle,fallen)).filter(p=>Math.abs(p.x-chest.x)+Math.abs(p.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(approach);pair=move(pair,fallen,approach);
 if(lookPreview(pair.battle,unit(pair.battle,fallen),chest).valid)pair=step(pair,{type:'look',unitId:String(fallen),...spacePoint(chest)});
 pair=step(pair,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:'actual-trap',verb:'open'}});assert.equal(unit(pair.battle,fallen).hp,0);assert.equal(unit(pair.battle,fallen).medkits,kits);
 c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(c.operativeState[fallen].alive,false);assert.equal(c.squads.find(q=>q.id===fallenHome).location,d.content.headquarters);
 for(const id of ids.filter(id=>id!==fallen))hire(id);
 assert.equal(c.operativeState[scout].location,sector);assert.equal(c.hiringArrivals.some(row=>row.operativeId===scout),false);c=order(c,{type:'createSquad',sector,ids:[scout],name:'Guardia del depósito'});const home=c.activeSquadId;c=stageRouteRoofDefenders(c,[scout]);c=order(c,{type:'assignCare',operativeId:scout,assignment:'rest'});
 c=order(c,{type:'createSquad',sector,ids:[doctor,patient,worker],name:'Convalecencia'});const clinic=c.activeSquadId;
 if(workingScout)c=order(c,{type:'assignWork',operativeId:scout,assignment:'practice',skill:'marksmanship'});
 if(raid){
  for(let n=0;!c.enemyGroups.some(g=>g.status==='marching'&&g.target===sector)&&n<3;n++)c=order(c,{type:'wait',hours:1});const group=c.enemyGroups.find(g=>g.status==='marching'&&g.target===sector);assert.ok(group);const target=group.arrivalAt*3600-2;
  for(let n=0;clock(c)<target&&n<10;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);
 }else{
  const target=(Math.floor(clock(c)/3600)+1)*3600-2;for(let n=0;clock(c)<target&&n<2;n++)c=order(c,{type:'advanceStrategicTime',seconds:target-clock(c)});assert.equal(clock(c),target);
 }
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:worker,assignment:'doctor'});
 assert.equal(c.sectorStates[sector].units.find(u=>u.id===String(fallen)).knownToPlayer,undefined);assert.equal(c.operativeState[patient].medkits,13);assert.equal(c.operativeState[worker].medkits,1);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,ids,scout,fallen,doctor,patient,worker,home,clinic,hires};
}
const deploying=s=>[s.doctor,s.patient,s.worker];
const search=(s,options={})=>searchNorthernConvalescentDressing(s.campaign,s.doctor,{deploying:deploying(s),patients:[s.patient],deadlineSeconds:clock(s.campaign)+96*3600,...options});
const corpse=(c,id)=>c.sectorStates[sector].units.find(u=>u.id===String(id));
const ledger=(start,r,ids)=>ids.reduce((n,id)=>n+start.operativeState[id].medkits-r.campaign.operativeState[id].medkits,0)+(ids.includes(r.receipt.scoutId)?r.receipt.collected:0)+r.receipt.takes.reduce((n,row)=>n+row.count,0)-r.receipt.donations.filter(row=>row.internal).reduce((n,row)=>n+row.count,0);
function replay(start,result){
 let c=saved({campaign:start}).campaign,b=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  assert.equal(clock(c),row.from);assert.notEqual(row.accepted,false);const cash=c.resources.treasury;
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,b);c=order(c,row.action);
   if(row.action.type==='visitSector'){b=enterSector(c.pendingBattle,c.sectorStates[sector]);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));}
   if(row.action.type==='leaveSector')b=null;
  }else{
   b=actBattle(b,row.action);assert.equal(b.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,b);assert.deepEqual(validated,b);
   const next=syncBattleTime(c,b);assert.equal(next.error,null);c=next.campaign;b=next.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
  }
  assert.equal(clock(c),row.to);assert.equal(cash-c.resources.treasury,row.cost);if(index===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign:c,battle:b});c=pair.campaign;b=pair.battle;}
 }
 assert.deepEqual({campaign:c,battle:b},{campaign:result.campaign,battle:null});saved({campaign:c,battle:b});return c;
}
function verify(s,r,{reserve,stock}){
 const start=s.campaign,c=r.campaign,before=structuredClone(start);assert.equal(r.supplied,true);assert.equal(r.receipt.scoutId,s.scout);assert.equal(r.receipt.scoutReserve,reserve);assert.equal(r.receipt.collected,reserve+1);
 assert.equal(c.operativeState[s.scout].medkits,reserve);assert.equal(c.operativeState[s.doctor].medkits,1);assert.equal(c.operativeState[s.patient].medkits,13);assert.equal(c.operativeState[s.worker].medkits,1);assert.equal(c.operativeState[s.patient].hp,start.operativeState[s.patient].hp);
 assert.equal(corpse(c,s.fallen).medkits,stock-reserve-1);assert.equal(corpse(c,s.fallen).knownToPlayer,true);assert.equal(c.operativeState[s.fallen].alive,false);assert.equal(r.receipt.search.restored,true);
 assert.ok(r.receipt.search.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));assert.ok(r.receipt.search.orders.some(row=>row.kind==='battle'&&row.action.type==='loot'));assert.ok(!r.receipt.search.care.some(row=>row.changes.some(change=>[s.patient,s.worker].includes(change.id))),'The same-sector tactical visit pauses actual clinical work.');
 const take=r.receipt.takes.at(-1);assert.match(take.sourceKey,/^ground:/);assert.equal(JSON.parse(take.expected).count,1);assert.notEqual(take.sourceKey,JSON.stringify(['body',String(s.fallen),'medkits']));
 assert.equal(ledger(start,r,deploying(s)),0,'Search and finite handover conserve clinical stock while the same-sector visit pauses care.');
 assert.equal([s.scout,s.doctor,s.patient,s.worker].reduce((n,id)=>n+c.operativeState[id].medkits,corpse(c,s.fallen).medkits),[s.scout,s.doctor,s.patient,s.worker].reduce((n,id)=>n+start.operativeState[id].medkits,stock));
 assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=3600);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);
 for(const id of [s.scout,s.doctor,s.patient,s.worker]){assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);}
 assert.deepEqual(start,before);replay(start,r);assert.deepEqual(saved({campaign:c}).campaign,c);
 // Clinical work resumes only after the actual visit has closed. The same
 // successful starting input replays all search orders and this real wait.
 const wait={type:'wait',hours:1},treated=order(c,wait),rate=doctorRate(rosterFor(c).find(op=>op.id===s.worker),c);
 assert.equal(treated.operativeState[s.worker].medkits,0);assert.equal(treated.operativeState[s.patient].hp,Math.min(c.operativeState[s.patient].maxHp,c.operativeState[s.patient].hp+rate));
 assert.equal(treated.operativeState[s.patient].medkits,13);assert.equal(treated.operativeState[s.doctor].medkits,1);assert.ok(clock(treated)>clock(c)&&clock(treated)-clock(c)<=3600);assert.equal(ledger(start,{...r,campaign:treated},deploying(s)),1);
 assert.deepEqual(saved({campaign:treated}).campaign,treated);assert.deepEqual(order(replay(start,r),wait),treated);
}

test('a paid free rear guard discovers unknown finite remains, returns to its exact post and gives the doctor its own identified parcel',()=>{
 const s=setup(),before=structuredClone(s.campaign);assert.ok(!sectorInventoryModel(s.campaign,sector,rosterFor(s.campaign),s.doctor).entries.some(row=>JSON.parse(row.expected).item==='medkits'));
 const r=search(s);verify(s,r,{reserve:1,stock:6});assert.deepEqual(s.campaign,before);assert.deepEqual(search({...s,campaign:saved({campaign:s.campaign}).campaign}),r);
});

test('a qualified rear scout retains the same two-dressing reserve while newly known body remainder and parcel stay separate',()=>{
 const s=setup({qualified:true}),r=search(s);assert.equal(r.receipt.local.reserves[s.scout],2);verify(s,r,{reserve:2,stock:6});assert.equal(corpse(r.campaign,s.fallen).medkits,3);
});

test('a scout inside deploying credits actual finite search intake once and gives no second credit for the internal handover',()=>{
 const s=setup(),ids=[...deploying(s),s.scout],r=search(s,{deploying:ids});assert.equal(r.supplied,true);assert.equal(r.receipt.collected,2);assert.equal(r.receipt.donations.at(-1).internal,true);assert.equal(ledger(s.campaign,r,ids),0);replay(s.campaign,r);
});

test('empty or short finite remains return honestly without consuming the patient pack or the scout reserve',()=>{
 for(const kits of [0,1]){
  const s=setup({kits}),before=structuredClone(s.campaign),r=search(s);assert.equal(r.supplied,false);assert.equal(r.receipt.collected,kits);assert.equal(r.receipt.search.restored,true);assert.deepEqual(r.receipt.takes,[]);assert.deepEqual(r.receipt.donations,[]);
  assert.equal(r.campaign.operativeState[s.doctor].medkits,0);assert.equal(r.campaign.operativeState[s.scout].medkits,kits);assert.equal(r.campaign.operativeState[s.patient].medkits,13);assert.equal(corpse(r.campaign,s.fallen).medkits,0);assert.deepEqual(r.campaign.squads,s.campaign.squads);assert.deepEqual(s.campaign,before);assert.equal(ledger(s.campaign,r,deploying(s)),0);replay(s.campaign,r);
 }
});

test('a required working home is not borrowed for search and a real local shortage remains unchanged',()=>{
 const s=setup({workingScout:true}),before=structuredClone(s.campaign),r=search(s);assert.equal(r.supplied,false);assert.equal(r.receipt.reason,'no-free-search-home');assert.equal(r.receipt.search,null);assert.deepEqual(r.receipt.orders,[]);assert.deepEqual(r.campaign,s.campaign);assert.deepEqual(s.campaign,before);
});

test('the fixed clinical deadline permits only a real zero-collection search with a closed exact return',()=>{
 const s=setup(),before=structuredClone(s.campaign),deadlineSeconds=clock(s.campaign)+1,r=search(s,{deadlineSeconds}),detail=JSON.stringify(r);
 assert.ok(r.receipt.search,detail);assert.equal(r.supplied,false,detail);assert.equal(r.receipt.collected,0,detail);assert.equal(r.receipt.search.restored,true,detail);assert.equal(r.receipt.search.deadlineSeconds,deadlineSeconds,detail);
 assert.ok(!r.campaign.pendingBattle&&!r.campaign.pendingEncounter,detail);assert.ok(clock(r.campaign)<=deadlineSeconds,detail);assert.ok(r.receipt.search.orders.some(row=>row.kind==='campaign'&&row.action.type==='visitSector'),detail);
 assert.ok(!r.receipt.orders.some(row=>row.kind==='battle'&&['move','climb','loot'].includes(row.action.type)),detail);assert.deepEqual(r.receipt.takes,[],detail);assert.deepEqual(r.receipt.donations,[],detail);
 assert.deepEqual(r.campaign.squads,s.campaign.squads,detail);assert.equal(r.campaign.activeSquadId,s.campaign.activeSquadId,detail);assert.deepEqual(r.campaign.squad,s.campaign.squad,detail);
 for(const id of [s.scout,s.doctor,s.patient,s.worker]){assert.deepEqual(r.campaign.operativeState[id].residentPosition,s.campaign.operativeState[id].residentPosition,detail);assert.equal(r.campaign.operativeState[id].assignment,s.campaign.operativeState[id].assignment,detail);assert.equal(r.campaign.operativeState[id].medkits,s.campaign.operativeState[id].medkits,detail);}
 assert.deepEqual(s.campaign,before);replay(s.campaign,r);
});

test('an actual raid stops search with the latest paid pair and no claimed supply or synthetic restoration',()=>{
 const s=setup({raid:true}),before=structuredClone(s.campaign);let failure;try{search(s);}catch(error){failure=error;}
 assert.match(failure?.message??'',/interruption or incomplete return/);const receipt=failure.northernConvalescentSearch;assert.equal(receipt.search.restored,false);assert.equal(receipt.supplied,false);assert.ok(failure.campaign.pendingEncounter||failure.battle?.mode==='combat');assert.ok(clock(failure.campaign)>clock(s.campaign));assert.deepEqual(receipt.takes,[]);assert.deepEqual(receipt.donations,[]);assert.ok(receipt.orders.every(row=>!['respondToEncounter','travel','recruitCivic','createSquad'].includes(row.action.type)));assert.deepEqual(s.campaign,before);
 // No game query, save or continuation receives this terminal failed result.
});
