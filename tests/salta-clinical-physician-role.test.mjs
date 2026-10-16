import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,stanceCost,medicalUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {saltaHospitalClinicalDoctorIds,saltaHospitalBattleOptions,saltaHospitalEncounterExecutor} from './salta-hospital-encounter.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

const actor=(battle,id)=>battle.units.find(unit=>unit.id===String(id));
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=pair=>{const restored=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(restored,pair);return restored;};

function tacticalReplay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),validated=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,action))));assert.deepEqual(shown,direct);assert.deepEqual(validated,direct);}
 return direct;
}

function clinic(){
 const documents=scaffoldDocuments('declared-salta-clinical-role');
 for(const key of ['content','world','maps'])documents[key]=JSON.parse(JSON.stringify(documents[key]).replaceAll('"camp"','"cordoba"').replaceAll('"watch-post"','"tucuman"'));
 documents.content.rules.startingTreasury=10000;documents.content.startingTerritory.tucuman.owner='patriot';documents.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 documents.world.arrivalFacilities.tucuman=['barracks'];documents.content.arrivalSites.push({sector:'tucuman',facilities:['barracks']});documents.world.expansion.buildingTargets.tucuman=0;documents.maps.tucuman.props=[];
 documents.maps.tucuman.upperSurfaces=Array.from({length:20},(_,i)=>({id:'clinical-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 documents.maps.tucuman.climbLinks=[{id:'clinical-roof-access',kind:'climb',from:{x:8,y:3,tacticalLevel:0},to:{x:8,y:4,tacticalLevel:1}}];
 documents.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:6,axis:['tucuman']}}};
 const base=documents.content.characters[0],roles=[{id:'wounded-high-skill',medical:94,kits:1,wound:50},{id:'working-physician',medical:85,kits:8},{id:'local-guard',medical:0,kits:0},{id:'remote-working-physician',medical:99,kits:3}];
 documents.content.characters=roles.map(role=>({...structuredClone(base),id:role.id,name:role.id,nickname:role.id,arrivalHours:0,monthlyPay:300,serviceGuarantee:0,weapon:null,attributes:{...base.attributes,maxHp:66,medical:role.medical,strength:80},startingSupplies:{rations:0,torches:0,medkits:role.kits,boleadoras:0},startingCondition:{hp:66-(role.wound??0),bleeding:0,bandaged:role.wound??0,energy:100,fatigue:0}}));
 const declaration=structuredClone(documents),content=compileCampaignPackage(documents.manifest,documents);assert.deepEqual(validateContentPackage(content),[]);let campaign=initialCampaign(42,content);
 const ids=Object.fromEntries(rosterFor(campaign).map(op=>[op.name,op.id])),patient=ids['wounded-high-skill'],doctor=ids['working-physician'],guard=ids['local-guard'],remote=ids['remote-working-physician'];
 for(const id of [patient,doctor,guard,remote]){const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'week'),cash=campaign.resources.treasury;assert.equal(quote.available,true);campaign=order(campaign,{type:'recruitCivic',id,term:'week',destination:id===remote?'cordoba':'tucuman'});assert.equal(cash-campaign.resources.treasury,quote.total);}
 campaign=order(campaign,{type:'createSquad',sector:'tucuman',name:'Actual clinical roof',ids:[patient,doctor,guard]});campaign=stageRouteRoofDefenders(campaign,[patient,doctor,guard]);
 for(const [operativeId,assignment]of [[patient,'patient'],[doctor,'doctor'],[guard,'rest'],[remote,'doctor']])campaign=order(campaign,{type:'assignCare',operativeId,assignment});
 assert.deepEqual(documents,declaration);return {campaign,patient,doctor,guard,remote};
}

test('working local doctor intent survives the actual paid campaign defense duty reset and Native entry role admission with an official pair',()=>{
 const prepared=clinic(),start=saved({campaign:prepared.campaign,battle:null}).campaign,before=structuredClone(start);let campaign=start;
 for(let n=0;n<10&&!campaign.pendingEncounter;n++)campaign=order(campaign,{type:'wait',hours:1});
 assert.ok(campaign.pendingEncounter);assert.equal(campaign.pendingEncounter.sector,'tucuman');assert.equal(campaign.operativeState[prepared.patient].assignment,'patient');assert.equal(campaign.operativeState[prepared.doctor].assignment,'doctor');assert.equal(campaign.operativeState[prepared.remote].assignment,'doctor');
 assert.ok(campaign.operativeState[prepared.patient].hp<campaign.operativeState[prepared.patient].maxHp);assert.ok(campaign.operativeState[prepared.doctor].medkits>0,'The actual working doctor must retain finite stock at the response.');
 const preferredPhysicianIds=saltaHospitalClinicalDoctorIds(campaign,'tucuman');assert.deepEqual(preferredPhysicianIds,[prepared.doctor]);assert.deepEqual(saltaHospitalClinicalDoctorIds(campaign,'cordoba'),[prepared.remote]);
 const response=order(campaign,{type:'respondToEncounter',groupId:campaign.pendingEncounter.groupId,choice:'tactical'});assert.equal(response.operativeState[prepared.doctor].assignment,'active');assert.equal(response.operativeState[prepared.patient].assignment,'active');assert.deepEqual(saltaHospitalClinicalDoctorIds(response,'tucuman'),[],'A response-only capture loses the actual clinical duty.');
 const execute=saltaHospitalEncounterExecutor({campaign:response,preferredPhysicianIds},'tucuman');assert.equal(typeof execute,'function');assert.notEqual(execute,saltaHospitalEncounterExecutor({campaign:response},'tucuman'));assert.equal(saltaHospitalEncounterExecutor({campaign:response,preferredPhysicianIds,encounterController:()=>null},'tucuman'),undefined);
 const entered=enterSector(response.pendingBattle,response.sectorStates.tucuman),pair=syncBattleTime(response,entered);assert.equal(pair.error,null);const initial=saved({campaign:pair.campaign,battle:pair.battle}),options=saltaHospitalBattleOptions({preferredPhysicianIds});assert.equal(initial.battle.mode,entered.mode,'The official pair retains the actual Native entry mode without forcing contact.');assert.strictEqual(options.admitBattle(initial.battle),initial.battle);
 assert.equal(coordinatedHospitalBattery(initial.battle).roles.physicianId,String(prepared.patient));assert.equal(coordinatedHospitalBattery(initial.battle,{preferredPhysicianIds}).roles.physicianId,String(prepared.doctor));
 assert.deepEqual(saved(initial),initial);assert.deepEqual(initial.campaign.contracts,response.contracts);assert.equal(initial.campaign.resources.treasury,response.resources.treasury);assert.deepEqual(start,before);
});

function arena(overrides={}){
 const width=24,height=18,players=[
  {id:'working-doctor',x:5,y:5,tacticalLevel:1,medical:85,medkits:3,hp:100,maxHp:100,...overrides},
  {id:'wounded-higher-skill',x:6,y:5,tacticalLevel:1,medical:94,medkits:1,hp:38,maxHp:66,bandaged:28},
  {id:'acute-patient',x:5,y:4,tacticalLevel:1,medical:0,medkits:0,hp:10,maxHp:100,bleeding:2},
 ].map(unit=>({name:unit.id,weapon:0,blade:0,loaded:0,ammo:0,activeSlot:'primary',stance:'standing',movementMode:'walk',strength:80,dexterity:85,experienceLevel:4,energy:100,fatigue:0,morale:90,...unit}));
 const options={id:'declared-salta-competing-clinical-roles',width,height,hour:12,seed:45,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:Math.floor(i/width)===14,blocksSight:Math.floor(i/width)===14,cover:0})),upperSurfaces:Array.from({length:20},(_,i)=>({id:'roof-'+i,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20})),enemies:[{id:'enemy-doctor',x:22,y:16,weapon:0,loaded:0,ammo:0,medical:99,medkits:9,hp:100,maxHp:100,patrol:false,overwatch:false}]};
 const declared=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declared);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('the admitted working physician pays for its medical hand and finite critical aid before protected posture',()=>{
 const start=arena(),before=structuredClone(start),preferredPhysicianIds=['working-doctor'];assert.equal(coordinatedHospitalBattery(start).roles.physicianId,'wounded-higher-skill');const helper=coordinatedHospitalBattery(start,{preferredPhysicianIds,coordinatePhysicianHold:true});assert.equal(helper.roles.physicianId,'working-doctor');
 const doctor=actor(start,'working-doctor'),prepare=helper.controller(start,doctor);assert.deepEqual(prepare,{type:'weapon',unitId:doctor.id,slot:'medical'});const held=tacticalReplay(start,[prepare]);assert.equal(actor(held,doctor.id).ap,doctor.ap-actionCosts(start,doctor).weapon);
 const quote=medicalUsePreview(held,actor(held,doctor.id),actor(held,'acute-patient'));assert.equal(quote.allowed,true);const aid=helper.controller(held,actor(held,doctor.id));assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:'acute-patient'});const aided=tacticalReplay(start,[prepare,aid]);assert.equal(actor(aided,doctor.id).ap,actor(held,doctor.id).ap-quote.cost);assert.equal(actor(aided,doctor.id).medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(actor(aided,'acute-patient').hp,quote.treatment.hpAfter);assert.equal(actor(aided,'acute-patient').bleeding,0);
 const restore=helper.controller(aided,actor(aided,doctor.id));assert.deepEqual(restore,{type:'weapon',unitId:doctor.id,slot:'unarmed'});const restored=tacticalReplay(start,[prepare,aid,restore]);assert.equal(actor(restored,doctor.id).ap,actor(aided,doctor.id).ap-actionCosts(aided,actor(aided,doctor.id)).weapon);assert.equal(actor(restored,doctor.id).medkits,actor(aided,doctor.id).medkits);
 const protection=helper.controller(restored,actor(restored,doctor.id));assert.deepEqual(protection,{type:'stance',unitId:doctor.id,stance:'prone'});const end=tacticalReplay(start,[prepare,aid,restore,protection]);assert.equal(actor(end,doctor.id).ap,actor(restored,doctor.id).ap-stanceCost(actor(restored,doctor.id),'prone'));assert.ok(actor(end,doctor.id).ap>=actionCosts(end,actor(end,doctor.id)).weapon+actionCosts(end,actor(end,doctor.id)).heal+stanceCost(actor(end,doctor.id),'standing'));assert.equal(actor(end,doctor.id).medkits,actor(aided,doctor.id).medkits);assert.equal(actor(end,'wounded-higher-skill').medkits,1);assert.deepEqual(start,before);
});

test('a preference cannot admit an unfit, unqualified, unsupplied, opposing or absent physician and leaves generic ranking unchanged',()=>{
 for(const declaration of [{hp:14},{medical:59},{medkits:0},{routed:true},{captured:true},{asleep:true}]){
  const start=arena(declaration),before=structuredClone(start),ordinary=coordinatedHospitalBattery(start),preferred=coordinatedHospitalBattery(start,{preferredPhysicianIds:['working-doctor','enemy-doctor','absent']});assert.equal(preferred.roles.physicianId,'wounded-higher-skill');assert.deepEqual(preferred.roles,ordinary.roles);
  for(const unit of start.units.filter(unit=>unit.side==='player'))assert.deepEqual(preferred.controller(start,unit),ordinary.controller(start,unit));assert.deepEqual(start,before);
 }
 const start=arena(),before=structuredClone(start),ordinary=coordinatedHospitalBattery(start),empty=coordinatedHospitalBattery(start,{preferredPhysicianIds:[]});assert.deepEqual(empty.roles,ordinary.roles);for(const unit of start.units.filter(unit=>unit.side==='player'))assert.deepEqual(empty.controller(start,unit),ordinary.controller(start,unit));assert.deepEqual(start,before);
});
