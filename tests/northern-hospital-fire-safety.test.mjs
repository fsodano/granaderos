import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,firearmShotOptions,getReachable} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {knownRouteShotSafety,knownRouteBystanderShotSafety} from './route-fire-safety.mjs';
import {publicRouteView,usefulRouteRifleShot,usefulRouteFiringPosture} from './route-infantry-progress.mjs';
import {northernCombatOrder,northernClinicDefenseOrder} from './northern-route.mjs';
import {northernHospitalCoverOrder} from './fresh-northern-recovery.mjs';
import {coordinatedHospitalBattery,paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';

const actor=(battle,id='shooter')=>battle.units.find(unit=>unit.id===id);
const strict={shotSafety:knownRouteBystanderShotSafety};
const resident=(x,y,fields={})=>({id:'resident',name:'Known resident',x,y,tacticalLevel:1,hp:100,maxHp:100,civilianHealthVersion:1,energy:100,unconscious:false,stance:'standing',...fields});

// All bodies, finite loads, roof cells and geometry are declared before the
// Native factory. No failed campaign, copied outcome or returned body is input.
function field({direct=null,scatter=false,alternative=false,weapon=1802,paired=false,standing=false,targetX=8,npc=null}={}){
 const width=22,height=12,players=[
  {id:'shooter',name:'Roof rifle',x:direct?2:1,y:direct?3:4,tacticalLevel:1,weapon,blade:0,loaded:1,ammo:8,condition:100,activeSlot:'primary',stance:standing?'standing':'prone',movementMode:standing?'walk':'prone',marksmanship:100,dexterity:100,agility:100,strength:80,energy:100,fatigue:0,morale:90,medical:0,medkits:0,facing:2,...(paired?{offHand:{weapon:1805,count:1,loaded:1,condition:100}}:{})},
  ...(direct==='unit'||scatter?[{id:'friend',name:'Known friendly post',x:direct?5:8,y:direct?3:5,tacticalLevel:1,weapon:0,blade:0,loaded:0,ammo:0,activeSlot:'unarmed',stance:'standing',energy:100,morale:90,medical:0,medkits:0,facing:2}]:[]),
 ];
 const options={id:'declared-hospital-public-fire-safety',width,height,hour:12,seed:45,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  upperSurfaces:Array.from({length:width*height},(_,i)=>({id:'roof:'+i,x:i%width,y:Math.floor(i/width),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0})),
  enemies:[{id:'front',x:direct?8:targetX,y:direct?3:4,tacticalLevel:1,hp:100,maxHp:100,weapon:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false},...(alternative?[{id:'clear-lane',x:14,y:0,tacticalLevel:1,hp:100,maxHp:100,weapon:0,loaded:0,ammo:0,stance:'standing',patrol:false,overwatch:false}]:[])],
  npcs:[...(direct==='npc'?[resident(5,3)]:[]),...(npc?[npc]:[])],
 };
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);
 assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

function forecast(battle,unit,action){
 const target=battle.units.find(other=>other.id===action.targetId);
 return {target,option:firearmShotOptions(battle,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'))};
}
function safeFire(battle,unit,action){
 assert.equal(action?.type,'fire');const {target,option}=forecast(battle,unit,action);assert.ok(option);assert.ok(option.chance>=5&&option.damageFactor>0);assert.equal(knownRouteBystanderShotSafety(battle,unit,target)(option),true);const risk=firearmBystanderRisk(battle,unit,target,action.hitLocation??'torso');assert.deepEqual(risk,{direct:[],scatter:[]});
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),validated=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,action))));assert.deepEqual(shown,direct);assert.deepEqual(validated,direct);}
 return direct;
}
function paidFire(before,after,action){
 const unit=actor(before),next=actor(after),cost=actionCosts(before,unit,actor(before,action.targetId));
 assert.equal(next.ap,unit.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(next.loaded,unit.loaded-1);assert.equal(next.ammo,unit.ammo);assert.equal(next.condition,unit.condition-1);
 const count=u=>Object.values(unitAmmunitionByType(u)).reduce((sum,n)=>sum+n,0);assert.equal(count(next),count(unit)-1);
}

for(const kind of ['unit','npc'])test('the hospital low-chance fallback cannot bypass the known direct '+kind+' lane guard',()=>{
 const start=field({direct:kind}),before=structuredClone(start),unit=actor(start),target=actor(start,'front');
 assert.equal(northernClinicDefenseOrder(start,unit),null,'The existing held roof policy must actually leave the fallback to decide.');
 const candidates=firearmShotOptions(start,unit,target,4).filter(option=>option.chance>=5&&option.damageFactor>0);assert.ok(candidates.length>0,'The old fallback has actual positive paid candidates.');
 const safe=knownRouteShotSafety(start,unit,target);assert.ok(candidates.every(option=>!safe(option)),'Every fallback candidate crosses the declared known body.');
 assert.equal(northernHospitalCoverOrder(start,unit),null);const selected=coordinatedHospitalBattery(start).controller(start,unit);assert.notEqual(selected?.type,'fire');assert.deepEqual(start,before);
});

test('the coordinated hospital revalidates ordinary fire and selects an existing safe alternative to a known friendly miss path',()=>{
 const start=field({scatter:true,alternative:true}),before=structuredClone(start),unit=actor(start),ordinary=northernClinicDefenseOrder(start,unit);assert.equal(ordinary?.type,'fire');
 const {target,option}=forecast(start,unit,ordinary);assert.equal(knownRouteShotSafety(start,unit,target)(option),true);assert.equal(knownRouteBystanderShotSafety(start,unit,target)(option),false);assert.ok(firearmBystanderRisk(start,unit,target,ordinary.hitLocation).scatter.some(body=>body.id==='friend'));
 const selected=coordinatedHospitalBattery(start).controller(start,unit);assert.equal(selected?.targetId,'clear-lane');safeFire(start,unit,selected);const end=replay(start,[selected]);paidFire(start,end,selected);assert.equal(actor(end,'friend').hp,actor(start,'friend').hp);assert.deepEqual(start,before);
});

test('paired hands and finite pellet paths include current known friendly bystanders without consuming quotes',()=>{
 for(const config of [{weapon:1806,paired:true},{weapon:1807}]){
  const start=field({...config,scatter:true}),before=structuredClone(start),unit=actor(start),target=actor(start,'front'),options=firearmShotOptions(start,unit,target,4),risk=firearmBystanderRisk(start,unit,target,'torso');
  assert.ok([...risk.direct,...risk.scatter].some(body=>body.id==='friend'));const option=options.find(option=>option.hitLocation==='torso');assert.ok(option);assert.equal(knownRouteBystanderShotSafety(start,unit,target)(option),false);
  const selected=coordinatedHospitalBattery(start).controller(start,unit);if(selected?.type==='fire')safeFire(start,unit,selected);assert.deepEqual(start,before);
 }
});

test('a clear ordinary hospital shot keeps its exact target and aim and pays one real finite discharge',()=>{
 const start=field(),before=structuredClone(start),unit=actor(start),ordinary=northernHospitalCoverOrder(start,unit),selected=coordinatedHospitalBattery(start).controller(start,unit);assert.deepEqual(selected,ordinary);safeFire(start,unit,selected);
 const end=replay(start,[selected]);paidFire(start,end,selected);assert.equal(end.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(start,before);
});

test('the held roof rifle pays an actual safe local move and then a finite shot instead of accepting a friendly scatter lane',()=>{
 const start=field({standing:true,targetX:12,npc:resident(5,5)}),before=structuredClone(start),unit=actor(start),policy=coordinatedHospitalBattery(start),ordinary=northernHospitalCoverOrder(start,unit),publicView=publicRouteView(start,unit);
 assert.ok(ordinary);assert.equal(usefulRouteRifleShot(publicView,unit,strict),null,'No current strict shot may bypass the payable movement premise.');
 const move=policy.controller(start,unit);assert.equal(move?.type,'move');const point=getReachable(publicView,unit,{stopAt:p=>sameCell(p,move)})[0];assert.ok(point.cost>0&&point.cost<=20&&sameSurface(point,unit));assert.ok(point.path.every(step=>(step.kind===undefined||step.kind==='move')&&sameSurface(step,unit)));
 const quote=paidHospitalRoofWalkPreview(structuredClone(publicView),structuredClone(unit),point);assert.ok(quote);assert.ok(usefulRouteRifleShot(quote.view,quote.actor,strict));
 const moved=replay(start,[move]),current=actor(moved);assert.ok(sameCell(current,move));assert.equal(current.ap,unit.ap-point.cost);assert.ok(current.energy<unit.energy);assert.equal(current.loaded,unit.loaded);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const fire=policy.controller(moved,current);safeFire(moved,current,fire);const end=replay(start,[move,fire]);paidFire(moved,end,fire);assert.equal(end.elapsedSeconds,moved.elapsedSeconds);assert.ok(sameCell(actor(end),move));assert.equal(end.npcs[0].hp,start.npcs[0].hp);assert.deepEqual(end.upperSurfaces,start.upperSurfaces);assert.deepEqual(start,before);
});

test('other route consumers retain their default direct-lane predicate and ordinary action unchanged',()=>{
 const start=field({scatter:true}),before=structuredClone(start),unit=actor(start),ordinary=northernCombatOrder(start,unit),shot=usefulRouteRifleShot(start,unit);assert.equal(ordinary?.type,'fire');assert.equal(shot?.type,'fire');
 assert.deepEqual(usefulRouteRifleShot(start,unit,{shotSafety:knownRouteShotSafety}),shot);const {target,option}=forecast(start,unit,shot);assert.equal(knownRouteShotSafety(start,unit,target)(option),true);assert.equal(knownRouteBystanderShotSafety(start,unit,target)(option),false);
 const posture={type:'stance',unitId:unit.id,stance:'crouched'};assert.equal(usefulRouteFiringPosture(start,unit,posture),usefulRouteFiringPosture(start,unit,posture,{shotSafety:knownRouteShotSafety}));assert.deepEqual(northernCombatOrder(start,unit),ordinary);assert.deepEqual(start,before);
});

test('unrevealed or dead civilians cannot change the current public hospital decision',()=>{
 const clear=field(),expected=coordinatedHospitalBattery(clear).controller(clear,actor(clear));assert.equal(expected?.type,'fire');
 for(const npc of [resident(5,5,{roomId:'unrevealed'}),resident(5,5,{hp:0})]){
  const start=field({npc}),before=structuredClone(start),unit=actor(start);assert.deepEqual(coordinatedHospitalBattery(start).controller(start,unit),expected);assert.deepEqual(start,before);
 }
});
