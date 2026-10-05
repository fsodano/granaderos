import test from 'node:test';
import assert from 'node:assert/strict';
import {projectileEnergyJ,projectileLaunchImpact,kineticNominalImpact} from '../game/projectile-energy.js';
import {projectileFlight,projectilePath} from '../game/projectile-cover.js';
import {projectileTrajectoryLength} from '../game/projectile-trajectory.js';
import {shotLoadFlight,shotLoadForecast,shotLoadChance} from '../game/shot-load.js';
import {penetratingFirearmDamage} from '../game/combat-balance.js';
import {createBattle,actBattle,presentedActBattle,weaponFor,actionCosts,firearmVolleyPreview,firearmFlightPreview,firearmShotOptions} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {secondaryPistolView} from '../game/paired-fire.js';
import {fieldPractice} from '../game/skill-training.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {targetPreview} from '../game/ja2-hud.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const energy=(massGrams,muzzleVelocityMps)=>({model:'kinetic-energy-v1',massGrams,muzzleVelocityMps});
const flat=(width=32,height=16)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const enemy=(id,x,y,extra={})=>({id,name:id,x,y,weapon:1813,hp:100,maxHp:100,morale:100,patrol:false,overwatch:false,...extra});
const body=(s,id='p')=>s.units.find(u=>u.id===id);
const shot={type:'fire',unitId:'p',targetId:'e',aim:4,hitLocation:'torso'};
function definition(profile,template=1805,extra={}){
 const w=structuredClone(defaultContentPackage().weapons.find(w=>w.template===template));
 // Prepared subsystem content: omit distance tuning so each energy comparison
 // isolates launch force. This fixture is not earned campaign equipment.
 delete w.materialRangeSlope;delete w.projectileEnergy;
 for(const load of w.alternativeLoads??[]){delete load.materialRangeSlope;delete load.projectileEnergy;}
 if(profile!==undefined)w.projectileEnergy=profile;
 return {...w,...extra};
}
function field(profile,patch={},scene={}){
 return createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1805,weaponMetadata:weaponMetadata(definition(profile)),loaded:1,ammo:2,condition:100,marksmanship:80,dexterity:100,wisdom:100,practiceSeed:0,skillPractice:{marksmanship:0},abilities:[],...patch}],{
  width:32,height:16,tiles:flat(),seed:45,hour:12,deferContact:true,
  enemies:[enemy('e',6,3),enemy('reserve',28,12)],...scene});
}
function execute(s,action=shot){
 const before=structuredClone(s),next=actBattle(s,action),shown=presentedActBattle(s,action);
 assert.equal(next.lastError,null,next.lastError);assert.deepEqual(s,before);
 assert.deepEqual(shown.state,next);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),next);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
 return {next,shown};
}
function paidShot(s,next,action=shot,count=1){
 const u=body(s),n=body(next),cost=actionCosts(s,u,action.type==='firePoint'?action:body(s,action.targetId));
 assert.equal(n.ap,u.ap-cost.fire-(action.aim??0)*cost.aim);
 assert.equal(n.loaded,0);assert.equal(n.ammo,u.ammo);assert.equal(n.condition,99);
 assert.equal(next.elapsedSeconds,6);assert.equal(next.smoke.length,count);
 assert.equal(n.hp,u.hp);assert.equal(n.medkits,u.medkits);
}
function withoutEnergy(value){
 if(Array.isArray(value))return value.map(withoutEnergy);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='projectileEnergy').map(([key,child])=>[key,withoutEnergy(child)]));
 return value;
}
function pureScene(){return {width:32,height:16,tiles:flat(),units:[{id:'p',side:'player',x:1,y:3,hp:100}],npcs:[],props:[],seed:45};}
const pureWeapon=(profile,extra={})=>({id:1805,damage:42,range:8,loadPattern:'single',...(profile?{projectileEnergy:profile}:{}),...extra});
const point={x:10,y:3,stance:'standing'};

test('mass and velocity change actual injury, while equal energies retain identical paid near-shot outcomes',()=>{
 const profiles={lighter:energy(2.5,200),base:energy(5,200),heavier:energy(10,200),slower:energy(5,100),faster:energy(5,400),equal:energy(20,100)};
 const powers={lighter:2.5,base:5,heavier:10,slower:1.25,faster:20,equal:5},results={};
 for(const [key,profile]of Object.entries(profiles)){
  close(projectileEnergyJ(profile),powers[key]*20);close(projectileLaunchImpact(pureWeapon(profile)),powers[key]);
  const s=field(profile),before=structuredClone(s),preview=firearmFlightPreview(s,body(s),body(s,'e'));
  close(preview.bodyImpacts[0].incomingImpact,powers[key]);close(preview.damageFactor,powers[key]/42);
  assert.deepEqual(s,before,'geometry and forecasts spend no RNG or resources');
  results[key]=execute(s).next;paidShot(s,results[key]);assert.ok(body(results[key],'e').hp<100);
 }
 const loss=key=>100-body(results[key],'e').hp;
 assert.ok(loss('lighter')<loss('base'));assert.ok(loss('slower')<loss('base'));
 assert.ok(loss('heavier')>loss('base'));assert.ok(loss('faster')>loss('heavier'));
 assert.deepEqual(withoutEnergy(results.equal),withoutEnergy(results.base),'equal launch energy gives the same actual damage, effects, practice, seed and cost');
});

test('high energy supplies penetration without raising the authored nominal injury cap or changing paid discharge costs',()=>{
 const high=field(energy(20,600)),legacy=field(),weak=field(energy(5,200));
 const hi=execute(high).next,old=execute(legacy).next,low=execute(weak).next;
 paidShot(high,hi);paidShot(legacy,old);paidShot(weak,low);
 assert.equal(body(hi,'e').hp,body(old,'e').hp,'the original .8..1.2 damage draw remains bounded by authored nominal damage');
 assert.ok(body(low,'e').hp>body(hi,'e').hp);
 const impact=firearmFlightPreview(high,body(high),body(high,'e')).bodyImpacts[0],w=weaponFor(body(high));
 assert.equal(impact.incomingImpact,180);assert.equal(impact.damageFactor,1);assert.equal(kineticNominalImpact(w,impact),42);
 assert.equal(penetratingFirearmDamage(42,impact,1,w),42);
 const cover=field(energy(20,600),{}, {props:[{id:'wood',type:'chest',x:4,y:3,obstacleHeight:2}]});
 const protectedResult=execute(cover).next;assert.equal(body(protectedResult,'e').hp,body(hi,'e').hp,'surplus energy can pay cover while remaining nominal injury is capped');
 const insufficient=field(energy(5,400),{}, {props:[{id:'wood',type:'chest',x:4,y:3,obstacleHeight:2}]});
 assert.equal(execute(insufficient).next.units.find(u=>u.id==='e').hp,100,'the weak launch exhausts its own force in wood');
});

test('a rounded-zero ball pays a real shot but cannot injure, redirect a bodyguard or earn contact practice',()=>{
 const profile=energy(.1,25),s=field(profile,{}, {enemies:[enemy('e',6,3,{leadership:95}),enemy('guard',6,4,{abilities:['bodyguard']}),enemy('reserve',28,12)]});
 const {next,shown}=execute(s);paidShot(s,next);
 for(const id of ['e','guard'])for(const key of ['hp','energy','bleeding','shock','morale','ap','stance','knockedDown','lastHitLocation','interceptTurn'])assert.deepEqual(body(next,id)[key],body(s,id)[key],`${id}.${key}`);
 assert.deepEqual(shown.frames.flatMap(frame=>frame.impacts),[]);assert.doesNotMatch(next.log.join(' '),/se interpone|hiere a/);
 const expected=structuredClone(body(s));fieldPractice(expected,'marksmanship',2);
 assert.equal(body(next).practiceSeed,expected.practiceSeed);assert.deepEqual(body(next).skillPractice,expected.skillPractice);
 const pointAction={type:'firePoint',unitId:'p',x:6,y:3,aim:4};
 const civilian=field(profile,{}, {enemies:[enemy('reserve',28,12)],npcs:[{id:'resident',name:'Vecino',x:6,y:3,hp:100}]}),empty=field(profile,{}, {enemies:[enemy('reserve',28,12)]});
 const civil=execute(civilian,pointAction).next,miss=execute(empty,pointAction).next;
 for(const key of ['hp','energy','bleeding','lastHitLocation','knockedDown','civilianHarm'])assert.deepEqual(civil.npcs[0][key],civilian.npcs[0][key],`civilian.${key}`);
 assert.equal(body(civil).practiceSeed,body(miss).practiceSeed);assert.deepEqual(body(civil).skillPractice,body(miss).skillPractice,'only the ordinary paid-shot learning remains');
 paidShot(civilian,civil,pointAction);
});

test('nine rounded-zero contacts aggregate without false injury, bodyguard AP loss or extra contact learning',()=>{
 const w=definition(undefined,1807,{alternativeLoads:[],projectileEnergy:energy(.1,25)});
 const s=field(undefined,{weapon:1807,ammunitionChoice:'ammoShot',weaponMetadata:weaponMetadata(w)}, {enemies:[enemy('e',2,3,{leadership:95}),enemy('guard',2,4,{abilities:['bodyguard']}),enemy('reserve',28,12)]});
 const trace=shotLoadFlight(s,body(s),body(s,'e'),weaponFor(body(s)));assert.equal(trace.bodyImpacts.length,9);
 const {next,shown}=execute(s);paidShot(s,next);
 for(const id of ['e','guard'])for(const key of ['hp','energy','bleeding','shock','morale','ap','lastHitLocation','interceptTurn'])assert.deepEqual(body(next,id)[key],body(s,id)[key],`${id}.${key}`);
 assert.deepEqual(shown.frames.flatMap(frame=>frame.impacts),[]);
 const expected=structuredClone(body(s));fieldPractice(expected,'marksmanship',2);
 assert.equal(body(next).practiceSeed,expected.practiceSeed);assert.deepEqual(body(next).skillPractice,expected.skillPractice);
});

test('merged material depth and successive typed bodies spend the launch budget in physical order',()=>{
 const s=pureScene();s.props=[{id:'wood',type:'chest',x:4,y:3,obstacleHeight:2}];s.units.push({id:'front',side:'enemy',x:7,y:3,hp:100});
 const w=pureWeapon(energy(20,400)),before=structuredClone(s);let rolls=0;
 const f=projectileFlight(s,s.units[0],point,w,'torso',{resolveBody:()=>{rolls++;return true;}});
 assert.deepEqual(s,before);assert.equal(rolls,1);assert.equal(f.obstacles.length,1);assert.equal(f.bodyImpacts.length,1);
 const cover=f.obstacles[0],hit=f.bodyImpacts[0],depth=Math.hypot(1,.3/9);
 close(cover.resistance,24*depth);close(hit.incomingImpact,80-cover.resistance);assert.equal(hit.bodyResistance,30);
 close(hit.remainingImpact,80-cover.resistance-30);close(f.terminal.remainingImpact,80-cover.resistance-30);
 close(cover.resistance+hit.bodyResistance+f.terminal.remainingImpact,80);
 const coverOnly=projectilePath(s,s.units[0],point,w);assert.equal(coverOnly.damageFactor,1,'cover-only remaining energy still exceeds nominal damage');
 s.npcs.push({id:'front',name:'Otro cuerpo',x:9,y:3,hp:100});
 const two=projectileFlight(s,s.units[0],point,w);assert.deepEqual(two.bodyImpacts.map(h=>[h.victimKind,h.victimId]),[['unit','front'],['npc','front']]);
 const second=two.bodyImpacts[1];close(second.incomingImpact,80-cover.resistance-30);
 close(kineticNominalImpact(w,second),second.incomingImpact);close(penetratingFirearmDamage(42,second,1,w),second.incomingImpact);
 assert.equal(penetratingFirearmDamage(42,second,0,w),42,'cover tuning may restore cover loss but cannot restore the first body cost');
});

test('reflection and cover have separate kinetic debits, exact arc exhaustion and no extra geometry RNG',()=>{
 const s=pureScene(),w=pureWeapon(energy(20,400),{damage:100,range:22}),aim={x:10,y:5,stance:'standing'};
 Object.assign(s.tiles.find(t=>t.x===8&&t.y===5),{type:'wall',blocked:true,blocksSight:false,material:'stone'});
 s.props=[{id:'prior-wood',type:'chest',x:4,y:4,obstacleHeight:2,projectileResistance:5}];s.npcs=[{id:'later',name:'Después',x:12,y:4,hp:100}];
 const before=structuredClone(s),f=projectileFlight(s,s.units[0],aim,w);assert.deepEqual(s,before);assert.equal(f.ricochets.length,1);
 const cover=f.obstacles.find(o=>o.sourceId==='prop:prior-wood'),bounce=f.ricochets[0],hit=f.bodyImpacts[0];assert.ok(cover.resistance>0);
 close(bounce.incomingImpact,80-cover.resistance);close(bounce.remainingImpact,bounce.incomingImpact*.5);close(hit.incomingImpact,bounce.remainingImpact);
 const reflectionLoss=bounce.incomingImpact-bounce.remainingImpact;
 close(80,cover.resistance+reflectionLoss+hit.incomingImpact);
 close(kineticNominalImpact(w,hit,1,0),80-reflectionLoss);assert.ok(kineticNominalImpact(w,hit,1,0)<80,'cover tuning cannot refund reflection');
 const blocked=pureScene();blocked.props=[{id:'deep',type:'chest',x:4,y:3,footprint:{width:3,height:1},obstacleHeight:2}];blocked.units.push({id:'beyond',side:'enemy',x:7,y:3,hp:100});
 const small=pureWeapon(energy(5,400)),stop=projectileFlight(blocked,blocked.units[0],point,small);assert.equal(stop.bodyImpacts.length,0);assert.equal(stop.terminal.remainingImpact,0);assert.equal(stop.obstacles[0].resistance,20);
 const horizontal=Math.hypot(point.x-1,point.y-3),entry=2.5/horizontal,end=(stop.terminal.impact.x-1)/horizontal;
 const ray=projectileFlight(pureScene(),blocked.units[0],point,small,'torso',{maxDistance:horizontal});
 // Before the 2R onset this is a straight sloping ray; the exhaustion point
 // pays 20/24 actual 3D cells, not one cover charge or a selected aim cell.
 close(Math.hypot(stop.terminal.impact.x-3.5,stop.terminal.impact.height-(1.4-.3*2.5/9)),20/24);
 assert.ok(end>entry&&end<5.5/horizontal);assert.equal(ray.obstacles.length,0);
});

test('kinetic force changes exact curved material exhaustion without changing drop, effective range or air-only endpoints',()=>{
 const s=pureScene(),aim={x:11,y:3,stance:'standing'},weak=pureWeapon(energy(5,400),{range:3}),strong=pureWeapon(energy(20,400),{range:3}),legacy=pureWeapon(undefined,{range:3});
 const air=[weak,strong,legacy].map(w=>projectileFlight(s,s.units[0],aim,w));
 for(const f of air){assert.equal(f.terminal.termination,'range');close(f.terminal.impact.x,11);close(f.terminal.impact.height,1.1-.1*4**2/12);}
 assert.deepEqual(air[0].trajectoryModel,air[1].trajectoryModel);assert.deepEqual(air[0].trajectoryModel,air[2].trajectoryModel);
 s.props=[{id:'far-wood',type:'chest',x:9,y:3,footprint:{width:3,height:1},obstacleHeight:2}];
 const before=structuredClone(s),stopped=projectileFlight(s,s.units[0],aim,weak),continued=projectileFlight(s,s.units[0],aim,strong);
 assert.deepEqual(s,before);assert.equal(stopped.terminal.termination,'prop');assert.equal(stopped.terminal.remainingImpact,0);assert.equal(stopped.obstacles[0].resistance,20);
 assert.equal(continued.terminal.termination,'range');assert.equal(continued.obstacles.length,1);assert.ok(continued.terminal.remainingImpact>0);
 const entry=(8.5-1)/10;
 close(projectileTrajectoryLength(stopped.trajectoryModel,entry,stopped.terminal.fraction),20/24);
 close(continued.obstacles[0].resistance,24*projectileTrajectoryLength(continued.trajectoryModel,entry,1));
 close(continued.obstacles[0].resistance+continued.terminal.remainingImpact,80);
});

test('nine pellets divide total mass, joules and launch force exactly while each recipient injury keeps its authored share',()=>{
 const s=pureScene();s.units.push({id:'e',side:'enemy',x:2,y:3,hp:100});
 const w=pureWeapon(energy(20,400),{id:1807,damage:42,range:10,loadPattern:'cone'}),before=structuredClone(s),f=shotLoadFlight(s,s.units[0],s.units[1],w);
 assert.deepEqual(s,before);assert.equal(f.pellets.length,9);assert.equal(f.totalForce,42,'this is the injury budget, not nine full launches');
 assert.equal(f.pellets.reduce((n,p)=>n+p.weight,0),1);assert.equal(f.pellets.reduce((n,p)=>n+p.massGrams,0),20);
 assert.equal(f.pellets.reduce((n,p)=>n+p.energyJ,0),1600);assert.equal(f.pellets.reduce((n,p)=>n+p.launchImpact,0),80);
 assert.equal(f.bodyImpacts.length,9);
 for(const pellet of f.pellets){const hit=pellet.flight.bodyImpacts[0];close(hit.incomingImpact,pellet.launchImpact);close(kineticNominalImpact(w,hit,pellet.weight),42*pellet.weight);assert.ok(pellet.launchImpact<80);assert.equal(hit.continued,false);}
 const forecast=shotLoadChance(shotLoadForecast(s,s.units[0],s.units[1],w),95);assert.ok(forecast.expectedForce>0&&forecast.expectedForce<=42);
 const authored=definition(energy(20,400),1807,{alternativeLoads:[]}),plain=definition(undefined,1807,{alternativeLoads:[]});
 const actual=field(undefined,{weapon:1807,ammunitionChoice:'ammoShot',weaponMetadata:weaponMetadata(authored)}, {enemies:[enemy('e',2,3),enemy('reserve',28,12)]});
 const control=field(undefined,{weapon:1807,ammunitionChoice:'ammoShot',weaponMetadata:weaponMetadata(plain)}, {enemies:[enemy('e',2,3),enemy('reserve',28,12)]});
 const a=execute(actual).next,b=execute(control).next;paidShot(actual,a);
 assert.equal(body(a,'e').hp,body(b,'e').hp,'higher total energy cannot multiply injury by nine');
 assert.equal(body(a).practiceSeed,body(b).practiceSeed);assert.deepEqual(body(a).skillPractice,body(b).skillPractice);
});

test('a paired ball and pellet load use their own selected kinetic profiles and retain exact finite hand custody',()=>{
 const primary=definition(energy(5,200),1805),other=definition(energy(20,600),1806,{alternativeLoads:[{family:'ammoShot',damage:36,range:6,pattern:'cone',projectileEnergy:energy(20,400)}]});
 const otherMetadata=weaponMetadata(other),offHand={weapon:1806,count:1,weight:otherMetadata.contentWeapon.weight,loaded:1,condition:100,jammed:false,instanceId:'second-pistol',ammunitionChoice:'ammoShot',weaponMetadata:otherMetadata};
 const s=field(undefined,{weaponMetadata:weaponMetadata(primary),traits:['ambidextrous'],offHand}, {enemies:[enemy('e',3,3),enemy('reserve',28,12)]}),u=body(s),off=secondaryPistolView(u),preview=firearmVolleyPreview(s,u,body(s,'e'),4);
 assert.equal(projectileLaunchImpact(weaponFor(u)),5);assert.equal(projectileLaunchImpact(weaponFor(off)),80,'the selected alternative cannot inherit the other pistol’s primary energy');
 assert.equal(weaponFor(off).range,6);assert.equal(weaponFor(off).damage,36);assert.equal(preview.paired,true);close(preview.shots[0].damageFactor,5/42);assert.ok(preview.shots[1].expectedForce>0&&preview.shots[1].expectedForce<=36);
 const pellets=shotLoadFlight(s,off,body(s,'e'),weaponFor(off));assert.equal(pellets.pellets.reduce((sum,p)=>sum+p.launchImpact,0),80);
 const {next}=execute(s);paidShot(s,next,shot,2);assert.ok(body(next,'e').hp<100);assert.equal(body(next).offHand.loaded,0);assert.equal(body(next).offHand.condition,99);
 assert.equal(body(next).offHand.instanceId,'second-pistol');assert.deepEqual(body(next).offHand.weaponMetadata,offHand.weaponMetadata);assert.deepEqual(body(next).ammunition,u.ammunition);
});

test('omitted primary and alternative profiles preserve legacy flights, damage arithmetic and exact selected-load execution',()=>{
 const s=pureScene();s.units.push({id:'e',side:'enemy',x:6,y:3,hp:100});const w=pureWeapon(),f=projectileFlight(s,s.units[0],s.units[1],w);
 assert.equal(projectileLaunchImpact(w),42);assert.equal(f.bodyImpacts[0].incomingImpact,42);assert.equal(f.bodyImpacts[0].damageFactor,1);
 assert.deepEqual(projectileFlight(s,s.units[0],s.units[1],{...w,projectileEnergy:undefined}),f);
 const legacyImpact={coverDamageFactor:.7,bodyDamageReduction:.2,ricochetDamageReduction:.1};close(penetratingFirearmDamage(42,legacyImpact),42*.4);close(penetratingFirearmDamage(42,legacyImpact,0),42*.7);
 const selected={family:'ammoShot',damage:22,range:6,pattern:'cone'},newPrimary=definition(energy(20,600),1805,{alternativeLoads:[selected]}),oldPrimary=definition(undefined,1805,{alternativeLoads:[selected]});
 const opted=field(undefined,{ammunitionChoice:'ammoShot',weaponMetadata:weaponMetadata(newPrimary)}),old=field(undefined,{ammunitionChoice:'ammoShot',weaponMetadata:weaponMetadata(oldPrimary)});
 assert.equal(weaponFor(body(opted)).projectileEnergy,undefined);assert.deepEqual(firearmVolleyPreview(opted,body(opted),body(opted,'e'),4),firearmVolleyPreview(old,body(old),body(old,'e'),4));
 const a=execute(opted).next,b=execute(old).next;assert.deepEqual(withoutEnergy(a),withoutEnergy(b));
 const pellet=shotLoadFlight(old,body(old),body(old,'e'),weaponFor(body(old))).pellets[0];assert.equal(Object.hasOwn(pellet,'massGrams'),false);assert.equal(Object.hasOwn(pellet,'energyJ'),false);assert.equal(Object.hasOwn(pellet,'launchImpact'),false);
});

test('private material cannot alter public kinetic forecasts or flight when real passage changes but known injury does not',()=>{
 const profile=energy(20,400),clear=field(profile),hidden=field(profile,{}, {props:[{id:'private-cover',type:'chest',x:4,y:3,blocksSight:false,obstacleHeight:2,projectileResistance:30,roomId:'unrevealed'}]});
 const before=structuredClone(hidden),preview=s=>firearmVolleyPreview(s,body(s),body(s,'e'),4);
 assert.deepEqual(preview(hidden),preview(clear));assert.deepEqual(firearmShotOptions(hidden,body(hidden),body(hidden,'e')),firearmShotOptions(clear,body(clear),body(clear,'e')));
 assert.deepEqual(targetPreview(hidden,body(hidden),body(hidden,'e'),{mode:'fire'}),targetPreview(clear,body(clear),body(clear,'e'),{mode:'fire'}));
 assert.deepEqual(firearmBystanderRisk(hidden,body(hidden),body(hidden,'e')),firearmBystanderRisk(clear,body(clear),body(clear,'e')));assert.deepEqual(hidden,before);
 const a=execute(hidden),b=execute(clear);paidShot(hidden,a.next);
 assert.equal(body(a.next,'e').hp,body(b.next,'e').hp,'both contacts retain the same capped injury while private cover changes actual passage');assert.ok(body(b.next,'e').hp<100);
 const visuals=result=>result.shown.frames.filter(frame=>frame.shotVisual).map(frame=>({type:frame.type,action:frame.action,unitId:frame.unitId,visibleIds:frame.visibleIds,impacts:frame.impacts,targetPoint:frame.targetPoint,shotVisual:frame.shotVisual,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)}));
 assert.deepEqual(visuals(a),visuals(b));assert.ok(a.shown.frames.every(frame=>!frame.impacts.some(i=>i.unitId==='private')));assert.doesNotMatch(a.next.log.join(' '),/Persona secreta|private-cover/);
});

test('a private body changes actual weak-ball shielding without disclosing its geometry, timing or camera focus',()=>{
 const profile=energy(5,200),clear=field(profile),hidden=field(profile,{}, {npcs:[{id:'private',name:'Persona secreta',x:4,y:3,hp:100,roomId:'unrevealed'}]});
 assert.deepEqual(firearmVolleyPreview(hidden,body(hidden),body(hidden,'e'),4),firearmVolleyPreview(clear,body(clear),body(clear,'e'),4));
 assert.deepEqual(firearmBystanderRisk(hidden,body(hidden),body(hidden,'e')),firearmBystanderRisk(clear,body(clear),body(clear,'e')));
 const a=execute(hidden),b=execute(clear);paidShot(hidden,a.next);
 assert.equal(body(a.next,'e').hp,100);assert.ok(body(b.next,'e').hp<100);assert.ok(a.next.npcs[0].hp<100);
 const flights=result=>result.shown.frames.filter(frame=>frame.type==='projectile').map(frame=>({type:frame.type,action:frame.action,unitId:frame.unitId,visibleIds:frame.visibleIds,targetPoint:frame.targetPoint,geometry:{source:frame.shotVisual?.source,impact:frame.shotVisual?.impact,spread:frame.shotVisual?.spread,discharge:frame.shotVisual?.discharge,material:frame.shotVisual?.material},duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)}));
 assert.deepEqual(flights(a),flights(b),'known HP can differ; projectile geometry, flight duration and focus cannot disclose the private body');
 assert.ok(a.shown.frames.every(frame=>!frame.impacts.some(i=>i.unitId==='private')));assert.doesNotMatch(a.next.log.join(' '),/Persona secreta/);
});
