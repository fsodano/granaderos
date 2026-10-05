import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {actionCosts,shotChance,teamCanSee,medicalUsePreview} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
import {nervousIsolationStatus} from '../game/nervous-isolation.js';
import {ammoCount} from '../game/ammo-types.js';
import {enterSector} from '../game/world.js';
import {nervousActor,nervousSaved,nervousOrder,nervousStep,earnNervousIsolation} from './nervous-isolation-fixture.mjs';

const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
const rounds=unit=>unit.loaded+ammoCount(unit);
const custody=unit=>({hp:unit.hp,bleeding:unit.bleeding,bandaged:unit.bandaged,energy:unit.energy,
 loaded:unit.loaded,ammo:ammoCount(unit),condition:unit.condition,inventory:unit.inventory,
 medkits:unit.medkits,boleadoras:unit.boleadoras,headwear:unit.headwear,outfit:unit.outfit,legwear:unit.legwear,
 medical:unit.medical,skillPractice:unit.skillPractice,practiceSeed:unit.practiceSeed});
const mechanical=unit=>({...custody(unit),ap:unit.ap,morale:unit.morale,x:unit.x,y:unit.y});
const fearLines=battle=>battle.log.filter(line=>line.includes('siente temor al quedar sin apoyo'));

function settlement(pair){
 const battle=pair.battle;
 return {type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:battle.status,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')};
}
function applyEvent(pair,event){
 if(event.kind==='tactical')return nervousStep(pair,event.action);
 if(event.kind==='campaign'){
  const campaign=nervousOrder(pair.campaign,event.action);
  return nervousSaved({campaign,...(campaign.pendingBattle?{battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector])}:{})});
 }
 if(event.kind==='settle')return nervousSaved({campaign:nervousOrder(pair.campaign,settlement(pair))});
 if(event.kind==='leave')return nervousSaved({campaign:nervousOrder(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')})});
 throw Error(`Unknown test event ${event.kind}`);
}
function continueRoute(execution){
 let pair=execution.pair;
 const events=execution.history.map(action=>({kind:'tactical',action}));
 const perform=event=>{pair=applyEvent(pair,event);events.push(structuredClone(event));return pair;};
 const tactical=action=>perform({kind:'tactical',action});
 const campaign=action=>perform({kind:'campaign',action});
 const fear=structuredClone(pair),beginShot=structuredClone(pair);
 tactical({type:'weapon',unitId:'130',slot:'primary'});
 const beforeReload=structuredClone(pair),reloadCost=actionCosts(pair.battle,nervousActor(pair.battle,130)).reload;
 tactical({type:'reload',unitId:'130'});
 assert.equal(nervousActor(pair.battle,130).ap,nervousActor(beforeReload.battle,130).ap-reloadCost);
 assert.equal(rounds(nervousActor(pair.battle,130)),rounds(nervousActor(beforeReload.battle,130)));
 const beforeShot=structuredClone(pair),doctor=nervousActor(pair.battle,130),enemy=nervousActor(pair.battle,'enemy-0');
 assert.equal(doctor.loaded,1,'the performance check uses an actual loaded finite pistol');
 assert.equal(teamCanSee(pair.battle,'player',enemy),true);
 const chance=shotChance(pair.battle,doctor,enemy,1),preview=targetPreview(pair.battle,doctor,enemy,{mode:'fire',aim:1});
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.chance,chance);
 const fireCost=actionCosts(pair.battle,doctor,enemy).fire+actionCosts(pair.battle,doctor,enemy).aim;
 tactical({type:'fire',unitId:'130',targetId:'enemy-0',aim:1});
 const afterShot=structuredClone(pair),fired=nervousActor(pair.battle,130);
 assert.equal(fired.ap,doctor.ap-fireCost);assert.equal(rounds(fired),rounds(doctor)-1);
 assert.equal(fired.condition,doctor.condition-1);assert.equal(fired.hp,doctor.hp);assert.equal(fired.medkits,doctor.medkits);
 assert.equal(pair.battle.elapsedSeconds-beginShot.battle.elapsedSeconds,6,'readying/reload/fire use the ordinary paid six-second combat round');
 tactical({type:'move',unitId:'130',x:6,y:0});
 const exit=pair.battle.exits.find(value=>value.destination==='retiro');assert.ok(exit);
 const exitBefore=structuredClone(pair);
 tactical({type:'exit',unitIds:['130'],exitId:exit.id});
 assert.equal(pair.battle.status,'retreat');assert.equal(nervousActor(pair.battle,130).ap,nervousActor(exitBefore.battle,130).ap-8);
 const firstBattle=structuredClone(pair.battle),firstReport=settlement(pair);
 perform({kind:'settle'});
 assert.equal(pair.campaign.location,'retiro');assert.equal(pair.campaign.resources.treasury,3104);
 assert.equal(pair.campaign.operativeState[130].hp,30);assert.equal(pair.campaign.operativeState[130].bleeding,0);
 assert.equal(pair.campaign.operativeState[130].morale,43.7,'normal retreat costs five morale; fear itself costs no personal morale');
 assert.equal(pair.campaign.operativeState[110].hp,3);assert.equal(pair.campaign.operativeState[110].bleeding,5);
 assert.equal(pair.campaign.operativeState[110].captured,true,'the un-evacuated real critical patient retains actual hostile custody');
 assert.equal(pair.campaign.operativeState[110].capturedAmmunition.ammo,9);
 const stale=dispatchCampaign(pair.campaign,firstReport);assert.ok(stale.lastError);
 assert.deepEqual({...stale,lastError:null},pair.campaign,'stale completion cannot repeat fear, wounds, custody or morale');
 const firstReturn=structuredClone(pair.campaign);

 const sosaQuote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(unit=>unit.id===100),'day');
 assert.equal(sosaQuote.price,36);const cash=pair.campaign.resources.treasury,hireAt=stamp(pair.campaign);
 campaign({type:'recruitCivic',id:100,term:'day'});
 assert.equal(pair.campaign.resources.treasury,cash-sosaQuote.price);assert.equal(pair.campaign.recruited.includes(100),false);
 const pendingArrival=structuredClone(pair);
 if(nervousActor(firstBattle,130).abilities.includes('nervous_isolation')){
  const beforeArrival=nervousSaved({campaign:nervousOrder(pendingArrival.campaign,{type:'wait',hours:5})});
  assert.equal(beforeArrival.campaign.operativeState[130].strategicIsolation.loss,5);
  assert.equal(beforeArrival.campaign.operativeState[130].morale,firstReturn.operativeState[130].morale-5,'five real eligible hours precede the replacement arrival');
 }
 campaign({type:'wait',hours:6});
 assert.equal(stamp(pair.campaign)-hireAt,6*3600);assert.ok(pair.campaign.recruited.includes(100));
 const captiveCare=Object.values(pair.campaign.detentionRecords).find(entry=>entry.npc.detention.operativeId===110);
 assert.ok(captiveCare);
 assert.deepEqual(captiveCare.care.map(({hour,sourceId,dressings,hpBefore,hpAfter,bleedingBefore,bleedingAfter})=>({hour,sourceId,dressings,hpBefore,hpAfter,bleedingBefore,bleedingAfter})),[
  {hour:19,sourceId:110,dressings:1,hpBefore:3,hpAfter:9,bleedingBefore:5,bleedingAfter:0},
  {hour:20,sourceId:110,dressings:1,hpBefore:9,hpAfter:15,bleedingBefore:0,bleedingAfter:0},
 ]);
 assert.equal(pair.campaign.operativeState[110].medkits,firstReturn.operativeState[110].medkits-captiveCare.care.reduce((sum,event)=>sum+event.dressings,0));
 assert.equal(pair.campaign.operativeState[110].hp,captiveCare.npc.hp);assert.equal(pair.campaign.operativeState[110].bleeding,captiveCare.npc.bleeding);
 assert.equal(pair.campaign.operativeState[110].capturedAmmunition.ammo,9,'guard first aid consumes the two confiscated dressings, never the held rounds');
 const renewQuote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(unit=>unit.id===130),'day'),cashBeforeRenew=pair.campaign.resources.treasury;
 campaign({type:'renewContract',id:130,term:'day'});
 assert.equal(renewQuote.price,36);assert.equal(pair.campaign.resources.treasury,cashBeforeRenew-renewQuote.price);
 const marchAt=stamp(pair.campaign);campaign({type:'attack',sector:'buenos_aires'});
 assert.equal(stamp(pair.campaign)-marchAt,12*3600);
 assert.equal(nervousActor(pair.battle,130).hp,30);assert.equal(nervousActor(pair.battle,130).shock,0);
 assert.equal(nervousActor(pair.battle,130).nervousIsolationWarned,undefined,'normal reentry resets the deployment notice with transient shock');
 assert.equal(nervousActor(pair.battle,130).morale,nervousActor(firstBattle,130).abilities.includes('nervous_isolation')?40.7:45.7,'five earned strategic losses remain; the actual first paid renewal adds its ordinary two morale');
 assert.equal(nervousActor(pair.battle,100).hp,70);assert.equal(rounds(nervousActor(pair.battle,100)),10);
 assert.equal(nervousActor(pair.battle,100).medkits,2);
 assert.equal(pair.battle.units.some(unit=>unit.id==='110'&&unit.side==='player'),false,'captured Acosta is not a fresh friendly support body');
 const secondStart=structuredClone(pair);
 // Exploration movement stops at real contact. The subsequent paid doctor
 // move separates the two actual military bodies by five same-surface cells.
 tactical({type:'move',unitId:'100',x:17,y:0});
 assert.equal(pair.battle.mode,'combat');assert.equal(nervousActor(pair.battle,100).x,21);
 tactical({type:'move',unitId:'130',x:26,y:0});
 const separated=structuredClone(pair);tactical({type:'enemyTurn'});
 const secondFear=structuredClone(pair),secondDoctor=nervousActor(pair.battle,130);
 assert.equal(secondDoctor.hp,30);assert.equal(secondDoctor.morale,secondDoctor.abilities.includes('nervous_isolation')?40.7:45.7);
 assert.equal(nervousActor(pair.battle,100).hp,27);assert.equal(nervousActor(pair.battle,100).bleeding,3);
 if(secondDoctor.abilities.includes('nervous_isolation')){
  assert.equal(nervousIsolationStatus(separated.battle,nervousActor(separated.battle,130)).active,true);
  assert.equal(secondDoctor.shock,2);assert.equal(fearLines(pair.battle).length,1);
 }else{assert.equal(secondDoctor.shock,0);assert.equal(fearLines(pair.battle).length,0);}
 tactical({type:'weapon',unitId:'100',slot:'medical'});
 const beforeBandage=structuredClone(pair),plan=medicalUsePreview(pair.battle,nervousActor(pair.battle,100),nervousActor(pair.battle,100));
 assert.equal(plan.allowed,true,plan.reason);assert.equal(plan.treatment.dressingsUsed,1);
 tactical({type:'heal',unitId:'100',targetId:'100'});
 assert.equal(nervousActor(pair.battle,100).medkits,1);assert.equal(nervousActor(pair.battle,100).hp,27);
 assert.equal(nervousActor(pair.battle,100).bleeding,0);assert.equal(nervousActor(pair.battle,100).ap,nervousActor(beforeBandage.battle,100).ap-plan.cost);
 tactical({type:'movement',unitId:'130',movement:'run'});
 const doctorMoveAP=nervousActor(pair.battle,130).ap;tactical({type:'move',unitId:'130',x:31,y:0});
 assert.equal(nervousActor(pair.battle,130).ap,doctorMoveAP-30);
 tactical({type:'movement',unitId:'100',movement:'run'});
 const sosaMoveAP=nervousActor(pair.battle,100).ap;tactical({type:'move',unitId:'100',x:28,y:0});
 assert.equal(nervousActor(pair.battle,100).ap,sosaMoveAP-42);
 const regrouped=structuredClone(pair);
 assert.equal(nervousActor(pair.battle,130).shock,secondDoctor.shock,'physical regroup does not refund the existing shock');
 if(secondDoctor.abilities.includes('nervous_isolation'))assert.equal(nervousIsolationStatus(pair.battle,nervousActor(pair.battle,130)).reason,'companion');
 tactical({type:'enemyTurn'});
 assert.equal(pair.battle.mode,'combat');assert.equal(pair.battle.turn,regrouped.battle.turn+1);
 assert.equal(nervousActor(pair.battle,130).shock,secondDoctor.shock/2,'a real regrouped combat turn performs recovery without another fear charge');
 assert.equal(fearLines(pair.battle).length,secondDoctor.abilities.includes('nervous_isolation')?1:0);
 const regroupTurn=structuredClone(pair);
 tactical({type:'exit',unitIds:['130','100'],exitId:pair.battle.exits.find(value=>value.destination==='retiro').id});
 assert.equal(pair.battle.status,'retreat');const secondBattle=structuredClone(pair.battle);
 perform({kind:'settle'});
 assert.equal(pair.campaign.resources.treasury,3032);assert.equal(pair.campaign.operativeState[110].captured,true);
 assert.equal(pair.campaign.operativeState[110].hp,captiveCare.npc.hp);assert.equal(pair.campaign.operativeState[110].bleeding,captiveCare.npc.bleeding);
 assert.equal(pair.campaign.operativeState[110].medkits,0);assert.deepEqual(pair.campaign.detentionRecords[captiveCare.npc.id].care,captiveCare.care);
 assert.equal(pair.campaign.operativeState[130].morale,secondDoctor.abilities.includes('nervous_isolation')?35.7:40.7);
 const returned=structuredClone(pair.campaign),contracts=structuredClone(pair.campaign.contracts);
 for(let visit=0;visit<2;visit++){
  campaign({type:'visitSector'});
  for(const id of [130,100]){
   const unit=nervousActor(pair.battle,id),prior=nervousActor(secondBattle,id);
   assert.deepEqual(custody(unit),custody(prior));assert.equal(unit.shock,0);
   assert.equal(unit.nervousIsolationWarned,undefined);
  }
  const unit=nervousActor(pair.battle,130);
  tactical({type:'look',unitId:'130',x:unit.x+(unit.facing===2?-1:1),y:unit.y});
  assert.equal(fearLines(pair.battle).length,0,'friendly exploration and reload/reentry do not invent another fear event');
  perform({kind:'leave'});
  assert.deepEqual(pair.campaign.contracts,contracts);assert.equal(pair.campaign.resources.treasury,3032);
 }
 let replay=nervousSaved(execution.start);
 for(const event of events)replay=applyEvent(replay,event);
 assert.deepEqual(replay,pair,'the full finite encounter, capture, real hire/renewal/travel, regroup and two physical returns replay through official saves');
 return {pair,events,fear,beforeShot,afterShot,chance,fireCost,reloadCost,firstBattle,firstReturn,captiveCare,secondStart,separated,secondFear,regrouped,regroupTurn,secondBattle,returned};
}

test('paid native fear is earned by hostile wounds and a real miss; finite firing, capture, replacement and paid regroup survive official replay',t=>{
 const current=earnNervousIsolation(),legacy=earnNervousIsolation({oldPinned:true});
 assert.deepEqual(current.prices,[{id:130,price:36},{id:110,price:60}]);
 assert.equal(current.start.campaign.hour,18);assert.equal(current.start.campaign.resources.treasury,3104);
 for(const id of [130,110]){assert.equal(rounds(nervousActor(current.start.battle,id)),10);assert.equal(nervousActor(current.start.battle,id).medkits,2);}
 const doctor=nervousActor(current.pair.battle,130),oldDoctor=nervousActor(legacy.pair.battle,130);
 assert.equal(doctor.hp,30);assert.equal(doctor.bleeding,0);assert.equal(doctor.morale,48.7);
 assert.equal(doctor.hp,nervousActor(current.wounded.battle,130).hp,'finite first aid stops bleeding without healing the ordinary wound');
 assert.equal(doctor.medkits,nervousActor(current.wounded.battle,130).medkits-1);
 assert.equal(nervousActor(current.pair.battle,110).hp,3);assert.equal(nervousActor(current.pair.battle,110).unconscious,true);
 assert.equal(nervousIsolationStatus(current.pair.battle,doctor).active,true);
 assert.equal(doctor.shock,nervousActor(current.beforeFear.battle,130).shock/2+2);
 assert.equal(oldDoctor.shock,nervousActor(legacy.beforeFear.battle,130).shock/2);
 assert.equal(fearLines(current.pair.battle).length,1);assert.equal(fearLines(legacy.pair.battle).length,0);
 assert.equal(nervousIsolationStatus(legacy.pair.battle,oldDoctor).eligible,false);
 assert.equal(oldDoctor.abilities.includes('care_composure'),true);
 assert.equal(nervousSaved(current.pair).battle.units.find(unit=>unit.id==='130').shock,doctor.shock,'saving/loading itself is not a turn');
 assert.equal(current.pair.battle.seed,legacy.pair.battle.seed);assert.equal(current.pair.battle.elapsedSeconds,legacy.pair.battle.elapsedSeconds);
 for(const unit of current.pair.battle.units)assert.deepEqual(mechanical(unit),mechanical(nervousActor(legacy.pair.battle,unit.id)),'authored fear changes only ordinary shock/notice at this real turn');
 const actual=continueRoute(current),control=continueRoute(legacy);
 assert.equal(actual.chance,7);assert.equal(control.chance,17,'the observed loaded-pistol forecast responds to the two real fear shock points');
 assert.equal(actual.afterShot.battle.seed,control.afterShot.battle.seed);
 assert.equal(actual.afterShot.battle.elapsedSeconds,control.afterShot.battle.elapsedSeconds);
 for(const unit of actual.afterShot.battle.units)assert.deepEqual(mechanical(unit),mechanical(nervousActor(control.afterShot.battle,unit.id)),'this natural shot misses in both declared content controls without a gear/RNG grant');
 assert.equal(rounds(nervousActor(actual.firstBattle,130)),7);assert.equal(rounds(nervousActor(actual.firstBattle,110)),9);
 assert.equal(rounds(nervousActor(actual.secondBattle,100)),10);assert.equal(nervousActor(actual.secondBattle,100).medkits,1);
 const final=actual.pair.campaign;
 assert.equal(final.operativeState[130].hp,30);assert.equal(final.operativeState[100].hp,27);
 assert.equal(final.sectorStates.buenos_aires.units.find(unit=>unit.id==='enemy-1').hp,0,'the actual enemy casualty remains in the saved hostile sector');
 t.diagnostic(JSON.stringify({fixture:'Prepared initial48x16 Buenos Aires observation arena and stone screen7,2; fixed seed42; native force/health/kit retained. This is not a conquest or full-campaign proof.',failedProbes:'Earlier fixed seed42 probes failed through actual Cejas deaths, untreated bleeding loss, or incapacity before regroup; no outcome was patched.',prices:current.prices,replacement:{id:100,day:36,arrivalHours:6},renewal:{id:130,day:36},treasury:final.resources.treasury,firstArrivalHour:6,firstAssaultHour:18,secondAssaultHour:actual.secondStart.campaign.hour,actions:actual.events.length,firstActionSeconds:actual.firstBattle.elapsedSeconds,secondActionSeconds:actual.secondBattle.elapsedSeconds,firstFear:{hp:doctor.hp,morale:doctor.morale,shockBeforeDecay:nervousActor(current.beforeFear.battle,130).shock,shock:doctor.shock,legacyShock:oldDoctor.shock,loadedChance:actual.chance,legacyLoadedChance:control.chance,firePA:actual.fireCost,reloadPA:actual.reloadCost},capture:{id:110,hp:final.operativeState[110].hp,bleeding:final.operativeState[110].bleeding,ammo:final.operativeState[110].capturedAmmunition.ammo,care:actual.captiveCare.care},regroup:{positions:[{id:130,x:nervousActor(actual.regrouped.battle,130).x,y:nervousActor(actual.regrouped.battle,130).y},{id:100,x:nervousActor(actual.regrouped.battle,100).x,y:nervousActor(actual.regrouped.battle,100).y}],movePA:[30,42],shockBefore:nervousActor(actual.regrouped.battle,130).shock,shockAfter:nervousActor(actual.regroupTurn.battle,130).shock},returned:[130,100].map(id=>({id,hp:final.operativeState[id].hp,bleeding:final.operativeState[id].bleeding,medkits:final.operativeState[id].medkits})),rounds:{cejas:rounds(nervousActor(actual.secondBattle,130)),acostaCaptured:final.operativeState[110].capturedAmmunition.ammo,sosa:rounds(nervousActor(actual.secondBattle,100))},enemyDeaths:actual.secondBattle.units.filter(unit=>unit.side==='enemy'&&unit.hp===0).map(unit=>unit.id),playerDeaths:actual.secondBattle.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>unit.id),seed:actual.secondBattle.seed,returnSector:final.location,clock:{hour:final.hour,second:final.secondOfHour}}));
});
