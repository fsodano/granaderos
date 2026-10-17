import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,canSee} from '../game/tactical.js';
import {spacePoint,sameCell} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {blockedCoastDressingPlan,distributeBlockedCoastDressings} from './blocked-coast-medical-reserve.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const actor=(b,id)=>b.units.find(u=>u.id===String(id));
const canonical=c=>{const result=structuredClone(c);for(const key of ['sectorStates','sceneStates'])for(const id of Object.keys(result[key]??{}))result[key][id]=expandCellScene(result[key][id]);return result;};
const save=pair=>{const result=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(canonical(result.campaign),canonical(pair.campaign));assert.deepEqual(result.battle,pair.battle??null);return result;};
function order(c,action,rows=[]){const cash=c.resources.treasury,from=clock(c),next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);rows.push({kind:'campaign',action:structuredClone(action),from,to:clock(next),cost:cash-next.resources.treasury});return next;}
function step(pair,action){
 const before=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,before);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return save({campaign:next.campaign,battle:next.battle});
}
function move(pair,id,point){
 for(let n=0;!sameCell(actor(pair.battle,id),point)&&n<80;n++){
  const from=spacePoint(actor(pair.battle,id)),route=getReachable(pair.battle,actor(pair.battle,id),{stopAt:p=>sameCell(p,point)})[0];assert.ok(route?.path.length);
  pair=step(pair,{type:'move',unitId:String(id),...spacePoint(route.path[0])});assert.notDeepEqual(spacePoint(actor(pair.battle,id)),from);
 }
 assert.ok(sameCell(actor(pair.battle,id),point));return pair;
}

// Declare the finite packs and lethal trap before validation and factory.
// The current paid party earns the casualty and observes its actual remains.
function setup({kits=10,localKits=0,wounded=false}={}){
 const d=scaffoldDocuments('declared-blocked-coast-medical-reserve');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','los_patos').replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.startingTerritory.los_patos.owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={cordoba:0,los_patos:0};d.world.arrivalFacilities.los_patos=['barracks'];d.content.arrivalSites.push({sector:'los_patos',facilities:['barracks']});
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:24,reserve:1,raidEveryHours:240,axis:['los_patos']}}};
 d.world.exitLinks=[['cordoba','E',19,8,'los_patos','W',0,8]];
 d.content.characters=Array.from({length:3},(_,i)=>({...structuredClone(base),id:'medical-party-'+i,name:'Persona '+i,nickname:'Persona '+i,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,strength:100,medical:i===0?91:i===1?89:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?localKits:i===2?kits:0},
  ...(i===0&&wounded?{startingCondition:{hp:10,bleeding:2,bandaged:0,energy:100,fatigue:0}}:{})}));
 d.maps.los_patos.props=[{id:'finite-stock-trap',type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.environment.los_patos={doors:[],containers:[{selector:{type:'chest',id:'finite-stock-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const bornSeconds=clock(c);
 const ids=rosterFor(c).map(op=>op.id),localDoctorId=ids[0],physicianId=ids[1],fallen=ids[2];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:id===localDoctorId?'cordoba':'los_patos'});assert.equal(cash-c.resources.treasury,quote.total);}
 // An acute refusal is checked before any visit or travel advances its clock.
 if(wounded){assert.equal(clock(c),bornSeconds);assert.equal(c.operativeState[localDoctorId].alive,true);assert.equal(c.operativeState[localDoctorId].hp,10);assert.equal(c.operativeState[localDoctorId].bleeding,2);assert.deepEqual(d,declaration);return {campaign:save({campaign:c}).campaign,localDoctorId,physicianId,fallen};}
 const network=TRANSPORT_NETWORKS.find(row=>row.id==='posta'),cash=c.resources.treasury;c=order(c,{type:'transport',mode:'posta'});assert.equal(c.resources.treasury,cash-network.cost);assert.equal(c.routes.posta,true);assert.equal(clock(c),bornSeconds);
 c=order(c,{type:'createSquad',sector:'cordoba',ids:[localDoctorId],name:'Clínica local'});const home=c.activeSquadId;
 c=order(c,{type:'visitSector'});const localPair=save({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.cordoba)});assert.equal(localPair.battle.sectorCleared,true);
 c=order(localPair.campaign,{type:'leaveSector',battleId:localPair.campaign.pendingBattle.id,sectorState:localPair.battle,survivors:localPair.battle.units.filter(u=>u.side==='player')});
 c=order(c,{type:'createSquad',sector:'los_patos',ids:[physicianId,fallen],name:'Vendas finitas'});const courier=c.activeSquadId;
 c=order(c,{type:'visitSector'});let pair=save({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.los_patos)});
 const chest=pair.battle.props.find(p=>p.id==='finite-stock-trap'),route=getReachable(pair.battle,actor(pair.battle,fallen)).filter(p=>Math.abs(p.x-chest.x)+Math.abs(p.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(route);
 pair=move(pair,fallen,route);pair=step(pair,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:chest.id,verb:'open'}});assert.equal(actor(pair.battle,fallen).hp,0);assert.equal(actor(pair.battle,fallen).medkits,kits);
 const body=actor(pair.battle,fallen),contact=getReachable(pair.battle,actor(pair.battle,physicianId)).filter(p=>Math.hypot(p.x-body.x,p.y-body.y)<=1.5&&!sameCell(p,body)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(contact);
 pair=move(pair,physicianId,contact);assert.equal(canSee(pair.battle,actor(pair.battle,physicianId),body),true);assert.equal(actor(pair.battle,fallen).knownToPlayer,true);
 c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 c=order(c,{type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.location,'cordoba');assert.equal(c.squads.find(q=>q.id===courier).journey,undefined);
 assert.equal(c.operativeState[fallen].alive,false);assert.deepEqual(d,declaration);return {campaign:save({campaign:c}).campaign,localDoctorId,physicianId,fallen,home,courier};
}

function collectAndReturn(start,plan,rows){
 let c=order(start,{type:'travel',sector:'los_patos',mode:'posta'},rows);assert.equal(c.location,'los_patos');
 let collected=0;
 while(collected<plan.requested){
  const model=sectorInventoryModel(c,'los_patos',rosterFor(c),plan.physicianId),row=model.entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits');if(!row)break;
  const count=Math.min(row.count,plan.requested-collected);c=order(c,{type:'sectorInventory',sector:'los_patos',operativeId:plan.physicianId,direction:'take',sourceKey:row.key,expected:row.expected,count},rows);collected+=count;
 }
 c=order(c,{type:'travel',sector:'cordoba',mode:'posta'},rows);assert.equal(c.location,'cordoba');return {campaign:c,collected};
}

test('a stable empty local clinic receives two real kits after the paid trip while the physician keeps six and every finite debit replays',()=>{
 const {campaign:start,localDoctorId,physicianId,fallen}=setup(),before=structuredClone(start),rows=[],plan=blockedCoastDressingPlan(start,{localDoctorId,physicianId});
 assert.equal(plan.requested,8);assert.equal(plan.localDeficit,2);assert.equal(sectorInventoryModel(start,'cordoba',rosterFor(start),localDoctorId).entries.some(row=>row.count>0&&JSON.parse(row.expected).item==='medkits'),false);
 const trip=collectAndReturn(start,plan,rows);assert.equal(trip.collected,8);const result=distributeBlockedCoastDressings(trip.campaign,plan),end=result.campaign;rows.push(...result.receipt.orders);
 assert.equal(end.operativeState[localDoctorId].medkits,2);assert.equal(end.operativeState[physicianId].medkits,6);assert.equal(end.sectorStates.los_patos.units.find(u=>u.id===String(fallen)).medkits,2);assert.equal(end.operativeState[fallen].alive,false);
 assert.equal(clock(end)-clock(start)>0,true);assert.ok(clock(end)-clock(start)<=48*3600);assert.equal(start.resources.treasury-end.resources.treasury,rows.reduce((n,row)=>n+row.cost,0));assert.deepEqual(end.contracts,start.contracts);assert.deepEqual(end.squads,trip.campaign.squads);assert.equal(end.activeSquadId,trip.campaign.activeSquadId);
 for(const id of [localDoctorId,physicianId])for(const key of ['hp','maxHp','bleeding','bandaged','assignment'])assert.deepEqual(end.operativeState[id][key],start.operativeState[id][key]);
 let replay=save({campaign:start}).campaign;for(const row of rows){assert.equal(clock(replay),row.from);replay=order(replay,row.action);assert.equal(clock(replay),row.to);}assert.deepEqual(canonical(save({campaign:replay}).campaign),canonical(end));assert.deepEqual(start,before);
});

test('an existing two-kit local reserve requests only the original physician six',()=>{
 const {campaign:start,localDoctorId,physicianId}=setup({localKits:2}),rows=[],plan=blockedCoastDressingPlan(start,{localDoctorId,physicianId});assert.equal(plan.localDeficit,0);assert.equal(plan.requested,6);
 const trip=collectAndReturn(start,plan,rows),result=distributeBlockedCoastDressings(trip.campaign,plan);assert.equal(result.receipt.orders.length,0);assert.equal(result.campaign.operativeState[localDoctorId].medkits,2);assert.equal(result.campaign.operativeState[physicianId].medkits,6);save({campaign:result.campaign});
});

test('a partial finite collection preserves the real return and six-kit reserve rather than claiming the missing local supply',()=>{
 const {campaign:start,localDoctorId,physicianId,fallen}=setup({kits:7}),rows=[],plan=blockedCoastDressingPlan(start,{localDoctorId,physicianId}),trip=collectAndReturn(start,plan,rows);assert.equal(trip.collected,7);let failure;
 try{distributeBlockedCoastDressings(trip.campaign,plan);}catch(error){failure=error;}
 assert.equal(failure?.message,`No actual reachable finite dressings remain for ${localDoctorId} at cordoba.`);assert.equal(failure.campaign,trip.campaign);assert.equal(failure.campaign.operativeState[physicianId].medkits,7);assert.equal(failure.campaign.operativeState[localDoctorId].medkits,0);assert.equal(failure.campaign.sectorStates.los_patos.units.find(u=>u.id===String(fallen)).medkits,0);assert.deepEqual(failure.blockedCoastMedicalReserve.orders,[]);assert.equal(failure.blockedCoastMedicalReserve.completed,false);assert.deepEqual(start.operativeState[localDoctorId].medkits,0);
});

test('an acute local patient cannot be used as permission to delay care for the trip',()=>{
 const {campaign:start,localDoctorId,physicianId}=setup({wounded:true}),before=structuredClone(start);assert.throws(()=>blockedCoastDressingPlan(start,{localDoctorId,physicianId}),/fully healed and stable/);assert.deepEqual(start,before);
});
