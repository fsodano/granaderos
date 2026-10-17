import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedActBattle,presentedEndTurn,getReachable,teamCanSee,medicalUsePreview,reloadPlan,reprimePlan,actionCosts,movementStepCost,artilleryContact} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {REST_SECONDS,syncBattleTime} from '../game/time.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_MAPS,DEFAULT_WORLD} from '../campaigns/default.js';
import {blankMap} from '../game/map-schema.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {publicRouteView} from './route-infantry-progress.mjs';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {publicLateRearSearchEligible} from './public-rear-formation.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {openingControlWindow} from './opening-driver.mjs';
import {createPairedRouteOrders,replayPairedRouteOrders} from './paired-route-battle.mjs';

const unit=(battle,id)=>battle.units.find(actor=>actor.id===String(id)),clock=c=>c.hour*3600+(c.secondOfHour??0);
const oldOptions=ids=>({reserveIds:ids,coordinateInfantry:true,coordinateRifleCover:true,coordinateSupportStaging:true});
const options=ids=>({...oldOptions(ids),coordinateRearFormation:true});
const flat=(w=40,h=16)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w),type:'grass',blocked:false,cover:0}));
const personal={id:'required',x:2,y:8,facing:6,stance:'standing',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60,patrol:false,overwatch:false};
// New declared subsystem inputs only. Map/body/stock declarations happen
// before createBattle; no returned state is edited to get turn20 or an exit.
function arena({profile={},extra=[],gun=false,hiddenKind=null,combat=false,road=false}={}){
 const tiles=flat().map(t=>({...t,blocked:road&&t.y!==8&&t.x<10}));
 return createBattle([{...personal,...profile},...extra],{id:'declared-late-rear-search',width:40,height:16,tiles,hour:12,seed:45,exploration:!combat,deferContact:false,
  enemies:combat?[{id:'contact',x:12,y:8,facing:6,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}]:hiddenKind==='actor'?[{id:'unknown',x:6,y:8,facing:2,weapon:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}]:[],
  artillery:gun?[{id:'owned-bronze',type:'bronze4',side:'player',x:3,y:8,loaded:true,ammo:2}]:hiddenKind==='gun'?[{id:'unknown',type:'swivel',side:'enemy',x:6,y:8,loaded:true,ammo:3}]:[],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=(action.type==='endTurn'?presentedEndTurn(presented):presentedActBattle(presented,action)).state;assert.deepEqual(presented,direct);
  const copied=JSON.parse(JSON.stringify(action));restored=validateBattleSnapshot(JSON.parse(JSON.stringify(copied.type==='endTurn'?endTurn(restored):actBattle(restored,copied))));assert.deepEqual(restored,direct);
 }
 return direct;
}
function late(start){
 const orders=Array.from({length:19},()=>({type:'endTurn'})),battle=replay(start,orders);
 assert.equal(start.turn,1);assert.equal(battle.turn,20);assert.equal(battle.mode,'exploration');assert.equal(battle.phase,'player');assert.equal(battle.status,'active');assert.equal(battle.elapsedSeconds,19*REST_SECONDS);
 return {battle,orders};
}
function physical(before,after,id){
 const a=unit(before,id),b=unit(after,id);
 for(const k of ['hp','maxHp','bleeding','medical','medkits','loaded','weapon','condition','inventory','assignment','outfit','headwear','legwear'])assert.deepEqual(b[k],a[k],k);
 assert.deepEqual(unitAmmunitionByType(b),unitAmmunitionByType(a));assert.deepEqual(after.artillery,before.artillery);
}
const official=pair=>{const decoded=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(decoded,pair);return decoded;};
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};

// One declared official campaign arena, not a normal route prefix. Only the
// open map/player anchor/zero arrival delay are authored before initialCampaign.
// All actual roster stats, health, finite gear, fees, terms and residents remain.
function servingCourtyard(){
 const content=defaultContentPackage();content.maps=structuredClone(DEFAULT_MAPS);content.world=structuredClone(DEFAULT_WORLD);
 content.maps.retiro=blankMap({id:'retiro',title:'Declared late rear search',width:20,height:16});content.world.expansion.buildingTargets.retiro=0;
 content.world.deployment.retiro={...(content.world.deployment.retiro??{}),playerAnchors:[{x:1,y:2}]};
 const ids=[110,121,108];for(const id of ids){const character=content.characters.find(c=>c.id==='person-'+id);assert.ok(character);character.arrivalHours=0;}
 const definition=structuredClone(content);let c=initialCampaign(8,content),paid=0;
 for(const id of ids){const op=rosterFor(c).find(o=>o.id===id),quote=contractQuote(c,op,'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.total);paid+=quote.total;assert.ok(c.recruited.includes(id));}
 assert.equal(c.resources.treasury,3200-paid);assert.deepEqual(c.squad,ids);c=order(c,{type:'visitSector'});
 return {campaign:c,content,definition,ids:ids.map(String)};
}

test('late no-screen cohort search gives every fit reserve ordinary paid work and exact full paired save/replay',()=>{
 const setup=servingCourtyard(),campaign=setup.campaign,input=structuredClone(campaign),request=campaign.pendingBattle,previous=campaign.sectorStates.retiro;
 const run=()=>{
  const bridge=createPairedRouteOrders(campaign,enterSector(request,previous));official(bridge.pair);
  const issue=action=>bridge.executeOrder(bridge.pair.battle,action);
  for(const id of setup.ids)if(!unit(bridge.pair.battle,id).loaded){const actor=unit(bridge.pair.battle,id),quote=reloadPlan(actor,bridge.pair.battle),stock=unitAmmunitionByType(actor);assert.ok(quote.rounds>0);issue({type:'reload',unitId:id});assert.ok(unit(bridge.pair.battle,id).loaded>0);assert.deepEqual(unitAmmunitionByType(unit(bridge.pair.battle,id)),stock);}
  const waitStart=bridge.pair.battle.elapsedSeconds;
  for(let i=0;i<19;i++){const before=bridge.pair.battle;issue({type:'endTurn'});assert.equal(bridge.pair.battle.turn,before.turn+1);assert.equal(bridge.pair.battle.elapsedSeconds,before.elapsedSeconds+REST_SECONDS);}
  assert.equal(bridge.pair.battle.turn,20);assert.equal(bridge.pair.battle.mode,'exploration');assert.equal(bridge.pair.battle.elapsedSeconds,waitStart+19*REST_SECONDS);official(bridge.pair);
  const start=structuredClone(bridge.pair),old=recoveryPortSearchController(start.battle,oldOptions(setup.ids)),controller=recoveryPortSearchController(start.battle,options(setup.ids)),firstMoves=new Map();
  for(const id of setup.ids){const actor=unit(start.battle,id);assert.equal(actor.hp,actor.maxHp);assert.equal(actor.bleeding,0);assert.ok(actor.loaded>0);assert.equal(publicLateRearSearchEligible(start.battle,actor,{reserveIds:setup.ids}),true);assert.equal(old(start.battle,actor),null);assert.equal(controller(start.battle,actor)?.type,'move');}
  const window=openingControlWindow(bridge.pair.battle,{controller,sharedFallback:controller.sharedFallback,executeOrder:(current,action)=>{
   const prior=structuredClone(bridge.pair),actor=unit(current,action.unitId),direct=actBattle(current,action);assert.equal(direct.lastError,null);
   assert.deepEqual(presentedActBattle(current,action).state,direct);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(direct))),direct);
   if(action.type==='move'){
    const search=sectorSearchOrder(publicRouteView(current,actor),actor);assert.deepEqual(action,search,'use the current public search, not a hidden battle destination');
    const route=getReachable(publicRouteView(current,actor),actor).find(p=>sameCell(p,action));assert.ok(route?.cost>0&&route.cost<=Math.min(32,actor.ap-20));assert.ok(route.path.every(p=>sameSurface(p,actor)));
    const costs=route.path.reduce((sum,p,i)=>sum+movementStepCost(current,actor,i?route.path[i-1]:actor,p),0);assert.equal(costs,route.cost);
    const seconds=route.path.reduce((sum,p,i)=>sum+Math.ceil(3*((i?route.path[i-1]:actor).x!==p.x&&(i?route.path[i-1]:actor).y!==p.y?1.4:1)),0);
    assert.deepEqual(spacePoint(unit(direct,actor.id)),spacePoint(action));assert.equal(direct.elapsedSeconds,current.elapsedSeconds+seconds);assert.equal(unit(direct,actor.id).ap,actor.ap,'Native exploration pays time/energy, not combat AP');assert.ok(unit(direct,actor.id).energy<actor.energy);physical(current,direct,actor.id);
    if(!firstMoves.has(actor.id))firstMoves.set(actor.id,{action:structuredClone(action),seconds,cost:route.cost});
   }
   const expected=syncBattleTime(prior.campaign,direct);assert.equal(expected.error,null);const next=bridge.executeOrder(current,action);assert.deepEqual(bridge.pair,{campaign:expected.campaign,battle:expected.battle});
   assert.equal(clock(bridge.pair.campaign),clock(prior.campaign)+direct.elapsedSeconds-current.elapsedSeconds);assert.equal(bridge.pair.campaign.resources.treasury,start.campaign.resources.treasury);assert.deepEqual(bridge.pair.campaign.contracts,start.campaign.contracts);
   if(firstMoves.size===setup.ids.length)official(bridge.pair);return next;
  }});
  assert.deepEqual(new Set(firstMoves.keys()),new Set(setup.ids),'ordinary passes serve the complete cohort');assert.ok(window.orders.length>=setup.ids.length);assert.equal(window.sharedInvestigation,null,'this is not the first-actor-only fallback');assert.equal(window.battle,bridge.pair.battle);
  assert.deepEqual(replayPairedRouteOrders(campaign,request,previous,bridge.orders),bridge.pair);official(bridge.pair);
  for(const id of setup.ids){assert.ok(bridge.pair.campaign.recruited.includes(Number(id)));assert.equal(unit(bridge.pair.battle,id).hp,unit(start.battle,id).hp);assert.deepEqual(unitAmmunitionByType(unit(bridge.pair.battle,id)),unitAmmunitionByType(unit(start.battle,id)));}
  return {pair:bridge.pair,orders:bridge.orders,firstMoves:[...firstMoves]};
 };
 assert.deepEqual(run(),run());assert.deepEqual(campaign,input);assert.deepEqual(setup.content,setup.definition);
});

test('false default and early combat no-screen holds remain exact while the late exploration boundary is paid',()=>{
 const initial=arena(),copy=structuredClone(initial),pre=replay(initial,Array.from({length:18},()=>({type:'endTurn'}))),ids=['required'];assert.equal(pre.turn,19);assert.equal(publicLateRearSearchEligible(pre,unit(pre,'required'),{reserveIds:ids}),false);
 const ready=late(initial),actor=unit(ready.battle,'required'),old=recoveryPortSearchController(ready.battle,oldOptions(ids)),explicitFalse=recoveryPortSearchController(ready.battle,{...options(ids),coordinateRearFormation:false}),current=recoveryPortSearchController(ready.battle,options(ids));assert.equal(old(ready.battle,actor),null);assert.equal(explicitFalse(ready.battle,actor),null);
 const action=current(ready.battle,actor);assert.deepEqual(action,sectorSearchOrder(publicRouteView(ready.battle,actor),actor));assert.equal(action?.type,'move');const after=replay(initial,[...ready.orders,action]);assert.ok(after.elapsedSeconds>ready.battle.elapsedSeconds);physical(ready.battle,after,'required');
 const combat=arena({combat:true}),body=unit(combat,'required');assert.equal(combat.mode,'combat');assert.equal(publicLateRearSearchEligible(combat,body,{reserveIds:ids}),false);assert.deepEqual(recoveryPortSearchController(combat,options(ids))(combat,body),recoveryPortSearchController(combat,oldOptions(ids))(combat,body));assert.deepEqual(initial,copy);
});

test('late search holds clinical wounded burdened or unavailable bodies while legitimate ordinary preparation stays available',()=>{
 const profiles=[{medical:60},{assignment:'doctor',medical:52,medkits:2},{assignment:'militia_doctor',medical:52,medkits:2},{assignment:'patient'},{activeSlot:'medical',medical:30,medkits:2},{hp:70,maxHp:100},{weaponMode:'melee'},{knockedDown:true},{mounted:true},{stealthMode:true},{inventory:{burden:{item:'rations',count:100,weight:1}}}];
 for(const profile of profiles){const initial=arena({profile}),before=structuredClone(initial),ready=late(initial),actor=unit(ready.battle,'required');assert.equal(publicLateRearSearchEligible(ready.battle,actor,{reserveIds:['required']}),false);const current=recoveryPortSearchController(ready.battle,options(['required'])),action=current(ready.battle,actor);assert.ok(!['move','charge'].includes(action?.type),'no late search release for a held role; real hand/standing work may remain');assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(ready.battle))),ready.battle);assert.deepEqual(initial,before);}
});

test('actual charged gun contact keeps both finite crew bodies at the gun instead of releasing late search',()=>{
 const initial=arena({gun:true,extra:[{...personal,id:'crew',x:3,y:7}]}),copy=structuredClone(initial),ready=late(initial),ids=['required','crew'],gun=ready.battle.artillery[0],current=recoveryPortSearchController(ready.battle,options(ids)),prior=recoveryPortSearchController(ready.battle,oldOptions(ids));
 for(const id of ids){const actor=unit(ready.battle,id);assert.equal(artilleryContact(ready.battle,actor,gun),true);assert.equal(publicLateRearSearchEligible(ready.battle,actor,{reserveIds:ids}),false);assert.deepEqual(current(ready.battle,actor),prior(ready.battle,actor));}
 const window=openingControlWindow(ready.battle,{controller:current,sharedFallback:current.sharedFallback});assert.deepEqual(window.orders,[]);assert.deepEqual(window.battle,ready.battle);assert.deepEqual(ready.battle.artillery,initial.artillery);for(const id of ids)physical(initial,ready.battle,id);assert.deepEqual(initial,copy);
});

test('unseen opposing actor or gun cannot change the late public search; actual movement and replay remain authoritative',()=>{
 const clearInitial=arena({road:true}),clear=late(clearInitial),actor=unit(clear.battle,'required'),ids=['required'];
 for(const hiddenKind of ['actor','gun']){
  const initial=arena({road:true,hiddenKind}),copy=structuredClone(initial),ready=late(initial),unknown=hiddenKind==='gun'?ready.battle.artillery[0]:unit(ready.battle,'unknown');assert.equal(teamCanSee(ready.battle,'player',unknown),false);
  const expected=recoveryPortSearchController(clear.battle,options(ids))(clear.battle,actor),current=recoveryPortSearchController(ready.battle,options(ids)),action=current(ready.battle,unit(ready.battle,'required'));assert.deepEqual(action,expected);assert.equal(action?.type,'move');
  const after=replay(initial,[...ready.orders,action]);assert.equal(sameCell(unit(after,'required'),unknown),false);assert.ok(after.elapsedSeconds>ready.battle.elapsedSeconds);assert.ok(unit(after,'required').lastMovePath.length>0);physical(ready.battle,after,'required');assert.deepEqual(initial,copy);
 }
});

test('ordinary finite adjacent medicine reload and pan work stay ahead of formation search and replay their paid costs',()=>{
 for(const kind of ['medicine','reload','reprime']){
  const profile=kind==='medicine'?{medical:30,medkits:2,activeSlot:'medical',stance:'crouched'}:kind==='reload'?{loaded:0}:{jammed:true};
  const initial=arena({combat:true,profile,extra:kind==='medicine'?[{...personal,id:'patient',x:2,y:9,hp:45,maxHp:100,bleeding:3,medical:0,medkits:0,weapon:0,loaded:0,ammo:0}]:[]}),copy=structuredClone(initial),actor=unit(initial,'required'),ids=['required','patient'],current=recoveryPortSearchController(initial,options(ids)),prior=recoveryPortSearchController(initial,oldOptions(ids)),action=current(initial,actor);
  assert.deepEqual(action,prior(initial,actor));assert.equal(action?.type,kind==='medicine'?'useItem':kind);assert.equal(publicLateRearSearchEligible(initial,actor,{reserveIds:ids}),false);
  const quote=kind==='medicine'?medicalUsePreview(initial,actor,unit(initial,action.targetId)):kind==='reload'?reloadPlan(actor,initial):reprimePlan(actor,initial);assert.ok(!quote.reason,quote.reason);
  const after=replay(initial,[action]),body=unit(after,'required');assert.equal(body.ap,actor.ap-(kind==='medicine'?quote.cost:quote.pa));assert.ok(after.elapsedSeconds>initial.elapsedSeconds);assert.deepEqual(spacePoint(body),spacePoint(actor));assert.deepEqual(after.artillery,initial.artillery);
  if(kind==='medicine'){assert.equal(body.medkits,actor.medkits-1);assert.ok(unit(after,'patient').bleeding<unit(initial,'patient').bleeding);assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor));}
  else{assert.equal(body.medkits,actor.medkits);assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor));if(kind==='reload'){assert.equal(body.loaded,actor.loaded+quote.rounds);assert.equal(body.ammo,actor.ammo-quote.rounds);}else{assert.equal(body.jammed,false);assert.deepEqual(body.inventory,actor.inventory);}}
  assert.deepEqual(initial,copy);
 }
});


for(const kind of ['reload','reprime'])test('late no-contact reserve pays actual '+kind+' before public search after19 native waits',()=>{
 const initial=arena({profile:kind==='reload'?{loaded:0}:{jammed:true}}),input=structuredClone(initial),ready=late(initial),actor=unit(ready.battle,'required'),ids=['required'],current=recoveryPortSearchController(ready.battle,options(ids)),prior=recoveryPortSearchController(ready.battle,oldOptions(ids));
 assert.equal(publicLateRearSearchEligible(ready.battle,actor,{reserveIds:ids}),false);assert.equal(prior(ready.battle,actor),null,'the dated controller discarded search before consulting this finite work');
 const action=current(ready.battle,actor);assert.equal(action?.type,kind);const quote=kind==='reload'?reloadPlan(actor,ready.battle):reprimePlan(actor,ready.battle);assert.ok(!quote.reason,quote.reason);assert.ok(quote.pa>0);
 const after=replay(initial,[...ready.orders,action]),body=unit(after,'required');assert.equal(after.mode,'exploration');assert.equal(after.elapsedSeconds,ready.battle.elapsedSeconds+Math.max(1,Math.ceil(quote.pa*.06)));assert.equal(body.ap,actor.ap,'Native exploration work pays real seconds without combat AP debit');assert.deepEqual(spacePoint(body),spacePoint(actor));
 for(const key of ['hp','maxHp','bleeding','medkits','weapon','condition','assignment'])assert.deepEqual(body[key],actor[key],key);assert.deepEqual(after.artillery,ready.battle.artillery);assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor));
 if(kind==='reload'){assert.ok(quote.rounds>0);assert.equal(body.loaded,actor.loaded+quote.rounds);assert.equal(body.ammo,actor.ammo-quote.rounds);}else{assert.equal(body.jammed,false);assert.equal(body.loaded,actor.loaded);assert.equal(body.ammo,actor.ammo);assert.deepEqual(body.inventory,actor.inventory);}
 assert.equal(publicLateRearSearchEligible(after,body,{reserveIds:ids}),true);assert.equal(current(after,body)?.type,'move','public search becomes available only after its actual finite preparation');assert.deepEqual(initial,input);
});

test('late no-contact reserve prepares the medical hand and spends finite critical aid before choosing public search',()=>{
 const initial=arena({profile:{medical:30,medkits:2},extra:[{...personal,id:'patient',x:2,y:9,hp:14,maxHp:100,bleeding:0,medical:0,medkits:0,weapon:0,loaded:0,ammo:0,assignment:'patient'}]}),input=structuredClone(initial),ready=late(initial),ids=['required','patient'],current=recoveryPortSearchController(ready.battle,options(ids)),prior=recoveryPortSearchController(ready.battle,oldOptions(ids)),actor=unit(ready.battle,'required'),patient=unit(ready.battle,'patient');
 assert.equal(patient.hp,14);assert.equal(patient.bleeding,0);assert.equal(prior(ready.battle,actor),null);const hand=current(ready.battle,actor);assert.deepEqual(hand,{type:'weapon',unitId:actor.id,slot:'medical'});
 const handCost=actionCosts(ready.battle,actor).weapon,active=replay(initial,[...ready.orders,hand]),medic=unit(active,'required');assert.equal(active.elapsedSeconds,ready.battle.elapsedSeconds+Math.max(1,Math.ceil(handCost*.06)));assert.equal(medic.ap,actor.ap);assert.equal(medic.activeSlot,'medical');assert.deepEqual(unitAmmunitionByType(medic),unitAmmunitionByType(actor));assert.equal(medic.medkits,actor.medkits);
 const aid=current(active,medic);assert.deepEqual(aid,{type:'useItem',unitId:medic.id,targetId:patient.id});const quote=medicalUsePreview(active,medic,unit(active,'patient'));assert.equal(quote.allowed,true,quote.reason);assert.equal(quote.treatment.critical,true);assert.ok(quote.treatment.hpGain>0);assert.equal(quote.treatment.dressingsUsed,1);
 const healed=replay(initial,[...ready.orders,hand,aid]),body=unit(healed,'required'),treated=unit(healed,'patient');assert.equal(healed.elapsedSeconds,active.elapsedSeconds+Math.max(1,Math.ceil(quote.cost*.06)));assert.equal(body.ap,medic.ap);assert.equal(body.medkits,medic.medkits-quote.treatment.dressingsUsed);assert.equal(treated.hp,quote.treatment.hpAfter);assert.equal(treated.bleeding,quote.treatment.bleedingAfter);assert.equal(treated.hp,15,'only Native critical first aid restores the declared one-HP deficit');assert.deepEqual(spacePoint(body),spacePoint(actor));assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor));assert.deepEqual(healed.artillery,initial.artillery);
 const primary=current(healed,body);assert.deepEqual(primary,{type:'weapon',unitId:body.id,slot:'primary'});const prepared=replay(initial,[...ready.orders,hand,aid,primary]);assert.equal(unit(prepared,'required').activeSlot,'primary');assert.equal(unit(prepared,'required').medkits,actor.medkits-1);assert.equal(publicLateRearSearchEligible(prepared,unit(prepared,'required'),{reserveIds:ids}),true);assert.equal(current(prepared,unit(prepared,'required'))?.type,'move');assert.equal(current(prepared,unit(prepared,'patient')),null,'a stable clinical patient never joins the search');assert.deepEqual(initial,input);
});
