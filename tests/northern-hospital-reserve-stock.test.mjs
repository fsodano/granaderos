import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {finiteCachesFor} from '../game/campaign-physical.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {prepareNorthernHospitalReserveStock} from './northern-hospital-reserve-stock.mjs';

const sector='tucuman',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};
function setup({kits=5,raid=false,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-finite-hospital-stock');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory[sector].owner='patriot';d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});d.world.expansion.buildingTargets[sector]=0;
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?1:240,axis:[sector]}}};
 d.maps[sector].props=[{id:'finite-linen-chest',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches[sector]={chest:'finite-linen-chest',contents:kits?[{item:'medkits',count:kits,weight:.2}]:[]};
 d.maps[sector].upperSurfaces=Array.from({length:20},(_,i)=>({id:'reserve-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'reserve-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.content.characters=Array.from({length:6},(_,i)=>({...structuredClone(base),id:'reserve-'+i,name:'Reserva '+i,nickname:'Reserva '+i,monthlyPay:300,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,medical:i===0?90:i===1?38:0},startingSupplies:{rations:0,torches:0,medkits:i<2?1:0,boleadoras:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[5]?'camp':sector});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',ids:ids.slice(0,5),sector,name:'Reserva local'});c=discoverRouteCache(c,ids[0]);c=stageRouteRoofDefenders(c,ids.slice(0,5));
 c=order(c,{type:'createSquad',ids:[ids[5]],sector:'camp',name:'Columna de regreso'});const field=c.activeSquadId;
 if(nearExpiry){const until=Math.min(...ids.map(id=>contractExpiresSeconds(c.contracts[id])))-1800;for(let n=0;clock(c)<until&&n<30;n++){const remaining=until-clock(c);c=order(c,remaining>=3600?{type:'wait',hours:Math.floor(remaining/3600)}:{type:'advanceStrategicTime',seconds:remaining});}assert.equal(clock(c),until);}
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,field,hires};
}
const run=(campaign,ids,options={})=>prepareNorthernHospitalReserveStock(campaign,{sector,ids:ids.slice(0,5),deadlineSeconds:clock(campaign)+3600,...options});
const chest=c=>c.sectorStates[sector].props.find(p=>p.id==='finite-linen-chest');
const total=c=>c.recruited.reduce((n,id)=>n+c.operativeState[id].medkits,0)+chest(c).contents.filter(s=>s.item==='medkits').reduce((n,s)=>n+s.count,0);
function replay(start,result){
 let c=start,battle=null,shown=null,validated=null;
 for(const [index,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,battle);
   c=order(c,row.action);
   if(row.action.type==='visitSector'){battle=enterSector(c.pendingBattle,c.sectorStates[sector]);const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}
   if(row.action.type==='leaveSector')battle=null;
  }else{
   battle=actBattle(battle,row.action);assert.equal(battle.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,battle);assert.deepEqual(validated,battle);
   const pair=syncBattleTime(c,battle),other=syncBattleTime(c,shown),third=syncBattleTime(c,validated);assert.equal(pair.error,null);assert.deepEqual(other,pair);assert.deepEqual(third,pair);c=pair.campaign;battle=pair.battle;shown=other.battle;validated=third.battle;
  }
  if(index===Math.floor(result.receipt.orders.length/2)){const pair=decodeSave(encodeSave(c,battle));assert.deepEqual(pair,{campaign:c,battle});c=pair.campaign;battle=pair.battle;if(battle){shown=structuredClone(battle);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));}}
 }
 assert.deepEqual(c,result.campaign);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
}

test('two actual paid roof physicians collect and share the five known finite dressings through paid descents and exact post returns',()=>{
 const {campaign:start,ids,field,hires}=setup(),before=structuredClone(start),result=run(start,ids),c=result.campaign;
 assert.equal(chest(start).knownToPlayer,true);assert.equal(chest(start).open,true);assert.equal(chest(start).locked,false);assert.equal(total(start),7);assert.equal(total(c),7);
 assert.deepEqual(result.receipt.doctors,ids.slice(0,2));assert.deepEqual(ids.slice(0,2).map(id=>c.operativeState[id].medkits),[4,3]);assert.equal(result.receipt.collections.reduce((n,row)=>n+row.count,0),5);assert.equal(chest(c).contents.filter(s=>s.item==='medkits').reduce((n,s)=>n+s.count,0),0);
 assert.equal(result.receipt.visits.length,2);for(const visit of result.receipt.visits){assert.ok(visit.steps.some(a=>a.type==='climb'));assert.ok(visit.steps.some(a=>a.type==='containerLoot'));assert.deepEqual(c.operativeState[visit.id].residentPosition,start.operativeState[visit.id].residentPosition);}
 assert.deepEqual(result.receipt.transfers,[],'Unblocked physicians retain their original direct collection path.');
 assert.ok(clock(c)>clock(start));assert.ok(clock(c)<=result.receipt.deadlineSeconds);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,field);assert.deepEqual(c.squad,start.squad);
 for(const id of ids.slice(0,5)){assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);}
 for(const {id,quote}of hires)assert.equal(c.contracts[id].paid,quote.price);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(run(saved(start),ids),result);
});

test('an exhausted known container is a no-op rather than a new minimum, hire, stock grant or search',()=>{
 const {campaign:start,ids}=setup({kits:0}),before=structuredClone(start),result=run(start,ids);assert.deepEqual(result.campaign,start);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.receipt.collections,[]);assert.deepEqual(result.receipt.visits,[]);assert.equal(total(result.campaign),2);assert.deepEqual(start,before);
});

test('the original deadline refuses a partial real visit without claiming a restored roof or losing its actual pair',()=>{
 const {campaign:start,ids}=setup(),before=structuredClone(start),deadlineSeconds=clock(start)+1;let failure;try{run(start,ids,{deadlineSeconds});}catch(error){failure=error;}
 assert.match(failure?.message??'',/next paid reserve order exceeds/);assert.equal(failure.hospitalReserveStock.restored,false);assert.ok(failure.campaign.pendingBattle);assert.ok(failure.hospitalReserveStock.battle);assert.ok(clock(failure.campaign)<=deadlineSeconds);assert.equal(total(failure.campaign),total(start));
 const pair={campaign:failure.campaign,battle:failure.hospitalReserveStock.battle};assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),pair);assert.deepEqual(start,before);
});

test('actual current paid service is extended before finite collection time and the complete ledger replays',()=>{
 const {campaign:start,ids}=setup({nearExpiry:true}),before=structuredClone(start),result=run(start,ids),c=result.campaign;assert.ok(result.receipt.renewals.length);assert.equal(start.resources.treasury-c.resources.treasury,result.receipt.renewals.reduce((n,row)=>n+row.quote.price,0));
 for(const id of ids)assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.equal(total(c),total(start));assert.deepEqual(start,before);replay(start,result);
});

test('finite Native carrying capacity leaves the remaining known linen in its container rather than fabricating room',()=>{
 const {campaign:start,ids}=setup({kits:1000}),before=structuredClone(start),result=run(start,ids);assert.equal(total(result.campaign),total(start));assert.ok(result.receipt.capacity.length);assert.ok(result.receipt.collections.reduce((n,row)=>n+row.count,0)<1000);assert.ok(chest(result.campaign).contents.some(s=>s.item==='medkits'&&s.count>0));assert.equal(result.receipt.restored,true);assert.deepEqual(start,before);replay(start,result);
});

test('a real raid released during the paid visit returns its actual pending encounter and finite partial ledger',()=>{
 const setupResult=setup({raid:true}),{ids}=setupResult;let start=order(setupResult.campaign,{type:'wait',hours:1});
 const threat=start.enemyGroups.find(group=>group.status==='marching'&&group.target===sector);assert.ok(threat);const until=threat.arrivalAt*3600-3;
 for(let n=0;clock(start)<until&&n<20;n++)start=order(start,{type:'advanceStrategicTime',seconds:Math.min(3600,until-clock(start))});
 assert.equal(clock(start),until);assert.equal(start.pendingEncounter,null);const before=structuredClone(start);let failure;try{run(start,ids);}catch(error){failure=error;}
 assert.match(failure?.message??'',/real encounter stops/);assert.equal(failure.hospitalReserveStock.restored,false);assert.equal(failure.campaign.pendingEncounter.groupId,threat.id);assert.equal(failure.campaign.pendingBattle,null);assert.ok(failure.hospitalReserveStock.collections.length);assert.ok(clock(failure.campaign)>clock(start));assert.equal(total(failure.campaign),total(start));assert.deepEqual(saved(failure.campaign),failure.campaign);assert.deepEqual(start,before);
 replay(start,{campaign:failure.campaign,receipt:failure.hospitalReserveStock});
});

test('the current authored Tucuman map admits paid local roof physicians to its actual finite cache and back to their exact posts',t=>{
 const content=defaultContentPackage();content.headquarters=sector;content.startingTerritory[sector].owner='patriot';
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content),ids=[116,127,100,102,133],hires=[];
 let c=initialCampaign(42,content);
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',ids,sector,name:'Reserva actual de Tucuman'});c=discoverRouteCache(c,ids[0]);c=stageRouteRoofDefenders(c,ids);
 assert.deepEqual(content,declaration);const start=saved(c),before=structuredClone(start),cacheId=finiteCachesFor(start)[sector].chest,cache=state=>state.sectorStates[sector].props.find(prop=>prop.id===cacheId);
 const stock=state=>cache(state).contents.filter(row=>row.item==='medkits').reduce((n,row)=>n+row.count,0),carried=state=>state.recruited.reduce((n,id)=>n+state.operativeState[id].medkits,0),pool=stock(start);
 assert.equal(start.sectorStates[sector].width,64);assert.equal(start.sectorStates[sector].height,48);assert.ok(pool>0);assert.ok(cache(start).knownToPlayer&&cache(start).open&&!cache(start).locked);
 assert.ok(ids.every(id=>start.operativeState[id].hp===start.operativeState[id].maxHp&&(start.operativeState[id].residentPosition?.tacticalLevel??0)>0));
 let result;try{result=prepareNorthernHospitalReserveStock(start,{sector,ids,deadlineSeconds:clock(start)+3600});}catch(error){const battle=error.hospitalReserveStock?.battle;console.error('Fresh current-map collection refusal: '+JSON.stringify({reason:error.message,posts:ids.map(id=>({id,post:start.operativeState[id].residentPosition})),units:battle?.units.map(({id,x,y,tacticalLevel,stance,movementMode})=>({id,x,y,tacticalLevel,stance,movementMode})),climbLinks:battle?.climbLinks,chest:battle?.props.filter(prop=>prop.id===cacheId),doors:battle?.wallEdges.filter(edge=>edge.type==='door').map(({id,open,x,y,tacticalLevel})=>({id,open,x,y,tacticalLevel}))}));throw error;}const end=result.campaign,collected=result.receipt.collections.reduce((n,row)=>n+row.count,0);
 assert.deepEqual(result.receipt.doctors,[116,127]);assert.equal(result.receipt.visits.length,2);assert.equal(collected,pool);assert.ok(collected>0);assert.equal(stock(end),pool-collected);assert.equal(carried(end),carried(start)+collected);assert.equal(stock(end)+carried(end),pool+carried(start));
 assert.deepEqual(result.receipt.visits.map(row=>row.id),[127,127],'The trapped physician keeps its real post while the other doctor makes the paid collection visits.');assert.equal(result.receipt.transfers.length,1);const handoff=result.receipt.transfers[0];assert.equal(handoff.id,127);assert.equal(handoff.targetId,116);assert.equal(handoff.count,result.receipt.planned.find(row=>row.id===116).count);assert.equal(handoff.quote.kind,'give');assert.equal(handoff.quote.chance,100);assert.equal(handoff.quote.pa,4);assert.ok(result.receipt.orders.some(row=>row.kind==='battle'&&row.action.type==='transfer'&&row.action.targetId==='116'));
 for(const visit of result.receipt.visits){assert.ok(visit.steps.some(action=>action.type==='climb'));assert.ok(visit.steps.some(action=>action.type==='containerLoot'));assert.deepEqual(visit.restoredPost,start.operativeState[visit.id].residentPosition);}
 for(const id of ids){assert.deepEqual(end.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(end.operativeState[id].hp,start.operativeState[id].hp);assert.equal(end.operativeState[id].assignment,start.operativeState[id].assignment);}
 assert.ok(result.receipt.orders.filter(row=>row.kind==='battle').every(row=>row.action.unitId==='127'),'The actual carrier moves and pays the handoff; the other reserve bodies keep their posts.');
 assert.ok(clock(end)>clock(start)&&clock(end)<=result.receipt.deadlineSeconds);assert.deepEqual(end.squads,start.squads);assert.equal(end.activeSquadId,start.activeSquadId);assert.equal(end.resources.treasury,start.resources.treasury);assert.deepEqual(end.contracts,start.contracts);for(const {id,quote}of hires)assert.equal(end.contracts[id].paid,quote.price);
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(prepareNorthernHospitalReserveStock(saved(start),{sector,ids,deadlineSeconds:clock(start)+3600}),result);
 t.diagnostic(JSON.stringify({knownPool:pool,collected,kitBalances:result.receipt.doctors.map(id=>({id,before:start.operativeState[id].medkits,after:end.operativeState[id].medkits})),elapsedSeconds:clock(end)-clock(start),visits:result.receipt.visits.map(row=>({collector:row.id,beneficiary:row.beneficiaryId})),transfers:result.receipt.transfers.map(({id,targetId,count,quote})=>({id,targetId,count,pa:quote.pa,kind:quote.kind,chance:quote.chance}))}));
});
