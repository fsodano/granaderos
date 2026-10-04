import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,weaponFor,firearmFlightPreview,firearmVolleyPreview,firearmShotOptions,shotChance,teamCanSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {projectileTrajectory,projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {practiceFirearmNearMiss} from '../game/firearm-near-miss-practice.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';

const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
const definition=(id,range=2,template=1805,damage=42)=>compileWeaponDefinition({id,name:'Pistola de prueba',template,damage,fireAP:7,aimAP:3,reloadAP:32,range});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const field=(distance=6,extra={})=>createBattle([{id:'p',x:1,y:3,facing:2,weapon:1800,loaded:1,condition:100,marksmanship:100}],{width:48,height:12,seed:9,tiles:tiles(48,12),enemies:[{id:'e',x:1+distance,y:3,patrol:false,overwatch:false,morale:100}],...extra});

test('near single-ball forecasts retain their shape and a known ally passage remains conditional',()=>{
 const s=field(),[u,target]=s.units,before=structuredClone(s),path=firearmFlightPreview(s,u,target);
 assert.equal(path.trajectoryModel,undefined);assert.equal(path.trajectory,undefined);assert.equal(path.terminal.fraction,undefined);
 assert.deepEqual(firearmVolleyPreview(s,u,target).shots[0],{hand:'primary',weapon:1800,name:'Brown Bess',chance:95,damageFactor:1,damage:58});
 assert.equal(firearmVolleyPreview(s,u,target,0,'head').shots[0].physicalHitLocation,undefined);
 assert.deepEqual(s,before);
 s.units.push({...structuredClone(u),id:'ally',name:'Compañero visible',x:4});
 const through=firearmFlightPreview(s,u,target),contact=through.bodyImpacts.find(hit=>hit.victimId===target.id),forecast=firearmVolleyPreview(s,u,target).shots[0];
 assert.ok(contact);assert.equal(forecast.interveningFriendly,true);assert.equal(forecast.conditional,true);assert.ok(forecast.chance>0&&forecast.chance<95);
 close(forecast.reachChance,contact.reachChance);close(forecast.damageFactor,contact.incomingImpact/weaponFor(u).damage);
 assert.equal(firearmBystanderRisk(s,u,target).direct[0].id,'ally');
});

test('a ground stop before the selected body has zero target chance and force without rejecting the paid shot',()=>{
 const s=field(43),[u,target]=s.units;u.weapon=1805;
 s.units.push({...structuredClone(u),id:'observer',x:43,y:4,facing:0,weapon:1813});
 assert.equal(teamCanSee(s,'player',target),true);
 const before=structuredClone(s),path=firearmFlightPreview(s,u,target),preview=firearmVolleyPreview(s,u,target,4,'torso').shots[0];
 assert.equal(path.terminal.termination,'ground');assert.ok(path.terminal.impact.x<target.x);assert.deepEqual(path.bodyImpacts,[]);
 assert.equal(preview.chance,0);assert.equal(preview.damageFactor,0);assert.equal(preview.physicalHitLocation,undefined);assert.equal(shotChance(s,u,target,4),0);assert.deepEqual(s,before);
 const action={type:'fire',unitId:u.id,targetId:target.id,aim:4},actual=actBattle(s,action),cost=actionCosts(s,u,target);
 assert.equal(actual.lastError,null);assert.equal(actual.units[1].hp,target.hp);assert.equal(actual.units[0].loaded,0);assert.equal(actual.units[0].ap,u.ap-cost.fire-4*cost.aim);assert.equal(actual.elapsedSeconds,6);
 assert.deepEqual(presentedActBattle(s,action).state,actual);
});

test('far head aim and paired forecasts expose actual regions separately from the issued aim',()=>{
 const s=field(36),[u,target]=s.units;u.weapon=1805;
 u.offHand={weapon:1808,count:1,weight:1.3,loaded:1,condition:100};
 s.units.push({...structuredClone(u),id:'observer',x:36,y:4,facing:0,weapon:1813,offHand:null});
 const before=structuredClone(s),preview=firearmVolleyPreview(s,u,target,4,'head'),option=firearmShotOptions(s,u,target,4).find(option=>option.hitLocation==='head'&&option.aim===4);
 assert.equal(preview.paired,true);assert.deepEqual(preview.shots.map(shot=>shot.physicalHitLocation),['legs','torso']);
 assert.ok(preview.shots.every(shot=>shot.chance>0));assert.equal(option.hitLocation,'head');assert.equal(option.physicalHitLocation,'legs');assert.deepEqual(option.shots,preview.shots);
 assert.deepEqual(s,before,'forecasting cannot consume a charge, combat RNG or time');
});

test('AI values actual region injury and balance while its action retains the requested aim',()=>{
 // An authored short-range pistol makes drop observable within actual sight.
 // A predeclared water moat prevents unrelated movement candidates.
 const s=createBattle([{id:'p',x:9,y:4,facing:6,weapon:1813}],{width:20,height:10,seed:1,tiles:tiles(20,10),enemies:[{id:'e',x:1,y:4,facing:2,weapon:1805,marksmanship:100,condition:100,contentWeapon:definition('short-ai-pistol',1),patrol:false,overwatch:false}]});
 const [target,u]=s.units;for(const tile of s.tiles)if(Math.max(Math.abs(tile.x-u.x),Math.abs(tile.y-u.y))===1)Object.assign(tile,{type:'water',blocked:true,obstacleHeight:0});
 const before=structuredClone(s),options=firearmShotOptions(s,u,target),torso=options.find(option=>option.hitLocation==='torso'&&option.aim===4),head=options.find(option=>option.hitLocation==='head'&&option.aim===4);
 assert.equal(torso.physicalHitLocation,'legs');assert.equal(head.physicalHitLocation,'torso');
 const value=(option,location)=>{const effect=shotLocationEffects(location,weaponFor(u).damage*option.damageFactor,target);return option.chance*(Math.min(target.hp,effect.damage)+(target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0)+(effect.unhorse?20:0)));};
 assert.ok(value(torso,torso.physicalHitLocation)>value(head,head.physicalHitLocation));
 assert.ok(value(torso,torso.hitLocation)<value(head,head.hitLocation),'requested-region scoring would make the wrong tactical choice');
 assert.deepEqual(chooseEnemyAction(s,u),{type:'fire',unitId:'e',targetId:'p',aim:4,hitLocation:'torso'});assert.deepEqual(s,before);
});

test('hidden bodies and prop depth cannot enter far public forecasts or bystander risk',()=>{
 const s=field(36),[u,target]=s.units;u.weapon=1805;
 s.units.push({...structuredClone(u),id:'observer',x:36,y:4,facing:0,weapon:1813});
 const hidden=structuredClone(s);hidden.npcs=[{id:'private-person',name:'Persona privada',x:28,y:3,hp:100,stance:'standing',roomId:'unrevealed'}];
 hidden.props=[{id:'private-screen',type:'barrels',x:20,y:3,obstacleHeight:2,projectileResistance:1000,blocksSight:false,roomId:'unrevealed'}];
 const before=structuredClone(hidden),preview=state=>firearmFlightPreview(state,state.units[0],state.units[1],'head');
 assert.deepEqual(preview(hidden),preview(s));assert.deepEqual(firearmVolleyPreview(hidden,hidden.units[0],hidden.units[1],4,'head'),firearmVolleyPreview(s,u,target,4,'head'));
 assert.deepEqual(firearmBystanderRisk(hidden,hidden.units[0],hidden.units[1],'head'),firearmBystanderRisk(s,u,target,'head'));
 assert.doesNotMatch(JSON.stringify(preview(hidden)),/private-person|private-screen|Persona privada/);assert.deepEqual(hidden,before);
});

function resolvedMiss({stance='prone',x=13}={}){
 // A legal +2/0 miss offset preserves the original prone torso height. This
 // isolated receipt uses the physical engine; it is not a paid-route proof.
 const s=createBattle([{id:'p',x,y:3,stance,movementMode:stance==='prone'?'prone':'walk',weapon:1800,agility:75,wisdom:50,practiceSeed:0,skillPractice:{agility:39}}],{width:32,height:8,seed:1,tiles:tiles(32,8),upperSurfaces:[{id:'post',x:1,y:3,tacticalLevel:1,elevation:8,type:'floor',kind:'roof',blocked:false,cover:0}],enemies:[{id:'e',x:1,y:3,tacticalLevel:1,facing:2,weapon:1805,contentWeapon:definition('short-practice-pistol'),patrol:false,overwatch:false}]});
 const [target,attacker]=s.units,weapon=weaponFor(attacker),flight=projectileFlight({...s,units:[attacker]},attacker,{...target,x:15},weapon,'torso',{destinationHeight:.2});
 return {s,target,flight,event:{attacker,source:attacker,target,weapon,flight,hit:false,discharged:true,damagedBodies:new Set()}};
}

test('the exact fired curve rejects a false near miss manufactured by its ground-stop chord',()=>{
 const r=resolvedMiss(),before=structuredClone(r.s),model=r.flight.trajectoryModel,stop=r.flight.terminal;
 assert.equal(stop.termination,'ground');assert.ok(stop.impact.x>r.target.x);
 const fraction=(r.target.x-model.source.x)/(model.destination.x-model.source.x),curve=projectileTrajectoryPoint(model,fraction),chord=model.source.height+(stop.impact.height-model.source.height)*(r.target.x-model.source.x)/(stop.impact.x-model.source.x);
 assert.ok(chord>=0&&chord<.7,'the old stop chord passes beside the prone body');assert.ok(curve.height>.7,'the actual fired curve passes above its near-miss height margin');
 assert.equal(practiceFirearmNearMiss(r.s,r.event),0);assert.deepEqual(r.s,before);
 const stopped=resolvedMiss({x:14}),unchanged=structuredClone(stopped.s);assert.ok(stopped.flight.terminal.impact.x<stopped.target.x);assert.equal(practiceFirearmNearMiss(stopped.s,stopped.event),0);assert.deepEqual(stopped.s,unchanged);
});

test('one actual curve passage uses separate practice once and malformed metadata cannot fall back to a chord',()=>{
 const r=resolvedMiss({stance:'standing'}),before=structuredClone(r.s);assert.equal(practiceFirearmNearMiss(r.s,r.event),1);assert.equal(r.target.agility,76);assert.equal(r.s.seed,before.seed);assert.equal(r.target.hp,before.units[0].hp);assert.deepEqual(r.s.log,before.log);
 const learned=structuredClone(r.s);assert.equal(practiceFirearmNearMiss(r.s,r.event),0);assert.deepEqual(r.s,learned);
 for(const corrupt of [r=>{r.flight.trajectoryModel=null;},r=>{delete r.flight.trajectoryModel;},r=>{r.flight.terminal.fraction=NaN;},r=>{r.flight.terminal.impact.height+=.1;},r=>{r.flight.trajectoryModel.curvature=-1;}]){
  const bad=resolvedMiss({stance:'standing'});corrupt(bad);const before=structuredClone(bad.s);assert.equal(practiceFirearmNearMiss(bad.s,bad.event),0);assert.deepEqual(bad.s,before);
 }
});

test('a far paired order keeps its original head height after a real leg impact knocks the target down',()=>{
 // Finite predeclared authored pistols; no execution step refills either gun.
 const s=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1805,loaded:1,ammo:2,condition:100,marksmanship:100,contentWeapon:definition('first-pistol'),weaponInstanceId:'first-pistol',offHand:{weapon:1806,count:1,weight:1.3,loaded:1,condition:100,instanceId:'second-pistol',contentWeapon:definition('second-pistol',2,1806,38)}}],{width:28,height:8,seed:9,tiles:tiles(28,8),enemies:[{id:'e',x:15,y:3,patrol:false,overwatch:false,morale:100}]});
 const before=structuredClone(s),action={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'head'},shown=presentedActBattle(s,action),ordinary=actBattle(s,action);
 assert.equal(ordinary.lastError,null);assert.deepEqual(shown.state,ordinary);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),ordinary);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(ordinary))),ordinary);assert.deepEqual(s,before);
 assert.equal(ordinary.units[1].lastHitLocation,'legs');assert.equal(ordinary.units[1].knockedDown,true);assert.equal(ordinary.units[1].stance,'prone');assert.ok(ordinary.units[1].hp<s.units[1].hp);
 const discharges=shown.frames.filter(frame=>frame.type==='projectile'&&frame.shotVisual?.discharge!==false);assert.equal(discharges.length,2);assert.equal(discharges[0].state.units[1].hp,100);assert.equal(discharges[1].state.units[1].hp,ordinary.units[1].hp);
 const first=discharges[0].shotVisual,second=discharges[1].shotVisual;assert.equal(second.source.x,s.units[0].x);assert.equal(second.source.height,1.4);
 const frozen=projectileTrajectory(second.source,{...second.impact,height:1.6},{range:2,dropIncrement:COMBAT_BALANCE.firearmFarDropIncrement});close(second.impact.height,projectileTrajectoryPoint(frozen,1).height);
 const retargeted=projectileTrajectory(second.source,{...second.impact,height:.3},{range:2,dropIncrement:COMBAT_BALANCE.firearmFarDropIncrement});assert.ok(projectileTrajectoryPoint(retargeted,1).height<0,'retargeting to the changed prone head would stop this second ray early');
 assert.ok(first.impact.height<.6);assert.equal(ordinary.units[0].loaded,0);assert.equal(ordinary.units[0].offHand.loaded,0);assert.equal(ordinary.units[0].ammo,s.units[0].ammo);assert.equal(ordinary.units[0].condition,99);assert.equal(ordinary.units[0].offHand.condition,99);
 assert.equal(ordinary.units[0].ap,s.units[0].ap-actionCosts(s,s.units[0],s.units[1]).fire-4*actionCosts(s,s.units[0],s.units[1]).aim);assert.equal(ordinary.elapsedSeconds,6);
 for(const frame of shown.frames)if(frame.shotVisual){assert.equal(frame.shotVisual.trajectoryModel,undefined);assert.equal(frame.shotVisual.trajectory,undefined);}
});
