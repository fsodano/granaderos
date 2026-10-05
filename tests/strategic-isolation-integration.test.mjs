import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {actionCosts,shotChance,teamCanSee,createBattle} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
import {enterSector} from '../game/world.js';
import {ammoCount} from '../game/ammo-types.js';
import {contractQuote} from '../game/contracts.js';
import {strategicIsolationStatus} from '../game/strategic-isolation.js';
import {earnNervousIsolation,nervousActor,nervousSaved,nervousStep,nervousOrder} from './nervous-isolation-fixture.mjs';

const stamp=s=>s.hour*3600+(s.secondOfHour??0),rounds=u=>u.loaded+ammoCount(u);
const carriedRounds=(campaign,id)=>{const record=campaign.operativeState[id];return rounds({...rosterFor(campaign).find(op=>op.id===id),...record,loaded:record.carriedLoaded});};
function apply(pair,event){
 if(event.kind==='tactical')return nervousStep(pair,event.action);
 const action=event.kind==='settle'?{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:pair.battle.status,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')}:
  event.kind==='leave'?{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')}:event.action;
 const campaign=nervousOrder(pair.campaign,action);
 return nervousSaved({campaign,...(campaign.pendingBattle?{battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector])}:{})});
}
function earnedReturn(oldPinned){
 const fixture=earnNervousIsolation({oldPinned});let pair=fixture.pair;
 const events=fixture.history.map(action=>({kind:'tactical',action}));
 const perform=event=>{pair=apply(pair,event);events.push(structuredClone(event));};
 for(const action of [{type:'weapon',unitId:'130',slot:'primary'},{type:'reload',unitId:'130'},
  {type:'fire',unitId:'130',targetId:'enemy-0',aim:1},{type:'move',unitId:'130',x:6,y:0}])perform({kind:'tactical',action});
 const exit=pair.battle.exits.find(e=>e.destination==='retiro');perform({kind:'tactical',action:{type:'exit',unitIds:['130'],exitId:exit.id}});
 assert.equal(pair.battle.status,'retreat');perform({kind:'settle'});
 assert.equal(pair.campaign.operativeState[130].morale,43.7);assert.equal(pair.campaign.operativeState[130].hp,30);assert.equal(pair.campaign.operativeState[130].bleeding,0);
 assert.equal(pair.campaign.operativeState[110].captured,true);assert.equal(pair.campaign.resources.treasury,3104);
 return {...fixture,pair,events};
}

test('paid earned isolation persists through a clamped native shot, controlled accuracy probe and saved regroup/return/replay',t=>{
 const routes=[earnedReturn(false),earnedReturn(true)];
 const initial=routes.map(route=>structuredClone(route.start));
 const strategic=[];
 for(const route of routes){
  const perform=event=>{route.pair=apply(route.pair,event);route.events.push(structuredClone(event));};
  for(let i=0;i<3;i++)perform({kind:'campaign',action:{type:'wait',hours:1}});
  const record=route.pair.campaign.operativeState[130];
  assert.equal(record.morale,route.oldPinned?43.7:40.7);assert.equal(record.hp,30);assert.equal(record.bleeding,0);
  if(!route.oldPinned){assert.equal(record.strategicIsolation.loss,3);assert.equal(strategicIsolationStatus(route.pair.campaign,rosterFor(route.pair.campaign).find(o=>o.id===130)).active,true);}
  else assert.equal(record.strategicIsolation,undefined);
  const beforeHire=stamp(route.pair.campaign),quote=contractQuote(route.pair.campaign,rosterFor(route.pair.campaign).find(o=>o.id===100),'day');assert.equal(quote.price,36);
  perform({kind:'campaign',action:{type:'recruitCivic',id:100,term:'day'}});
  for(let i=0;i<6;i++){
   perform({kind:'campaign',action:{type:'wait',hours:1}});
   if(i===4&&!route.oldPinned)assert.equal(route.pair.campaign.operativeState[130].strategicIsolation.loss,8);
  }
  assert.equal(stamp(route.pair.campaign)-beforeHire,21600);assert.ok(route.pair.campaign.recruited.includes(100));
  const beforeRegroup=route.pair.campaign.operativeState[130].morale;assert.equal(beforeRegroup,route.oldPinned?43.7:35.7);
  assert.equal(route.pair.campaign.operativeState[130].strategicIsolation,undefined,'the actual arrival supplies support before that hour’s morale transition');
  perform({kind:'campaign',action:{type:'wait',hours:1}});assert.equal(route.pair.campaign.operativeState[130].strategicIsolation,undefined);assert.equal(route.pair.campaign.operativeState[130].morale,beforeRegroup);
  perform({kind:'campaign',action:{type:'renewContract',id:130,term:'day'}});assert.equal(route.pair.campaign.resources.treasury,3032);
  const personal=route.pair.campaign.operativeState[130].morale;assert.equal(personal,beforeRegroup+2);
  perform({kind:'campaign',action:{type:'attack',sector:'buenos_aires'}});
  assert.equal(route.pair.campaign.operativeState[130].morale,personal,'the actual traveling companion prevents further strategic losses');
  assert.equal(nervousActor(route.pair.battle,130).personalMorale,personal);assert.equal(nervousActor(route.pair.battle,130).shock,0,'ordinary deployment resets transient shock only');
  assert.equal(Object.hasOwn(nervousActor(route.pair.battle,130),'strategicIsolation'),false);
  perform({kind:'tactical',action:{type:'move',unitId:'100',x:17,y:0}});
  perform({kind:'tactical',action:{type:'move',unitId:'130',x:26,y:0}});
  if(nervousActor(route.pair.battle,130).loaded===0)perform({kind:'tactical',action:{type:'reload',unitId:'130'}});
  if(nervousActor(route.pair.battle,130).loaded===0){
   assert.ok(nervousActor(route.pair.battle,130).reloadProgress>0,'the exhausted turn retains its real partial reload');
   perform({kind:'tactical',action:{type:'move',unitId:'100',x:23,y:0}});
   perform({kind:'tactical',action:{type:'enemyTurn'}});
   assert.equal(nervousActor(route.pair.battle,130).shock,0,'paid nearby regroup prevents the tactical fear effect in both controls');
   perform({kind:'tactical',action:{type:'reload',unitId:'130'}});
   perform({kind:'tactical',action:{type:'move',unitId:'100',x:17,y:0}});
   perform({kind:'tactical',action:{type:'look',unitId:'100',x:14,y:3}});
   perform({kind:'tactical',action:{type:'move',unitId:'130',x:22,y:0}});
  }
  strategic.push({personal,beforeRegroup,stamp:stamp(route.pair.campaign)});
 }
 const candidates=routes[0].pair.battle.units.filter(u=>u.side==='enemy'&&u.hp>0&&teamCanSee(routes[0].pair.battle,'player',u));
 let selected;
 for(const target of candidates)for(let aim=0;aim<=4;aim++){
  const previews=routes.map(route=>targetPreview(route.pair.battle,nervousActor(route.pair.battle,130),nervousActor(route.pair.battle,target.id),{mode:'fire',aim}));
  if(previews.every(p=>p.valid)){selected={targetId:target.id,aim,previews};break;}
 }
 assert.ok(selected,'a real observed, loaded and affordable shot must remain available');
 assert.equal(selected.previews[0].chance,1);assert.equal(selected.previews[1].chance,1,'the real far native shot is clamped; it does not itself prove lower accuracy');
 // Pure geometric comparison only. Actual earned actor/observed target records
 // are copied into a declared three-cell flat lane; no paid route is changed or fired.
 const controlled=routes.map(route=>{
  const scene=createBattle([{...nervousActor(route.pair.battle,130),x:1,y:3,facing:2}],{width:12,height:8,night:false,seed:route.pair.battle.seed,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),props:[],enemies:[{...nervousActor(route.pair.battle,selected.targetId),x:4,y:3,facing:6}],npcs:[]});
  return shotChance(scene,scene.units[0],scene.units[1],4);
 });
 assert.ok(controlled[0]<controlled[1],`controlled forecast must show the retained morale difference: ${controlled}`);
 const shotReceipts=[];
 for(const route of routes){
  const perform=event=>{route.pair=apply(route.pair,event);route.events.push(structuredClone(event));};
  const before=structuredClone(route.pair),u=nervousActor(before.battle,130),target=nervousActor(before.battle,selected.targetId);
  assert.equal(teamCanSee(before.battle,'player',target),true);const chance=shotChance(before.battle,u,target,selected.aim);assert.equal(chance,selected.previews[route.oldPinned?1:0].chance);
  const costs=actionCosts(before.battle,u,target),pa=costs.fire+selected.aim*costs.aim;
  perform({kind:'tactical',action:{type:'fire',unitId:'130',targetId:selected.targetId,aim:selected.aim}});
  const after=nervousActor(route.pair.battle,130);assert.equal(after.ap,u.ap-pa);assert.equal(rounds(after),rounds(u)-1);assert.equal(after.condition,u.condition-1);assert.equal(after.hp,u.hp);assert.equal(after.medkits,u.medkits);
  shotReceipts.push({chance,pa,seedBefore:before.battle.seed,seedAfter:route.pair.battle.seed,roundsBefore:rounds(u),roundsAfter:rounds(after),seconds:route.pair.battle.elapsedSeconds-before.battle.elapsedSeconds});
  // The ordinary retreat preserves every actual participant and wound. No
  // clinical health, gear, seed or outcome is assigned after initial admission.
  const exit=route.pair.battle.exits.find(e=>e.destination==='retiro');perform({kind:'tactical',action:{type:'exit',unitIds:['130','100'],exitId:exit.id}});
  const report={type:'battleResult',battleId:route.pair.campaign.pendingBattle.id,outcome:route.pair.battle.status,sectorState:route.pair.battle,survivors:route.pair.battle.units.filter(u=>u.side==='player')};
  const returnedUnits=structuredClone(report.survivors);
  assert.equal(route.pair.battle.status,'retreat');perform({kind:'settle'});
  const stale=dispatchCampaign(route.pair.campaign,report);assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},route.pair.campaign);
  perform({kind:'campaign',action:{type:'visitSector'}});const reentryMorale=nervousActor(route.pair.battle,130).personalMorale;assert.equal(reentryMorale,route.pair.campaign.operativeState[130].morale);
  perform({kind:'leave'});assert.equal(route.pair.campaign.operativeState[130].morale,reentryMorale);
  let replay=initial[route.oldPinned?1:0];for(const event of route.events)replay=apply(replay,event);assert.deepEqual(replay,route.pair,'the full paid injury, capture, wait, hire, shot, return and reentry trace is official-save replayable');
  assert.equal(route.pair.campaign.resources.treasury,3032);assert.ok(route.pair.campaign.operativeState[110].captured);
  for(const id of [130,100]){
   const unit=returnedUnits.find(u=>u.id===String(id)),record=route.pair.campaign.operativeState[id];
   assert.equal(record.hp,unit.hp);assert.equal(record.bleeding,unit.bleeding);assert.equal(record.medkits,unit.medkits);assert.equal(carriedRounds(route.pair.campaign,id),rounds(unit));
  }
  assert.equal(carriedRounds(route.pair.campaign,130),6);
  assert.equal(carriedRounds(route.pair.campaign,100),10);
  assert.equal(route.pair.campaign.operativeState[110].capturedAmmunition.ammo,9);assert.equal(route.pair.campaign.operativeState[110].medkits,0);
  assert.equal(route.pair.campaign.contracts[130].expiresAt,54);assert.equal(route.pair.campaign.contracts[100].expiresAt,51);
 }
 assert.deepEqual(shotReceipts[0],shotReceipts[1],'the clamped paid shot preserves exact costs and random draws');
 t.diagnostic(JSON.stringify({scenario:'declared original pre-kinetic seed42 clinical screen; actual hostile wounds/miss/capture earn43.7 morale, not a stock campaign victory',controlledForecast:{context:'pure declared three-cell flat lane, not an executed native shot',chance:controlled},prices:[36,60,36,36],treasury:3032,strategic,shotReceipts,finalMorale:routes.map(route=>route.pair.campaign.operativeState[130].morale),orders:routes.map(route=>route.events.length),finalClock:routes.map(route=>({hour:route.pair.campaign.hour,second:route.pair.campaign.secondOfHour})),custody:[130,100,110].map(id=>({id,...Object.fromEntries(['hp','bleeding','medkits','carriedLoaded','carriedAmmo','captured'].map(key=>[key,routes[0].pair.campaign.operativeState[id][key]]))}))}));
});
