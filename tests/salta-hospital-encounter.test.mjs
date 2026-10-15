import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,stanceCost,getReachable,artilleryContact,medicalUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {saltaHospitalBattleOptions,saltaHospitalEncounterExecutor} from './salta-hospital-encounter.mjs';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {openingRearFormation} from './opening-rear-medical-supply.mjs';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';

const actor=(b,id)=>b.units.find(u=>u.id===id);
function arena({patient=false,doctorId='doctor',hidden=false}={}){
 const upperSurfaces=Array.from({length:20},(_,i)=>({id:`clinic:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 return createBattle([
  {id:'guard',x:5,y:6,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:90,stance:'standing',facing:0,energy:100,morale:90},
  {id:'front',x:5,y:4,tacticalLevel:1,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90,...(patient?{hp:55,maxHp:100,bleeding:3,bandaged:0}:{})},
  {id:doctorId,x:patient?5:7,y:patient?5:8,tacticalLevel:1,weapon:0,weaponDropped:true,loaded:0,ammo:0,medical:94,medkits:2,hp:21,maxHp:66,bleeding:0,bandaged:45,stance:'standing',facing:0,energy:100,morale:90},
 ],{id:'declared-salta-clinic-defense',width:40,height:20,tiles:Array.from({length:800},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),upperSurfaces,hour:12,seed:45,
  enemies:[{id:'target',x:5,y:2,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false},
   {id:hidden?'another-private-id':'hidden',x:hidden?38:39,y:18,name:hidden?'Otra identidad':'No visto',weapon:0,loaded:0,ammo:hidden?99:0,patrol:false,overwatch:false}],
  artillery:[{id:'unmanned-charged-gun',type:'bronze4',side:'player',x:6,y:15,loaded:true,ammo:0}],
 });
}
function replay(start,orders){
 let ordinary=structuredClone(start),presented=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  ordinary=actBattle(ordinary,action);assert.equal(ordinary.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,ordinary);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,action))));assert.deepEqual(saved,ordinary);
 }
 return ordinary;
}

test('a stale start classification cannot enable the executor without the actual current campaign',()=>{
 const explicit=()=>null;
 assert.equal(saltaHospitalEncounterExecutor(),undefined);
 for(const options of [{},{allCovered:false},{allCovered:true,encounterController:explicit}])assert.equal(saltaHospitalEncounterExecutor(options,'tucuman'),undefined);
 assert.equal(saltaHospitalEncounterExecutor({allCovered:true},'cordoba'),undefined);
 assert.equal(saltaHospitalEncounterExecutor({allCovered:true},'tucuman'),undefined);
});

test('paid Native roof staging changes the real encounter selector while mixed cover and explicit overrides keep the old path',()=>{
 const content=defaultContentPackage();content.headquarters='tucuman';delete content.startingTerritory;content.rules.startingTreasury=10000;
 for(const id of [110,116,123])content.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 const declared=structuredClone(content),order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;},saved=c=>decodeSave(encodeSave(c)).campaign;
 let start=initialCampaign(42,content);for(const id of [110,116])start=order(start,{type:'recruitCivic',id,term:'week'});start=saved(start);
 const before=structuredClone(start),originalFormation=openingRearFormation(start),events=[];
 assert.equal(originalFormation.hasCover,false);assert.equal(originalFormation.allCovered,false);
 assert.equal(saltaHospitalEncounterExecutor({campaign:start},'tucuman'),undefined);
 const prepared=stageOpeningRearCover(start,{report:event=>events.push(event)}),current=prepared.campaign,currentFormation=openingRearFormation(current);
 assert.equal(currentFormation.allCovered,true);assert.equal(currentFormation.roofIds.length,2);assert.deepEqual(start,before);assert.deepEqual(content,declared);
 const roof=events.find(event=>event.event==='routeRoofDefenders');assert.ok(roof&&roof.actions.some(action=>action.type==='move'&&action.tacticalLevel===1));assert.ok(roof.elapsedSeconds>0);
 assert.ok(current.hour*3600+(current.secondOfHour??0)>start.hour*3600+(start.secondOfHour??0));assert.equal(current.resources.treasury,start.resources.treasury);assert.deepEqual(current.contracts,start.contracts);
 for(const id of [110,116]){assert.equal(current.operativeState[id].hp,start.operativeState[id].hp);assert.equal(current.operativeState[id].medkits,start.operativeState[id].medkits);assert.ok(current.operativeState[id].energy<start.operativeState[id].energy);}
 // The real orders() call supplies campaign:next from its Native encounter
 // response. This is that same selector hook, after real paid cover changed.
 const executor=saltaHospitalEncounterExecutor({campaign:current},'tucuman');assert.equal(typeof executor,'function');
 assert.equal(saltaHospitalEncounterExecutor({campaign:saved(current)},'tucuman'),executor);
 assert.deepEqual(stageOpeningRearCover(saved(start)).campaign,current,'The fresh paid staging sequence repeats exactly from its official initial save.');
 assert.equal(saltaHospitalEncounterExecutor({campaign:current,encounterController:()=>null},'tucuman'),undefined);
 assert.equal(saltaHospitalEncounterExecutor({campaign:current},'cordoba'),undefined);
 const mixed=order(current,{type:'recruitCivic',id:123,term:'week'});assert.equal(openingRearFormation(mixed).allCovered,false);
 assert.equal(saltaHospitalEncounterExecutor({campaign:mixed},'tucuman'),undefined,'An actual newly admitted ground person keeps mixed cover outside this policy.');
 assert.deepEqual(saved(current),current);
});

test('actual admitted roof roles pay a protected physician stance and a useful rifle lane and discharge without borrowing the distant charged gun',()=>{
 const start=arena(),before=structuredClone(start),options=saltaHospitalBattleOptions();
 assert.throws(()=>options.controller(start,actor(start,'guard')),/actual entry/);
 assert.equal(options.admitBattle(start),start);assert.deepEqual(start,before);
 assert.throws(()=>options.admitBattle(start),/initialize once/);
 const guard=actor(start,'guard');assert.equal(usefulRouteRifleShot(publicRouteView(start,guard),guard),null);
 assert.equal(northernClinicDefenseOrder(start,guard),null,'The old whole-roof hold discards the actual firing-lane move.');
 for(const u of start.units.filter(u=>u.side==='player'))assert.equal(artilleryContact(start,u,start.artillery[0]),false);
 const stance=options.controller(start,actor(start,'doctor'));assert.deepEqual(stance,{type:'stance',unitId:'doctor',stance:'prone'});
 const protectedState=replay(start,[stance]);assert.equal(actor(protectedState,'doctor').ap,actor(start,'doctor').ap-stanceCost(actor(start,'doctor'),'prone'));
 const move=options.controller(protectedState,actor(protectedState,'guard'));assert.equal(move?.type,'move');assert.ok(sameSurface(move,guard));
 const route=getReachable(publicRouteView(protectedState,guard),guard,{stopAt:p=>sameCell(p,move)})[0];assert.ok(route.cost>0&&route.cost<=20);
 const moved=replay(start,[stance,move]);assert.equal(actor(moved,'guard').ap,guard.ap-route.cost);assert.ok(actor(moved,'guard').energy<guard.energy);
 const fire=options.controller(moved,actor(moved,'guard'));assert.equal(fire?.type,'fire');assert.equal(fire.targetId,'target');
 const cost=actionCosts(moved,actor(moved,'guard'),actor(moved,fire.targetId)),after=replay(start,[stance,move,fire]);
 assert.equal(actor(after,'guard').ap,actor(moved,'guard').ap-cost.fire-(fire.aim??0)*cost.aim);
 assert.equal(actor(after,'guard').loaded,guard.loaded-1);assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const count=u=>Object.values(unitAmmunitionByType(u)).reduce((sum,n)=>sum+n,0);assert.equal(count(actor(after,'guard')),count(guard)-1);
 assert.deepEqual(after.artillery,start.artillery);assert.equal(after.artillery[0].loaded,true);assert.equal(after.artillery[0].ammo,0);
 for(const id of ['front','doctor'])for(const key of ['hp','bleeding','medkits','weapon','inventory'])assert.deepEqual(actor(after,id)[key],actor(start,id)[key]);
 for(const key of ['tiles','props','buildings','upperSurfaces','climbLinks'])assert.deepEqual(after[key],start[key]);assert.deepEqual(start,before);
 const hidden=arena({hidden:true}),other=saltaHospitalBattleOptions();other.admitBattle(hidden);
 assert.deepEqual(other.controller(hidden,actor(hidden,'doctor')),stance);
 const hiddenStance=replay(hidden,[stance]);assert.deepEqual(other.controller(hiddenStance,actor(hiddenStance,'guard')),move);
});

test('a fresh execution admits its actual physician and retains finite adjacent aid before stance or rifle work',()=>{
 const start=arena({patient:true,doctorId:'actual-second-doctor'}),before=structuredClone(start),options=saltaHospitalBattleOptions();assert.equal(options.admitBattle(start),start);
 const physician=actor(start,'actual-second-doctor'),prepare=options.controller(start,physician);assert.deepEqual(prepare,{type:'weapon',unitId:physician.id,slot:'medical'});
 const held=replay(start,[prepare]),doctor=actor(held,physician.id),quote=medicalUsePreview(held,doctor,actor(held,'front'));assert.equal(quote.allowed,true);
 const aid=options.controller(held,doctor);assert.deepEqual(aid,{type:'useItem',unitId:physician.id,targetId:'front'});
 const after=replay(start,[prepare,aid]);assert.equal(actor(after,physician.id).medkits,physician.medkits-1);assert.equal(actor(after,physician.id).ap,doctor.ap-quote.cost);
 assert.equal(actor(after,'front').hp,55);assert.equal(actor(after,'front').bleeding,0);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});
