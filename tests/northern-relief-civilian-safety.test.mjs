import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,firearmShotOptions,getReachable,actionCosts,stanceCost,meleePreview,medicalUsePreview} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {knownRouteCivilianShotSafety} from './route-fire-safety.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {northernReliefDefenseController} from './northern-relief-defense.mjs';

const actor=b=>b.units.find(u=>u.id==='shooter');
const civilianRisk=(b,u,action)=>{
 const target=b.units.find(t=>t.id===action.targetId),risk=firearmBystanderRisk(b,u,target,action.hitLocation??'torso');
 return [...risk.direct,...risk.scatter].some(body=>body.kind==='npc');
};
function field({npcs=[],alternative=false,weapon=1802,front={},actor:changed={}}={}){
 return createBattle([{id:'shooter',x:1,y:4,weapon,loaded:1,ammo:8,stance:'prone',marksmanship:90,dexterity:90,agility:90,...changed}],{
  id:'declared-relief-civilian-safety',width:20,height:12,seed:45,
  tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'front',x:8,y:4,hp:100,stance:'standing',patrol:false,overwatch:false,...front},...(alternative?[{id:'other',x:14,y:0,hp:100,stance:'standing',patrol:false,overwatch:false}]:[])],npcs,
 });
}
const resident=(x,y,other={})=>({id:'resident',name:'Habitante',x,y,hp:100,maxHp:100,civilianHealthVersion:1,energy:100,unconscious:false,stance:'standing',...other});
function actual(b,action){
 const before=structuredClone(b),result=actBattle(b,action);assert.equal(result.lastError,null,JSON.stringify(action)+': '+result.lastError);
 assert.deepEqual(presentedActBattle(b,action).state,result);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result))),result);assert.deepEqual(b,before);return result;
}

test('a safe ordinary relief shot retains its exact aim and body order and pays Native ammunition and AP',()=>{
 const b=field(),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u),selected=northernReliefDefenseController([])(b,u);
 assert.equal(ordinary.type,'fire');assert.deepEqual(selected,ordinary);assert.equal(civilianRisk(b,u,selected),false);
 const result=actual(b,selected),costs=actionCosts(b,u,b.units.find(t=>t.id===selected.targetId));
 assert.equal(actor(result).loaded,u.loaded-1);assert.equal(actor(result).ammo,u.ammo);assert.equal(actor(result).ap,u.ap-costs.fire-selected.aim*costs.aim);assert.ok(result.elapsedSeconds>b.elapsedSeconds);assert.deepEqual(b,before);
});

test('an unsafe ordinary scatter shot selects a real safe affordable alternative target',()=>{
 const b=field({npcs:[resident(8,5)],alternative:true}),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u);
 assert.equal(ordinary.type,'fire');assert.equal(ordinary.targetId,'front');assert.equal(firearmBystanderRisk(b,u,b.units.find(t=>t.id==='front'),ordinary.hitLocation).direct.some(body=>body.kind==='npc'),false);assert.equal(civilianRisk(b,u,ordinary),true,'The rejected ordinary shot has an actual known miss-path risk although its central ray has no civilian impact.');
 const selected=northernReliefDefenseController([])(b,u);assert.equal(selected.type,'fire');assert.equal(selected.targetId,'other');assert.equal(civilianRisk(b,u,selected),false);
 const result=actual(b,selected);assert.equal(result.npcs[0].hp,b.npcs[0].hp);assert.equal(actor(result).loaded,u.loaded-1);assert.deepEqual(b,before);
});

test('when the current lane is unsafe a short real move can fund a safe next shot instead of parking the shooter',()=>{
 const b=field({front:{x:12},npcs:[resident(5,5)]}),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u);assert.equal(ordinary.type,'fire');assert.equal(civilianRisk(b,u,ordinary),true);
 const controller=northernReliefDefenseController([]),selected=controller(b,u);assert.equal(selected.type,'move');
 const quote=getReachable(b,u).find(p=>p.x===selected.x&&p.y===selected.y&&(p.tacticalLevel??0)===(selected.tacticalLevel??0));assert.ok(quote);assert.ok(quote.cost>0&&quote.cost<=24&&quote.path.length<=3);
 const moved=actual(b,selected);assert.equal(actor(moved).ap,u.ap-quote.cost);assert.ok(actor(moved).energy<u.energy);assert.equal(actor(moved).loaded,u.loaded);assert.equal(actor(moved).ammo,u.ammo);assert.equal(moved.npcs[0].hp,b.npcs[0].hp);
 const fire=controller(moved,actor(moved));assert.equal(fire.type,'fire');assert.equal(civilianRisk(moved,actor(moved),fire),false);const result=actual(moved,fire);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(before)));for(const action of [selected,fire])replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,action))));assert.deepEqual(replay,result);assert.deepEqual(b,before);
});

test('paired offhand and typed pellet paths retain their actual Native civilian risk',()=>{
 for(const config of [{weapon:1806,actor:{offHand:{weapon:1805,count:1,loaded:1,condition:100}}},{weapon:1807}]){
  const b=field({...config,npcs:[resident(8,5)]}),before=structuredClone(b),u=actor(b),target=b.units.find(t=>t.id==='front');
  const options=firearmShotOptions(b,u,target,0),option=options.find(o=>o.hitLocation==='torso'&&o.aim===0);assert.ok(option);
  assert.equal(civilianRisk(b,u,{type:'fire',targetId:target.id,aim:0,hitLocation:'torso'}),true);assert.equal(knownRouteCivilianShotSafety(b,u,target)(option),false);assert.deepEqual(b,before);
 }
});

test('hidden departed and dead civilians cannot alter a clear relief decision',()=>{
 const clear=field(),expected=northernReliefDefenseController([])(clear,actor(clear));assert.equal(expected.type,'fire');
 for(const npc of [resident(8,5,{roomId:'unrevealed'}),resident(8,5,{departure:{}}),resident(8,5,{hp:0})]){
  const b=field({npcs:[npc]}),before=structuredClone(b);assert.deepEqual(northernReliefDefenseController([])(b,actor(b)),expected);assert.deepEqual(b,before);
 }
});

test('an unrevealed interior occupant cannot redirect the new paid lane-clearing proposal',()=>{
 const clear=field({front:{x:12},npcs:[resident(5,5)]}),before=structuredClone(clear),expected=northernReliefDefenseController([])(clear,actor(clear));assert.equal(expected.type,'move');
 const hidden=field({front:{x:12},npcs:[resident(5,5),resident(expected.x,expected.y,{id:'private-resident',roomId:'unrevealed'})]}),hiddenBefore=structuredClone(hidden);
 assert.deepEqual(northernReliefDefenseController([])(hidden,actor(hidden)),expected);assert.deepEqual(clear,before);assert.deepEqual(hidden,hiddenBefore);
});

test('held physicians keep actual finite aid and empty reserves keep their ordinary paid prone hold',()=>{
 const wounded=field({actor:{hp:60,maxHp:80,bleeding:1,medical:80,medkits:1,activeSlot:'medical'}}),before=structuredClone(wounded),u=actor(wounded),ordinary=cautiousCombatOrder(wounded,u),selected=northernReliefDefenseController(['shooter'])(wounded,u);
 assert.deepEqual(selected,ordinary);assert.equal(selected.type,'useItem');const treated=actual(wounded,selected);assert.equal(actor(treated).medkits,u.medkits-1);assert.ok(actor(treated).bleeding<u.bleeding);assert.deepEqual(wounded,before);
 const empty=field({actor:{loaded:0,ammo:0,stance:'standing'}}),held=northernReliefDefenseController([])(empty,actor(empty));assert.equal(held.type,'stance');assert.equal(held.stance,'prone');const lowered=actual(empty,held);assert.equal(northernReliefDefenseController([])(lowered,actor(lowered)),null);
});

test('a current movement remains unchanged and insufficient remaining AP cannot buy a replacement shot',()=>{
 const moving=field({npcs:[resident(4,4)]}),before=structuredClone(moving),ordinary=cautiousCombatOrder(moving,actor(moving)),selected=northernReliefDefenseController([])(moving,actor(moving));
 assert.equal(ordinary.type,'move');assert.deepEqual(selected,ordinary);actual(moving,selected);assert.deepEqual(moving,before);
 const blocked=field({front:{x:12},npcs:[resident(5,5)],actor:{hp:39,maxHp:100,bandaged:0,energy:10,fatigue:100,medical:0,medkits:0}}),heldBefore=structuredClone(blocked),proposed=cautiousCombatOrder(blocked,actor(blocked));
 assert.equal(actor(blocked).ap,actionCosts(blocked,actor(blocked),blocked.units.find(u=>u.id==='front')).fire,'Native wounds and fatigue leave exactly the actual shot cost, without an AP assignment.');
 assert.equal(proposed.type,'fire');assert.equal(proposed.aim,0);assert.equal(civilianRisk(blocked,actor(blocked),proposed),true);
 assert.equal(northernReliefDefenseController([])(blocked,actor(blocked)),null);assert.deepEqual(blocked,heldBefore,'A refused lane grants no AP, movement, shot or clock.');
});

// Independent local-care declarations. The old relief controls above retain
// their default controller, factory and complete bodies byte for byte.
import {endTurn,presentedEndTurn,artilleryContact,artilleryCrewPlan,artilleryCosts,artilleryReloadPreview} from '../game/tactical.js';
import {knownRouteBystanderShotSafety} from './route-fire-safety.mjs';

function localCareFriendlyField(){
 return createBattle([
  {id:'shooter',x:1,y:4,weapon:1802,condition:100,loaded:1,ammo:8,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:'prone',marksmanship:90,dexterity:90,agility:90,facing:2,energy:100,morale:90},
  {id:'friendly-post',x:8,y:5,weapon:0,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:'standing',facing:2,energy:100,morale:90},
 ],{id:'declared-local-care-friendly-scatter',width:20,height:12,hour:12,seed:45,
  tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'front',x:8,y:4,hp:100,maxHp:100,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false},
   {id:'other',x:14,y:0,hp:100,maxHp:100,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
 });
}

function localCareBatteryField(){
 const width=30,height=14;
 return createBattle([
  {id:'crew1',x:2,y:5,weapon:1800,condition:100,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,energy:100,morale:90,agility:90,dexterity:90,explosives:50},
  {id:'crew2',x:2,y:6,weapon:1800,condition:100,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,energy:100,morale:90,agility:90,dexterity:90,explosives:50},
  {id:'physician',x:8,y:4,weapon:1800,condition:100,blade:0,loaded:1,ammo:2,hp:100,maxHp:100,bandaged:0,medical:80,medkits:1,stance:'prone',movementMode:'prone',facing:2,energy:100,morale:90},
 ],{id:'declared-local-care-distant-finite-crew',width,height,hour:12,seed:45,
  // A real clear ground lane. The target retains ordinary Native movement;
  // no impassable water ring is also allowed to stop the cannon's solid ray.
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:24,y:5,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
  artillery:[{id:'finite-local-gun',type:'bronze4',side:'player',x:9,y:5,facing:0,loaded:true,ammo:1}],
 });
}
const localMember=(battle,id)=>battle.units.find(unit=>unit.id===id);
function localCareStep(battle,action){
 if(action.type!=='endTurn')return actual(battle,action);
 const before=structuredClone(battle),after=endTurn(battle);assert.equal(after.lastError,null);
 assert.deepEqual(presentedEndTurn(battle).state,after);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(after))),after);assert.deepEqual(battle,before);return after;
}
function localCareReplay(start,orders,physicianIds=[]){
 let battle=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 const policy=northernReliefDefenseController(physicianIds,{localCareBattle:battle});
 for(const action of orders){
  if(action.type!=='endTurn')assert.deepEqual(policy(battle,localMember(battle,action.unitId)),action);
  battle=validateBattleSnapshot(JSON.parse(JSON.stringify(localCareStep(battle,action))));
 }
 return battle;
}

test('only local care rejects a known friendly miss path and pays a real safe alternative rifle shot',()=>{
 const start=localCareFriendlyField(),before=structuredClone(start),unit=actor(start),ordinary=cautiousCombatOrder(start,unit),defaultPolicy=northernReliefDefenseController([]);
 assert.equal(ordinary?.type,'fire');assert.equal(ordinary.targetId,'front');assert.deepEqual(defaultPolicy(start,unit),ordinary);
 const target=localMember(start,ordinary.targetId),risk=firearmBystanderRisk(start,unit,target,ordinary.hitLocation??'torso');
 assert.equal(risk.direct.length,0);assert.ok(risk.scatter.some(body=>body.id==='friendly-post'||body.unitId==='friendly-post'),'The actual ordinary shot has a known friendly miss-path body.');
 const ordinaryQuote=firearmShotOptions(start,unit,target,ordinary.aim??0).find(option=>option.aim===(ordinary.aim??0)&&option.hitLocation===(ordinary.hitLocation??'torso'));
 assert.equal(knownRouteCivilianShotSafety(start,unit,target)(ordinaryQuote),true);assert.equal(knownRouteBystanderShotSafety(start,unit,target)(ordinaryQuote),false);
 const policy=northernReliefDefenseController([],{localCareBattle:start}),action=policy(start,unit);assert.equal(action?.type,'fire');assert.equal(action.targetId,'other');
 const selectedTarget=localMember(start,action.targetId),quote=firearmShotOptions(start,unit,selectedTarget,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
 assert.equal(knownRouteBystanderShotSafety(start,unit,selectedTarget)(quote),true);const cost=actionCosts(start,unit,selectedTarget),after=localCareStep(start,action);
 assert.equal(actor(after).ap,unit.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(actor(after).loaded,unit.loaded-1);assert.equal(actor(after).ammo,unit.ammo);assert.equal(localMember(after,'friendly-post').hp,localMember(start,'friendly-post').hp);
 assert.deepEqual(localCareReplay(start,[action]),after);assert.deepEqual(start,before);
});

test('local dry riflemen pay bounded tactical approaches and a valid nonclinical crew spends only its two real cannon charges',()=>{
 const start=localCareBatteryField(),before=structuredClone(start),policy=northernReliefDefenseController(['physician'],{localCareBattle:start}),ids=['crew1','crew2'];
 assert.equal(policy(start,localMember(start,'physician')),null);
 for(const id of ids){const unit=localMember(start,id);assert.ok(Math.hypot(unit.x-start.artillery[0].x,unit.y-start.artillery[0].y)>6);assert.equal(artilleryContact(start,unit,start.artillery[0]),false);assert.equal(unit.loaded+unit.ammo,0);assert.deepEqual(northernReliefDefenseController(['physician'])(start,unit),{type:'stance',unitId:id,stance:'prone'});}
 let battle=start,moves=0,fires=0,reloads=0;const orders=[],pieceShift={x:0,y:0};
 for(let round=0;round<8&&fires<2;round++){
  for(let pass=0;pass<8&&fires<2;pass++){
   let progress=false;
   for(const id of ids){
    const unit=localMember(battle,id),action=policy(battle,unit);if(!action)continue;
    assert.ok(['move','stance','artillery','artilleryPivot','artilleryMove','artilleryReload'].includes(action.type),JSON.stringify(action));
    let route,crew,pa;
    if(action.type==='move'){
     route=getReachable(battle,unit).find(point=>point.x===action.x&&point.y===action.y&&(point.tacticalLevel??0)===(action.tacticalLevel??0));assert.ok(route);assert.ok(route.cost>0&&route.cost<=24&&route.path.length<=3);assert.ok(route.path.every(point=>(point.tacticalLevel??0)===0&&(!point.kind||point.kind==='move')));assert.ok(!route.path.some(point=>point.x===localMember(battle,'physician').x&&point.y===localMember(battle,'physician').y));
    }
    if(['artillery','artilleryPivot','artilleryMove','artilleryReload'].includes(action.type)){
     const gun=battle.artillery.find(piece=>piece.id===action.artilleryId);
     const plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,gun):artilleryCrewPlan(battle,unit,gun,artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':action.type==='artilleryMove'?'move':'pivot']);
     assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),ids);for(const memberId of plan.crew){const member=localMember(battle,memberId);assert.ok(member.medical<60);assert.equal(member.loaded+member.ammo,0);assert.equal(artilleryContact(battle,member,gun),true);}
     crew=plan.crew;pa=action.type==='artilleryReload'?plan.pa:artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':action.type==='artilleryMove'?'move':'pivot'];
    }
    const after=localCareStep(battle,action);
    if(route){assert.equal(localMember(after,id).ap,unit.ap-route.cost);assert.ok(localMember(after,id).energy<unit.energy);moves++;}
    if(crew)for(const memberId of crew)assert.equal(localMember(after,memberId).ap,localMember(battle,memberId).ap-pa);
    if(action.type==='artilleryMove'){
     const old=battle.artillery[0],moved=after.artillery[0],dx=action.x-old.x,dy=action.y-old.y;assert.equal(Math.abs(dx)+Math.abs(dy),1);assert.deepEqual([moved.x,moved.y],[action.x,action.y]);
     for(const memberId of crew)assert.deepEqual([localMember(after,memberId).x,localMember(after,memberId).y],[localMember(battle,memberId).x+dx,localMember(battle,memberId).y+dy]);
     for(const member of battle.units.filter(other=>other.side==='player'&&!crew.includes(other.id)))assert.deepEqual([localMember(after,member.id).x,localMember(after,member.id).y],[member.x,member.y]);
     assert.equal(moved.loaded,old.loaded);assert.equal(moved.ammo,old.ammo);pieceShift.x+=dx;pieceShift.y+=dy;
    }
    if(action.type==='artillery'){assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,battle.artillery[0].ammo);fires++;}
    if(action.type==='artilleryReload'){assert.equal(after.artillery[0].ammo,battle.artillery[0].ammo-(Number(after.artillery[0].loaded)-Number(battle.artillery[0].loaded)));reloads++;}
    orders.push(action);battle=after;progress=true;if(fires===2)break;
   }
   if(!progress)break;
  }
  if(fires<2){assert.equal(battle.status,'active');const action={type:'endTurn'};battle=localCareStep(battle,action);orders.push(action);}
 }
 assert.ok(moves>=2);assert.equal(fires,2);assert.ok(reloads>0);assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,0);assert.deepEqual([battle.artillery[0].x,battle.artillery[0].y],[start.artillery[0].x+pieceShift.x,start.artillery[0].y+pieceShift.y]);
 for(const id of ids)for(const key of ['weapon','loaded','ammo','medkits','hp','maxHp','bleeding','inventory'])assert.deepEqual(localMember(battle,id)[key],localMember(start,id)[key]);
 for(const key of ['x','y','hp','maxHp','bleeding','medkits','loaded','ammo','stance','inventory'])assert.deepEqual(localMember(battle,'physician')[key],localMember(start,'physician')[key]);
 assert.equal(policy.sharedFallback(battle,localMember(battle,'physician')),null);assert.deepEqual(localCareReplay(start,orders,['physician']),battle);assert.deepEqual(start,before);
});

test('local battery selection cannot replace a missing nonclinical helper with the actual Native physician or qualified clinical body',()=>{
 for(const qualified of [false,true]){
  const start=createBattle([
   {id:'operator',x:5,y:5,hp:80,maxHp:80,bandaged:0,weapon:1805,loaded:1,ammo:9,medical:0,medkits:0,marksmanship:1,stance:'standing',movementMode:'walk',facing:2,energy:100,morale:90},
   {id:'clinical',x:5,y:6,hp:80,maxHp:80,bandaged:0,weapon:1805,loaded:1,ammo:9,medical:qualified?80:36,medkits:1,marksmanship:1,stance:'standing',movementMode:'walk',facing:2,energy:100,morale:90},
  ],{id:'declared-local-care-clinical-crew-refusal',width:24,height:14,hour:12,seed:45,tiles:Array.from({length:336},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
   enemies:[{id:'target',x:20,y:5,hp:300,maxHp:300,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],artillery:[{id:'clinical-adjacent-gun',type:'bronze4',side:'player',x:6,y:5,facing:0,loaded:true,ammo:1}],
  }),before=structuredClone(start),unit=localMember(start,'operator'),gun=start.artillery[0],plan=artilleryCrewPlan(start,unit,gun,artilleryCosts(start,unit,gun).fire),policy=northernReliefDefenseController(qualified?[]:['clinical'],{localCareBattle:start});
  assert.equal(plan.reason,null);assert.deepEqual(plan.crew,['operator','clinical']);assert.equal(cautiousCombatOrder(start,unit)?.type,'artillery');assert.equal(policy(start,unit),null);assert.deepEqual(start.artillery,before.artillery);assert.deepEqual(start,before);
 }
});

import {usefulRouteRifleShot,publicRouteView} from './route-infantry-progress.mjs';

function localCarePriorityField({entry=false,empty=false,movement=false,noncontact=false}={}){
 const x=movement?1:empty||noncontact?2:5,gunX=movement?10:empty||noncontact?9:6;
 return createBattle([
  {id:'priority',x,y:movement?4:5,weapon:empty?1805:1802,condition:100,blade:0,loaded:empty?0:1,ammo:5,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:empty?'crouched':'prone',facing:2,marksmanship:90,agility:90,dexterity:90,energy:100,morale:90},
  {id:'helper',x:movement?2:x,y:movement?5:6,weapon:0,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,bandaged:0,medical:0,medkits:0,stance:'standing',facing:2,energy:100,morale:90},
 ],{id:'declared-local-care-ordinary-priority',width:24,height:14,hour:12,seed:45,exploration:entry,deferContact:entry,
  tiles:Array.from({length:336},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
  npcs:movement?[resident(4,4)]:[],
  enemies:[{id:'target',x:movement?8:18,y:movement?4:5,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
  artillery:[{id:'priority-gun',type:'bronze4',side:'player',x:gunX,y:movement?8:5,facing:0,loaded:true,ammo:1}],
 });
}

test('local care retains actual cautious entry, then safe useful rifle fire and finite maintenance before battery movement',()=>{
 for(const options of [{entry:true},{},{empty:true},{noncontact:true},{movement:true}]){
  const start=localCarePriorityField(options),before=structuredClone(start),unit=localMember(start,'priority'),ordinary=cautiousCombatOrder(start,unit),policy=northernReliefDefenseController([],{localCareBattle:start}),action=policy(start,unit);
  assert.equal(start.mode,options.entry?'exploration':'combat');assert.equal(start.phase,'player');
  if(options.entry){assert.ok(ordinary);assert.deepEqual(action,ordinary,'No coastal proposal may replace the original cautious exploration/contact order.');assert.equal(action.type,'stance');}
  else if(options.empty){assert.equal(ordinary?.type,'reload');assert.deepEqual(action,ordinary,'Real finite rifle maintenance stays before the optional crew approach.');}
  else if(options.movement){assert.equal(ordinary?.type,'move');assert.deepEqual(action,ordinary,'Current admitted cautious movement stays before a different paid crew route.');}
  else if(options.noncontact){
   assert.ok(usefulRouteRifleShot(publicRouteView(start,unit),unit,{shotSafety:knownRouteBystanderShotSafety}));assert.equal(action?.type,'fire');
   const target=localMember(start,action.targetId),quote=firearmShotOptions(start,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
   assert.ok(quote.chance>=25&&quote.damageFactor>0);assert.equal(knownRouteBystanderShotSafety(start,unit,target)(quote),true);
  }else{assert.equal(ordinary?.type,'stance');assert.equal(ordinary.stance,'crouched');assert.deepEqual(action,ordinary,'An admitted actual cautious posture stays before optional battery work.');}
  const after=localCareStep(start,action);assert.deepEqual(after.artillery,start.artillery);
  if(action.type==='move'){const quote=getReachable(start,unit).find(point=>point.x===action.x&&point.y===action.y);assert.ok(quote&&quote.cost>0);assert.equal(localMember(after,'priority').ap,unit.ap-quote.cost);assert.deepEqual([localMember(after,'priority').x,localMember(after,'priority').y],[action.x,action.y]);}
  else assert.deepEqual([localMember(after,'priority').x,localMember(after,'priority').y],[unit.x,unit.y]);
  if(action.type==='fire'){const cost=actionCosts(start,unit,localMember(start,action.targetId));assert.equal(localMember(after,'priority').ap,unit.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(localMember(after,'priority').loaded,unit.loaded-1);assert.equal(localMember(after,'priority').ammo,unit.ammo);}
  if(action.type==='reload'){assert.equal(localMember(after,'priority').loaded,1);assert.equal(localMember(after,'priority').ammo,unit.ammo-1);assert.ok(localMember(after,'priority').ap<unit.ap);}
  assert.deepEqual(localCareReplay(start,[action]),after);assert.deepEqual(start,before);
 }
});

// Separate loaded-crew declarations. Existing dry-crew and ordinary-priority
// fixtures remain exact; no current load, wound, AP or position is assigned.
function loadedLocalCareSetupField({aid=false,close=false,outsider=false}={}){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:90,dexterity:90,strength:80,marksmanship:0,medical:0,medkits:0,weapon:1800,blade:0,condition:100,loaded:1,ammo:5,stance:'standing',movementMode:'walk',activeSlot:'primary',facing:2,patrol:false,overwatch:false};
 const players=[{...base,id:'crew1',x:close?5:2,y:5,stance:close?'crouched':'prone',movementMode:close?'crouch':'prone',...(close?{blade:1813,activeSlot:'blade',facing:6}:{}),...(aid?{medical:20,medkits:1,hp:60,bleeding:1,activeSlot:'medical'}:{})},
  {...base,id:'crew2',x:close?5:2,y:6},
  {...base,id:'physician',x:8,y:4,medical:80,medkits:1,ammo:2,stance:'prone',movementMode:'prone'}];
 if(outsider)players.push({...base,id:'outside-crew',x:1,y:12,marksmanship:80});
 const options={id:'declared-loaded-local-battery-priority',width:32,height:14,hour:12,seed:45,exploration:false,
  tiles:Array.from({length:448},(_,n)=>({x:n%32,y:Math.floor(n/32),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:close?4:24,y:5,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
  artillery:[{id:'loaded-force-finite-gun',type:'bronze4',side:'player',x:close?6:9,y:5,facing:0,loaded:true,ammo:1}]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function prioritizedLocalCareReplay(start,orders,physicianIds=[]){
 let battle=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));const policy=northernReliefDefenseController(physicianIds,{localCareBattle:battle,prioritizeLocalBattery:true});
 for(const action of orders){if(action.type!=='endTurn')assert.deepEqual(policy(battle,localMember(battle,action.unitId)),action);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(localCareStep(battle,action))));}return battle;
}

test('the caller-only missing-crew priority pays real battery setup instead of an unrelated loaded-rifle movement',()=>{
 const start=localCarePriorityField({movement:true}),before=structuredClone(start),unit=localMember(start,'priority'),ordinary=cautiousCombatOrder(start,unit),old=northernReliefDefenseController([],{localCareBattle:start}),policy=northernReliefDefenseController([],{localCareBattle:start,prioritizeLocalBattery:true});
 assert.equal(unit.loaded,1);assert.equal(artilleryContact(start,unit,start.artillery[0]),false);assert.equal(ordinary.type,'move');assert.deepEqual(old(start,unit),ordinary);
 const action=policy(start,unit);assert.ok(action&&['move','stance'].includes(action.type));assert.notDeepEqual(action,ordinary);const after=localCareStep(start,action);
 if(action.type==='move'){const route=getReachable(start,unit).find(point=>point.x===action.x&&point.y===action.y);assert.ok(route.cost>0&&route.cost<=24&&route.path.length<=3);assert.equal(localMember(after,unit.id).ap,unit.ap-route.cost);}else assert.equal(localMember(after,unit.id).ap,unit.ap-stanceCost(unit,action.stance));
 assert.deepEqual(prioritizedLocalCareReplay(start,[action]),after);assert.equal(localMember(after,unit.id).loaded,unit.loaded);assert.equal(localMember(after,unit.id).ammo,unit.ammo);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('loaded local riflemen assemble through paid paths and spend two finite cannon charges before optional personal reloads',()=>{
 const start=loadedLocalCareSetupField(),before=structuredClone(start),ids=['crew1','crew2'],policy=northernReliefDefenseController(['physician'],{localCareBattle:start,prioritizeLocalBattery:true}),orders=[];let battle=start,moves=0,fires=0,reloads=0;
 for(const id of ids){const unit=localMember(start,id);assert.equal(unit.loaded,1);assert.equal(unit.ammo,5);assert.equal(artilleryContact(start,unit,start.artillery[0]),false);}
 for(let round=0;round<8&&fires<2;round++){
  for(let pass=0;pass<8&&fires<2;pass++){
   let progress=false;
   for(const id of ids){
    const unit=localMember(battle,id),action=policy(battle,unit);if(!action)continue;assert.ok(['move','stance','artillery','artilleryPivot','artilleryMove','artilleryReload'].includes(action.type),JSON.stringify(action));let route,crew,pa;
    if(action.type==='move'){route=getReachable(battle,unit).find(point=>point.x===action.x&&point.y===action.y&&(point.tacticalLevel??0)===(action.tacticalLevel??0));assert.ok(route&&route.cost>0&&route.cost<=24&&route.path.length<=3);assert.ok(route.path.every(point=>(point.tacticalLevel??0)===0&&(!point.kind||point.kind==='move')));}
    if(['artillery','artilleryPivot','artilleryMove','artilleryReload'].includes(action.type)){
     const gun=battle.artillery.find(piece=>piece.id===action.artilleryId),kind={artillery:'fire',artilleryPivot:'pivot',artilleryMove:'move'}[action.type],plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,gun):artilleryCrewPlan(battle,unit,gun,artilleryCosts(battle,unit,gun)[kind]);assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),ids);for(const memberId of plan.crew){assert.ok(localMember(battle,memberId).medical<60);assert.equal(artilleryContact(battle,localMember(battle,memberId),gun),true);}crew=plan.crew;pa=action.type==='artilleryReload'?plan.pa:artilleryCosts(battle,unit,gun)[kind];
    }
    const after=localCareStep(battle,action);
    if(route){assert.equal(localMember(after,id).ap,unit.ap-route.cost);assert.ok(localMember(after,id).energy<unit.energy);moves++;}
    if(action.type==='stance')assert.equal(localMember(after,id).ap,unit.ap-stanceCost(unit,action.stance));
    if(crew)for(const memberId of crew)assert.equal(localMember(after,memberId).ap,localMember(battle,memberId).ap-pa);
    if(action.type==='artillery'){assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,battle.artillery[0].ammo);fires++;}
    if(action.type==='artilleryReload'){assert.equal(after.artillery[0].ammo,battle.artillery[0].ammo-(Number(after.artillery[0].loaded)-Number(battle.artillery[0].loaded)));reloads++;}
    if(action.type==='artilleryMove'){const gun=battle.artillery[0],moved=after.artillery[0],dx=moved.x-gun.x,dy=moved.y-gun.y;assert.equal(Math.abs(dx)+Math.abs(dy),1);for(const memberId of crew)assert.deepEqual([localMember(after,memberId).x,localMember(after,memberId).y],[localMember(battle,memberId).x+dx,localMember(battle,memberId).y+dy]);}
    for(const memberId of ids)for(const key of ['weapon','loaded','ammo','medkits','hp','maxHp','bleeding','inventory'])assert.deepEqual(localMember(after,memberId)[key],localMember(start,memberId)[key]);
    orders.push(action);battle=after;progress=true;if(fires===2)break;
   }
   if(!progress)break;
  }
  if(fires<2){assert.equal(battle.status,'active');const action={type:'endTurn'};battle=localCareStep(battle,action);orders.push(action);}
 }
 assert.ok(moves>=2);assert.equal(fires,2);assert.ok(reloads>0);assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,0);assert.ok(!orders.some(action=>['fire','reload','reprime'].includes(action.type)));
 for(const key of ['x','y','hp','maxHp','bleeding','medkits','loaded','ammo','stance','inventory'])assert.deepEqual(localMember(battle,'physician')[key],localMember(start,'physician')[key]);
 assert.deepEqual(prioritizedLocalCareReplay(start,orders,['physician']),battle);assert.deepEqual(start,before);
});

test('missing-crew setup priority retains finite care, close Native melee, exploration and nonassigned ordinary work',()=>{
 const aid=loadedLocalCareSetupField({aid:true}),aidBefore=structuredClone(aid),doctor=localMember(aid,'crew1'),policy=northernReliefDefenseController(['physician'],{localCareBattle:aid,prioritizeLocalBattery:true}),quote=medicalUsePreview(aid,doctor,doctor),action=policy(aid,doctor);assert.equal(quote.allowed,true);assert.deepEqual(action,{type:'useItem',unitId:doctor.id,targetId:doctor.id});const treated=localCareStep(aid,action);assert.equal(localMember(treated,doctor.id).medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(localMember(treated,doctor.id).bleeding,0);assert.equal(localMember(treated,doctor.id).ap,doctor.ap-quote.cost);assert.deepEqual(prioritizedLocalCareReplay(aid,[action],['physician']),treated);assert.deepEqual(aid,aidBefore);
 const close=loadedLocalCareSetupField({close:true}),closeBefore=structuredClone(close),fighter=localMember(close,'crew1'),ordinary=cautiousCombatOrder(close,fighter),defense=northernReliefDefenseController(['physician'],{localCareBattle:close,prioritizeLocalBattery:true})(close,fighter);assert.equal(ordinary?.type,'melee');assert.deepEqual(defense,ordinary);const target=localMember(close,defense.targetId),strike=meleePreview(close,fighter,target);assert.equal(strike.valid,true,strike.reason);assert.equal(strike.movePa,0);const fought=localCareStep(close,defense);assert.equal(localMember(fought,fighter.id).ap,fighter.ap-strike.pa);assert.deepEqual(fought.artillery,close.artillery);assert.deepEqual(prioritizedLocalCareReplay(close,[defense],['physician']),fought);assert.deepEqual(close,closeBefore);
 const entry=localCarePriorityField({entry:true}),entryBefore=structuredClone(entry),entrant=localMember(entry,'priority'),normal=cautiousCombatOrder(entry,entrant),entryPolicy=northernReliefDefenseController([],{localCareBattle:entry,prioritizeLocalBattery:true});assert.equal(entry.mode,'exploration');assert.deepEqual(entryPolicy(entry,entrant),normal);assert.deepEqual(entry,entryBefore);
 const other=loadedLocalCareSetupField({outsider:true}),otherBefore=structuredClone(other),outside=localMember(other,'outside-crew'),defaultPolicy=northernReliefDefenseController(['physician'],{localCareBattle:other}),priorityPolicy=northernReliefDefenseController(['physician'],{localCareBattle:other,prioritizeLocalBattery:true});assert.deepEqual(priorityPolicy(other,outside),defaultPolicy(other,outside));assert.deepEqual(priorityPolicy(other,localMember(other,'physician')),defaultPolicy(other,localMember(other,'physician')));assert.deepEqual(other,otherBefore);
});


// Fresh contact/approach declarations for the local-care-only setup priority.
// The old15 cases and their helpers above remain an exact byte prefix.
import {coastalBatteryController} from './coastal-command-driver.mjs';

function localBatteryContactField({atGun=false,clear=false,clinical=false}={}){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:90,dexterity:90,strength:80,marksmanship:90,medical:0,medkits:0,weapon:1802,blade:0,condition:100,loaded:1,ammo:8,stance:'crouched',movementMode:'crouch',activeSlot:'primary',facing:2,patrol:false,overwatch:false};
 const players=[{...base,id:'shooter',x:1,y:4},
  {...base,id:'crew-leader',x:atGun?(clear?2:8):9,y:atGun?(clear?5:8):5,weapon:0,loaded:0,ammo:0,stance:'standing',movementMode:'walk'},
  {...base,id:'field-physician',x:clinical?2:8,y:clinical?5:10,medical:80,medkits:1,weapon:0,loaded:0,ammo:0,stance:clinical?'standing':'prone',movementMode:clinical?'walk':'prone'}];
 const options={id:'declared-local-battery-contact-hold',width:32,height:14,hour:12,seed:45,exploration:false,
  tiles:Array.from({length:448},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'front',x:clear?14:12,y:4,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
  npcs:clear?[]:[resident(5,5)],artillery:[{id:'contact-gun',type:'bronze4',side:'player',x:atGun?2:9,y:4,facing:0,loaded:true,ammo:1}]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
const localSetupPolicy=start=>northernReliefDefenseController(['field-physician'],{localCareBattle:start,prioritizeLocalBattery:true});
const localSetupCoordinator=(start,priority=false)=>coastalBatteryController(start,{sharedArtillerySight:true,crewEligible:unit=>unit.id!=='field-physician'&&unit.medical<60,crewOnly:true,prioritizeCrewApproach:priority});

function contactSetupReplay(start,orders){
 let battle=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));const policy=localSetupPolicy(battle);
 for(const action of orders){if(action.type!=='endTurn')assert.deepEqual(policy(battle,localMember(battle,action.unitId)),action);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(localCareStep(battle,action))));}return battle;
}

test('local setup makes an incomplete loaded rifle crew pay its actual approach before a distant personal shot',()=>{
 const start=localBatteryContactField(),before=structuredClone(start),unit=actor(start),gun=start.artillery[0],old=localSetupCoordinator(start),coordinated=old(start,unit);
 assert.equal(artilleryContact(start,unit,gun),false);assert.ok(artilleryCrewPlan(start,unit,gun,0).reason);assert.equal(coordinated?.type,'fire');
 const target=localMember(start,coordinated.targetId),quote=firearmShotOptions(start,unit,target,coordinated.aim??0).find(option=>option.aim===(coordinated.aim??0)&&option.hitLocation===(coordinated.hitLocation??'torso'));
 assert.equal(knownRouteBystanderShotSafety(start,unit,target)(quote),false,'The optional personal shot has the declared real known scatter body.');
 const policy=localSetupPolicy(start),selected=policy(start,unit);assert.equal(selected?.type,'move');assert.deepEqual(selected,localSetupCoordinator(start,true)(start,unit));
 const route=getReachable(start,unit).find(point=>point.x===selected.x&&point.y===selected.y&&(point.tacticalLevel??0)===(selected.tacticalLevel??0));assert.ok(route&&route.cost>0&&route.cost<=24&&route.path.length<=3);assert.ok(Math.hypot(selected.x-gun.x,selected.y-gun.y)<Math.hypot(unit.x-gun.x,unit.y-gun.y));
 const moved=localCareStep(start,selected);assert.equal(actor(moved).ap,unit.ap-route.cost);assert.ok(actor(moved).energy<unit.energy);assert.ok(moved.elapsedSeconds>start.elapsedSeconds);
 for(const key of ['hp','maxHp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(actor(moved)[key],unit[key]);assert.deepEqual(moved.artillery,start.artillery);assert.deepEqual(moved.npcs,start.npcs);assert.deepEqual(localMember(moved,'field-physician'),localMember(start,'field-physician'));
 assert.deepEqual(contactSetupReplay(start,[selected]),moved);assert.deepEqual(start,before);
});

test('an actual solo gun-contact member does not turn an unsafe personal shot into a rifle-lane departure',()=>{
 const start=localBatteryContactField({atGun:true}),before=structuredClone(start),unit=actor(start),gun=start.artillery[0],coordinated=localSetupCoordinator(start,true)(start,unit);
 assert.equal(artilleryContact(start,unit,gun),true);assert.ok(artilleryCrewPlan(start,unit,gun,0).reason,'The held contact post is not a complete Native crew.');assert.equal(coordinated?.type,'fire');
 const target=localMember(start,coordinated.targetId),quote=firearmShotOptions(start,unit,target,coordinated.aim??0).find(option=>option.aim===(coordinated.aim??0)&&option.hitLocation===(coordinated.hitLocation??'torso'));assert.equal(knownRouteBystanderShotSafety(start,unit,target)(quote),false);
 // Independently earn an actual short safe rifle lane on a detached branch.
 // Its existence must not authorize the waiting gun-contact member to leave.
 let lane=null;
 for(const point of getReachable(start,unit).filter(point=>point.cost>0&&point.cost<=24&&point.cost<unit.ap&&point.path.length<=3&&!point.path.some(step=>step.kind==='climb')).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x).slice(0,48)){
  if(artilleryContact(start,{...unit,...point},gun))continue;
  const move={type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0},moved=localCareStep(start,move),current=actor(moved),enemy=localMember(moved,'front'),cost=actionCosts(moved,current,enemy);
  if(current.ap<cost.fire)continue;
  const safe=knownRouteBystanderShotSafety(moved,current,enemy),maxAim=Math.min(4,Math.floor((current.ap-cost.fire)/cost.aim)),shot=firearmShotOptions(moved,current,enemy,maxAim).find(option=>option.chance>0&&option.damageFactor>0&&safe(option));
  if(shot){lane={move,moved,point};break;}
 }
 assert.ok(lane,'A real affordable safe rifle lane exists away from this declared gun.');assert.equal(actor(lane.moved).ap,unit.ap-lane.point.cost);assert.ok(actor(lane.moved).energy<unit.energy);
 const policy=localSetupPolicy(start);assert.equal(policy(start,unit),null);assert.equal(policy.sharedFallback(start,unit),null);assert.deepEqual(start,before,'A hold spends no ammunition, AP, energy or clock.');
});

test('contact holds retain two finite Native cannon shots and cannot borrow the actual adjacent physician',()=>{
 const start=localBatteryContactField({atGun:true,clear:true}),before=structuredClone(start),policy=localSetupPolicy(start),orders=[];let battle=start,fires=0,reloads=0;
 assert.deepEqual(artilleryCrewPlan(start,actor(start),start.artillery[0],artilleryCosts(start,actor(start),start.artillery[0]).fire).crew,['shooter','crew-leader']);
 assert.equal(canSee(start,actor(start),localMember(start,'front')),true,'The fresh finite-cannon target is actually visible before the first order.');
 for(let round=0;round<4&&fires<2;round++){
  for(let pass=0;pass<4&&fires<2;pass++){
   const unit=actor(battle),action=policy(battle,unit);if(!action)break;assert.ok(['artillery','artilleryReload','artilleryPivot'].includes(action.type)||action.type==='stance'&&action.stance==='standing',JSON.stringify({action,round,pass,fires,reloads,status:battle.status,mode:battle.mode,phase:battle.phase,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds,roundTimeCharged:battle.roundTimeCharged,orders,actor:unit,gun:battle.artillery[0],target:localMember(battle,'front'),crew:battle.units.filter(other=>other.side===unit.side&&other.id!==unit.id),smoke:battle.smoke,log:battle.log.slice(-12)}));
   if(action.type==='stance'){
    const pa=stanceCost(unit,'standing');assert.ok(pa>0&&unit.ap>=pa);const after=localCareStep(battle,action);assert.equal(actor(after).stance,'standing');assert.equal(actor(after).ap,unit.ap-pa);
    for(const key of ['x','y','tacticalLevel','hp','maxHp','bleeding','bandaged','medkits','weapon','loaded','ammo','inventory'])assert.deepEqual(actor(after)[key],unit[key]);
    assert.deepEqual(after.artillery,battle.artillery);for(const other of battle.units.filter(other=>other.id!==unit.id))assert.deepEqual(localMember(after,other.id),other);
    orders.push(action);battle=after;continue;
   }
   const gun=battle.artillery[0],plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,gun):artilleryCrewPlan(battle,unit,gun,artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':'pivot']),pa=action.type==='artilleryReload'?plan.pa:artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':'pivot'];
   assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),['crew-leader','shooter']);const after=localCareStep(battle,action);for(const id of plan.crew)assert.equal(localMember(after,id).ap,localMember(battle,id).ap-pa);
   if(action.type==='artillery'){assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,gun.ammo);fires++;}if(action.type==='artilleryReload'){assert.equal(after.artillery[0].ammo,gun.ammo-(Number(after.artillery[0].loaded)-Number(gun.loaded)));reloads++;}
   orders.push(action);battle=after;
  }
  if(fires<2){assert.equal(battle.status,'active');const action={type:'endTurn'};battle=localCareStep(battle,action);orders.push(action);}
 }
 assert.equal(fires,2);assert.ok(reloads>0);assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,0);
 for(const id of ['shooter','crew-leader','field-physician'])for(const key of ['hp','maxHp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(localMember(battle,id)[key],localMember(start,id)[key]);
 assert.deepEqual(contactSetupReplay(start,orders),battle);assert.deepEqual(start,before);
 const clinical=localBatteryContactField({atGun:true,clinical:true}),clinicalBefore=structuredClone(clinical),native=artilleryCrewPlan(clinical,actor(clinical),clinical.artillery[0],0);assert.equal(native.reason,null);assert.deepEqual(native.crew,['shooter','field-physician']);assert.equal(localSetupPolicy(clinical)(clinical,actor(clinical)),null);assert.deepEqual(clinical,clinicalBefore,'The actual clinical body remains present and cannot supply an eligible nonclinical gun crew.');
});


import {canSee} from '../game/tactical.js';

test('a solo actual contact post survives a null coordinator even when ordinary cautious search has a legal move',()=>{
 // Every current body and this valid remembered point belong to the fresh
 // declaration. The actual enemy is hidden behind the solid partition.
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:90,dexterity:90,strength:80,medical:0,medkits:0,blade:0,condition:100,stance:'crouched',movementMode:'crouch',activeSlot:'primary',facing:2,patrol:false,overwatch:false};
 const players=[{...base,id:'shooter',x:1,y:4,weapon:1802,loaded:1,ammo:8,marksmanship:90,lastKnownEnemy:{x:12,y:4,tacticalLevel:0,turn:1}},
  {...base,id:'crew-leader',x:8,y:8,weapon:0,loaded:0,ammo:0,marksmanship:0,stance:'standing',movementMode:'walk'},
  {...base,id:'field-physician',x:8,y:10,weapon:0,loaded:0,ammo:0,marksmanship:0,medical:80,medkits:1,stance:'prone',movementMode:'prone'}];
 const options={id:'declared-local-battery-null-contact',width:32,height:14,hour:12,seed:45,exploration:false,deferContact:true,
  tiles:Array.from({length:448},(_,i)=>i%32===16?{x:16,y:Math.floor(i/32),type:'stone',blocked:true,blocksSight:true,obstacleHeight:10,cover:40}:{x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}),
  enemies:[{id:'front',x:24,y:4,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],npcs:[],artillery:[{id:'contact-gun',type:'bronze4',side:'player',x:2,y:4,facing:0,loaded:true,ammo:1}]};
 const declaration=structuredClone({players,options}),start=createBattle(players,options),before=structuredClone(start),unit=actor(start),gun=start.artillery[0],ordinary=cautiousCombatOrder(start,unit);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);
 assert.equal(artilleryContact(start,unit,gun),true);assert.ok(artilleryCrewPlan(start,unit,gun,0).reason);assert.equal(canSee(start,unit,localMember(start,'front')),false);assert.deepEqual(unit.lastKnownEnemy,{x:12,y:4,tacticalLevel:0,turn:1});assert.equal(ordinary?.type,'move');assert.equal(localSetupCoordinator(start,true)(start,unit),null,'The coordinator has already held its actual gun-contact member.');
 const defaultPolicy=northernReliefDefenseController(['field-physician'],{localCareBattle:start});assert.deepEqual(defaultPolicy(start,unit),ordinary,'The nonpriority constructor keeps its existing ordinary work.');
 const route=getReachable(start,unit).find(point=>point.x===ordinary.x&&point.y===ordinary.y&&(point.tacticalLevel??0)===(ordinary.tacticalLevel??0));assert.ok(route&&route.cost>0);const moved=localCareStep(start,ordinary);assert.equal(actor(moved).ap,unit.ap-route.cost);assert.ok(actor(moved).energy<unit.energy);assert.deepEqual([actor(moved).x,actor(moved).y],[ordinary.x,ordinary.y]);
 for(const key of ['hp','maxHp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(actor(moved)[key],unit[key]);assert.deepEqual(moved.artillery,start.artillery);
 const policy=localSetupPolicy(start);for(let callback=0;callback<3;callback++){assert.equal(policy(start,unit),null);assert.equal(policy.sharedFallback(start,unit),null);}
 assert.deepEqual(start,before,'Direct and shared holds spend no actual AP, energy, time, ammunition, stock or posture.');
});


// The local-care entry selects the same existing coordinator for an actual
// complete charged crew. The spare is farther from its authored approach;
// this declaration does not change or generalize coastal assignment policy.
import {northernLocalCareDefenseController} from './fresh-northern-fixture.mjs';
function staffedLocalCareField({visible=false,charged=true,clinical=false}={}){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:90,dexterity:90,strength:80,medical:0,medkits:0,blade:0,condition:100,loaded:1,ammo:8,weapon:1802,marksmanship:90,activeSlot:'primary',facing:2,patrol:false,overwatch:false};
 const players=[{...base,id:'shooter',x:1,y:4,stance:'crouched',movementMode:'crouch',...(!visible?{lastKnownEnemy:{x:12,y:4,tacticalLevel:0,turn:1}}:{})},
  {...base,id:'crew-leader',x:2,y:5,stance:'standing',movementMode:'walk',medical:clinical?80:0},
  {...base,id:'field-physician',x:8,y:10,stance:'prone',movementMode:'prone',weapon:0,loaded:0,ammo:0,medical:80,medkits:1}];
 const options={id:'declared-staffed-local-care-entry',width:32,height:14,hour:12,seed:45,exploration:false,...(!visible?{deferContact:true}:{}),
  tiles:Array.from({length:448},(_,i)=>!visible&&i%32===16?{x:16,y:Math.floor(i/32),type:'stone',blocked:true,blocksSight:true,obstacleHeight:10,cover:40}:{x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}),
  enemies:[{id:'front',x:visible?14:24,y:4,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}],
  artillery:charged?[{id:'staffed-gun',type:'bronze4',side:'player',x:2,y:4,facing:0,loaded:true,ammo:1},{id:'farther-spare',type:'bronze4',side:'player',x:0,y:10,facing:0,loaded:true,ammo:1}]:[]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function staffedLocalCareReplay(start,orders){
 let battle=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));const policy=northernLocalCareDefenseController(battle,['field-physician']);
 for(const action of orders){if(action.type!=='endTurn')assert.deepEqual(policy(battle,actor(battle)),action);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(localCareStep(battle,action))));}return battle;
}

test('local care retains its actual complete charged crew instead of opting out into an ordinary rifle search',()=>{
 const start=staffedLocalCareField(),before=structuredClone(start),unit=actor(start),gun=start.artillery[0],crew=artilleryCrewPlan(start,unit,gun,0),ordinary=northernReliefDefenseController(['field-physician'])(start,unit);
 assert.equal(crew.reason,null);assert.deepEqual([...crew.crew].sort(),['crew-leader','shooter']);assert.ok(crew.crew.every(id=>localMember(start,id).medical<60&&artilleryContact(start,localMember(start,id),gun)));
 const approach={x:Math.floor(start.width*.65),y:Math.floor(start.height*.5)},distance=piece=>Math.hypot(piece.x-approach.x,piece.y-approach.y);assert.ok(distance(gun)<distance(start.artillery[1]));
 assert.equal(ordinary?.type,'move');const route=getReachable(start,unit).find(point=>point.x===ordinary.x&&point.y===ordinary.y&&(point.tacticalLevel??0)===(ordinary.tacticalLevel??0));assert.ok(route&&route.cost>0);const moved=localCareStep(start,ordinary);assert.equal(actor(moved).ap,unit.ap-route.cost);assert.ok(actor(moved).energy<unit.energy);
 const policy=northernLocalCareDefenseController(start,['field-physician']);for(let callback=0;callback<3;callback++){assert.equal(policy(start,unit),null);assert.equal(policy.sharedFallback(start,unit),null);}assert.deepEqual(start,before);
 const none=staffedLocalCareField({charged:false}),noneBefore=structuredClone(none),old=northernReliefDefenseController(['field-physician']),unarmed=northernLocalCareDefenseController(none,['field-physician']);
 for(const member of none.units.filter(other=>other.side==='player')){assert.deepEqual(unarmed(none,member),old(none,member));assert.deepEqual(unarmed.sharedFallback(none,member),old.sharedFallback(none,member));}assert.deepEqual(none,noneBefore);
 const clinical=staffedLocalCareField({clinical:true}),clinicalBefore=structuredClone(clinical),native=artilleryCrewPlan(clinical,actor(clinical),clinical.artillery[0],0);assert.equal(native.reason,null);assert.deepEqual([...native.crew].sort(),['crew-leader','shooter']);assert.equal(localMember(clinical,'crew-leader').medical,80);const clinicalPolicy=northernLocalCareDefenseController(clinical,['field-physician']);assert.equal(clinicalPolicy(clinical,actor(clinical)),null);assert.equal(clinicalPolicy.sharedFallback(clinical,actor(clinical)),null);assert.deepEqual(clinical,clinicalBefore,'A real adjacent clinical body stays present and cannot become an eligible gun helper.');
});

test('the local-care factory pays finite Native work for its already assembled gun and leaves its farther spare untouched',()=>{
 const start=staffedLocalCareField({visible:true}),before=structuredClone(start),policy=northernLocalCareDefenseController(start,['field-physician']),orders=[];let battle=start,fires=0,reloads=0;
 assert.equal(canSee(start,actor(start),localMember(start,'front')),true);assert.deepEqual([...artilleryCrewPlan(start,actor(start),start.artillery[0],0).crew].sort(),['crew-leader','shooter']);
 for(let round=0;round<4&&fires<2;round++){
  for(let pass=0;pass<4&&fires<2;pass++){
   const unit=actor(battle),action=policy(battle,unit);if(!action)break;assert.ok(['artillery','artilleryReload','artilleryPivot'].includes(action.type)||action.type==='stance'&&action.stance==='standing',JSON.stringify({action,round,pass,fires,reloads,orders,unit,gun:battle.artillery[0],mode:battle.mode,phase:battle.phase}));
   let after;
   if(action.type==='stance'){const cost=stanceCost(unit,'standing');assert.ok(cost>0&&unit.ap>=cost);after=localCareStep(battle,action);assert.equal(actor(after).ap,unit.ap-cost);assert.equal(actor(after).stance,'standing');for(const key of ['x','y','tacticalLevel','hp','bleeding','loaded','ammo','medkits','inventory'])assert.deepEqual(actor(after)[key],unit[key]);assert.deepEqual(after.artillery,battle.artillery);}
   else{assert.equal(action.artilleryId,'staffed-gun');const gun=battle.artillery[0],plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,gun):artilleryCrewPlan(battle,unit,gun,artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':'pivot']),cost=action.type==='artilleryReload'?plan.pa:artilleryCosts(battle,unit,gun)[action.type==='artillery'?'fire':'pivot'];assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),['crew-leader','shooter']);after=localCareStep(battle,action);for(const id of plan.crew)assert.equal(localMember(after,id).ap,localMember(battle,id).ap-cost);
    if(action.type==='artillery'){assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,gun.ammo);fires++;}if(action.type==='artilleryReload'){assert.equal(after.artillery[0].ammo,gun.ammo-(Number(after.artillery[0].loaded)-Number(gun.loaded)));reloads++;}}
   for(const id of ['shooter','crew-leader','field-physician'])for(const key of ['hp','maxHp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(localMember(after,id)[key],localMember(start,id)[key]);assert.deepEqual(after.artillery[1],start.artillery[1]);orders.push(action);battle=after;
  }
  if(fires<2){assert.equal(battle.status,'active');const action={type:'endTurn'};battle=localCareStep(battle,action);orders.push(action);}
 }
 assert.equal(fires,2);assert.ok(reloads>0);assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,0);assert.deepEqual(battle.artillery[1],start.artillery[1]);assert.ok(!orders.some(action=>['fire','reload','move'].includes(action.type)));
 for(const id of ['shooter','crew-leader','field-physician'])for(const key of ['x','y','hp','maxHp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(localMember(battle,id)[key],localMember(start,id)[key]);assert.deepEqual(staffedLocalCareReplay(start,orders),battle);assert.deepEqual(start,before);
});


// These actors begin with a complete finite gun crew and no current visual
// contact or remembered target. Standing roles and physical resources are
// declared before the Native factory; the first real look earns combat normally.
import {lookPreview} from '../game/tactical.js';
function precontactLocalBatteryField({clinical=false,charged=true,incomplete=false,aid=false}={}){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:90,dexterity:90,strength:80,medical:0,medkits:0,blade:0,condition:100,loaded:1,ammo:8,weapon:1802,marksmanship:90,activeSlot:'primary',facing:6,patrol:false,overwatch:false};
 const players=[{...base,id:'shooter',x:1,y:4,stance:'standing',movementMode:'walk',...(aid?{hp:60,bleeding:1,medical:20,medkits:1,activeSlot:'medical'}:{})},
  {...base,id:'crew-leader',x:2,y:incomplete?8:5,stance:'standing',movementMode:'walk',medical:clinical?80:0},
  {...base,id:'field-physician',x:8,y:10,stance:'prone',movementMode:'prone',weapon:0,loaded:0,ammo:0,medical:80,medkits:1}];
 const options={id:'declared-precontact-local-battery',width:32,height:14,hour:12,seed:45,exploration:true,
  tiles:Array.from({length:448},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'front',x:14,y:4,hp:500,maxHp:500,bandaged:0,weapon:0,blade:0,loaded:0,ammo:0,stance:'standing',facing:2,patrol:false,overwatch:false}],
  artillery:charged?[{id:'precontact-gun',type:'bronze4',side:'player',x:2,y:4,facing:0,loaded:true,ammo:1},{id:'farther-spare',type:'bronze4',side:'player',x:0,y:10,facing:0,loaded:true,ammo:1}]:[]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('a complete local battery retains its pre-contact pair then pays real look, finite fire and reload work',()=>{
 const start=precontactLocalBatteryField(),before=structuredClone(start),ids=['shooter','crew-leader'],gun=start.artillery[0],policy=northernLocalCareDefenseController(start,['field-physician']),ordinary=northernReliefDefenseController(['field-physician'],{localCareBattle:start});
 assert.equal(start.mode,'exploration');assert.equal(start.phase,'player');assert.equal(artilleryCrewPlan(start,actor(start),gun,0).reason,null);assert.deepEqual([...artilleryCrewPlan(start,actor(start),gun,0).crew].sort(),['crew-leader','shooter']);
 for(const id of ids){const unit=localMember(start,id);assert.equal(artilleryContact(start,unit,gun),true);assert.equal(canSee(start,unit,localMember(start,'front')),false);assert.equal(ordinary(start,unit)?.type,'move');for(let callback=0;callback<3;callback++){assert.equal(policy(start,unit),null);assert.equal(policy.sharedFallback(start,unit),null);}}
 assert.equal(canSee(start,localMember(start,'front'),actor(start)),false);assert.deepEqual(start,before,'A pre-contact hold changes no body, posture, AP, clock, charge or supply.');
 const look={type:'look',unitId:'shooter',x:14,y:4},lookQuote=lookPreview(start,actor(start),look);assert.equal(lookQuote.valid,true);assert.ok(lookQuote.pa>0);
 let battle=localCareStep(start,look),fires=0,reloads=0;const orders=[look];assert.equal(battle.elapsedSeconds-start.elapsedSeconds,Math.max(1,Math.ceil(lookQuote.pa*.06)));assert.equal(battle.mode,'combat');assert.equal(battle.phase,'player');assert.equal(canSee(battle,actor(battle),localMember(battle,'front')),true);
 for(const id of ids){assert.equal(localMember(battle,id).ap,localMember(battle,id).maxAP,'Native contact owns the ordinary initial combat AP.');assert.deepEqual([localMember(battle,id).x,localMember(battle,id).y],[localMember(start,id).x,localMember(start,id).y]);}
 for(let round=0;round<4&&fires<2;round++){
  for(let pass=0;pass<4&&fires<2;pass++){
   const unit=actor(battle),action=policy(battle,unit);if(!action)break;assert.ok(['artillery','artilleryReload','artilleryPivot'].includes(action.type)||action.type==='stance'&&action.stance==='standing',JSON.stringify({action,orders,mode:battle.mode,phase:battle.phase,unit,gun:battle.artillery[0]}));let after;
   if(action.type==='stance'){const cost=stanceCost(unit,'standing');after=localCareStep(battle,action);assert.equal(actor(after).ap,unit.ap-cost);assert.equal(actor(after).stance,'standing');assert.deepEqual(after.artillery,battle.artillery);}
   else{assert.equal(action.artilleryId,'precontact-gun');const piece=battle.artillery[0],plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,piece):artilleryCrewPlan(battle,unit,piece,artilleryCosts(battle,unit,piece)[action.type==='artillery'?'fire':'pivot']),cost=action.type==='artilleryReload'?plan.pa:artilleryCosts(battle,unit,piece)[action.type==='artillery'?'fire':'pivot'];assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),['crew-leader','shooter']);after=localCareStep(battle,action);for(const id of plan.crew)assert.equal(localMember(after,id).ap,localMember(battle,id).ap-cost);
    if(action.type==='artillery'){assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,piece.ammo);fires++;}if(action.type==='artilleryReload'){assert.equal(after.artillery[0].ammo,piece.ammo-(Number(after.artillery[0].loaded)-Number(piece.loaded)));reloads++;}}
   for(const id of ids)for(const key of ['x','y','hp','maxHp','bleeding','bandaged','loaded','ammo','medkits','inventory'])assert.deepEqual(localMember(after,id)[key],localMember(start,id)[key]);for(const key of ['x','y','tacticalLevel','hp','maxHp','bleeding','bandaged','loaded','ammo','medkits','inventory','stance','activeSlot','ap','energy'])assert.deepEqual(localMember(after,'field-physician')[key],localMember(battle,'field-physician')[key]);assert.deepEqual(after.artillery[1],start.artillery[1]);orders.push(action);battle=after;
  }
  if(fires<2){assert.equal(battle.status,'active');const action={type:'endTurn'};battle=localCareStep(battle,action);orders.push(action);}
 }
 assert.equal(fires,2);assert.ok(reloads>0);assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,0);assert.ok(!orders.some(action=>['move','fire','reload','reprime'].includes(action.type)));
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));const replayPolicy=northernLocalCareDefenseController(replay,['field-physician']);
 for(const [index,action]of orders.entries()){if(index>0&&action.type!=='endTurn')assert.deepEqual(replayPolicy(replay,actor(replay)),action);replay=validateBattleSnapshot(JSON.parse(JSON.stringify(localCareStep(replay,action))));}assert.deepEqual(replay,battle);assert.deepEqual(start,before);
});

test('pre-contact retention keeps defaults, incomplete and clinical crews exact and gives actual finite aid first',()=>{
 for(const options of [{charged:false},{incomplete:true},{clinical:true}]){
  const start=precontactLocalBatteryField(options),before=structuredClone(start),unit=actor(start),ordinary=cautiousCombatOrder(start,unit),policy=northernLocalCareDefenseController(start,['field-physician']);assert.equal(start.mode,'exploration');assert.equal(ordinary?.type,'move');
  if(options.incomplete)assert.ok(artilleryCrewPlan(start,unit,start.artillery[0],0).reason);if(options.clinical){const plan=artilleryCrewPlan(start,unit,start.artillery[0],0);assert.equal(plan.reason,null);assert.ok(plan.crew.some(id=>localMember(start,id).medical>=60));}
  assert.deepEqual(policy(start,unit),ordinary);assert.deepEqual(start,before);
 }
 const start=precontactLocalBatteryField({aid:true}),before=structuredClone(start),unit=actor(start),quote=medicalUsePreview(start,unit,unit),policy=northernLocalCareDefenseController(start,['field-physician']),action=policy(start,unit);assert.equal(quote.allowed,true);assert.deepEqual(action,{type:'useItem',unitId:unit.id,targetId:unit.id});const after=localCareStep(start,action);assert.equal(actor(after).medkits,unit.medkits-quote.treatment.dressingsUsed);assert.equal(actor(after).bleeding,0);assert.ok(actor(after).bandaged>0);assert.equal(actor(after).hp,unit.hp);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});
