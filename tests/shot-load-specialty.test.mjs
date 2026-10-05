import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,weaponFor,actionCosts,firearmRangeProfile,firearmVolleyPreview,firearmShotOptions,shotChance} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {legacyCharacterAbilities} from '../game/character-abilities.js';
import {secondaryPistolView} from '../game/paired-fire.js';
import {ammoCount,totalAmmo} from '../game/ammo-types.js';
import {targetPreview} from '../game/ja2-hud.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';

const ability='scatter_concealment';
const player=s=>s.units.find(u=>u.side==='player');
const target=s=>s.units.find(u=>u.id==='e');
function field(patch={},options={},legacy=false){
 // Declared subsystem arena and finite stock; this is not a campaign reward.
 const unit={id:'p',x:1,y:3,facing:2,weapon:1800,ammunitionChoice:'ammoShot',loaded:1,ammo:2,condition:100,marksmanship:70,abilities:[ability],...patch};
 if(legacy)delete unit.abilities;
 return createBattle([unit],{width:18,height:8,seed:45,
  tiles:Array.from({length:144},(_,i)=>({x:i%18,y:Math.floor(i/18),type:'grass',blocked:false,cover:0,...(i===61?{concealment:18}:{})})),
  enemies:[{id:'e',x:7,y:3,weapon:1813,patrol:false,overwatch:false},{id:'reserve',x:16,y:6,weapon:1813,patrol:false,overwatch:false}],...options});
}
const plain=state=>{const s=structuredClone(state);player(s).abilities=[];return s;};
const withoutAbilities=state=>{const s=structuredClone(state);for(const u of s.units)delete u.abilities;return s;};
function execute(s,action={type:'fire',unitId:player(s).id,targetId:'e'}){
 const before=structuredClone(s),next=actBattle(s,action),presented=presentedActBattle(s,action);
 assert.equal(next.lastError,null,next.lastError);assert.deepEqual(s,before);assert.deepEqual(presented.state,next);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),next);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
 return {next,presented};
}
const profile=s=>firearmRangeProfile(s,player(s),target(s));
const forecast=s=>firearmVolleyPreview(s,player(s),target(s));
const definition=(template,pattern)=>{
 const w=structuredClone(defaultContentPackage().weapons.find(w=>w.template===template));
 w.alternativeLoads=[{family:'ammoShot',damage:22,range:8,pattern}];return weaponMetadata(w);
};

test('actual native ball selection removes pellet training without converting or granting finite rounds',()=>{
 let s=field({weapon:1807,ammunitionChoice:'ammoShot',ammo:4,ammunition:{ammoShot:2,ammoMusket:2}});
 assert.equal(weaponFor(player(s)).loadPattern,'cone');assert.equal(profile(s).apparentRange,9);
 const initial=totalAmmo(player(s))+player(s).loaded;
 for(const action of [{type:'unloadAmmunition'},{type:'selectAmmunitionLoad',family:'ammoMusket'},{type:'reload'}])s=execute(s,{unitId:'p',...action}).next;
 assert.equal(weaponFor(player(s)).loadPattern,'single');assert.equal(player(s).loaded,1);
 assert.equal(ammoCount(player(s),'ammoShot'),3);assert.equal(ammoCount(player(s),'ammoMusket'),1);
 assert.equal(totalAmmo(player(s))+player(s).loaded,initial);
 const control=plain(s);assert.deepEqual(profile(s),profile(control));assert.deepEqual(forecast(s),forecast(control));
 assert.ok(shotChance(s,player(s),target(s))>1&&shotChance(s,player(s),target(s))<95);
 const cost=actionCosts(s,player(s),target(s)).fire,{next}=execute(s),ordinary=execute(control).next;
 assert.deepEqual(withoutAbilities(next),withoutAbilities(ordinary));
 assert.equal(player(next).ap,player(s).ap-cost);assert.equal(player(next).loaded,0);
 assert.equal(totalAmmo(player(next))+player(next).loaded,initial-1);
 assert.equal(player(next).condition,player(s).condition-1);assert.equal(s.elapsedSeconds,6);
 assert.equal(next.elapsedSeconds,s.elapsedSeconds,'the preparation orders already paid this combat round');
 assert.ok(target(next).hp<target(s).hp);
});

test('native and authored pellet loads use the same specialty above forecast clamps and pay one real discharge',()=>{
 for(const patch of [{},{weaponMetadata:definition(1800,'cone')},{weapon:1807,ammunitionChoice:'ammoShot'},{weapon:1804,ammunitionChoice:'ammoShot'}]){
  const s=field(patch),control=plain(s),before=structuredClone(s);
  assert.equal(weaponFor(player(s)).loadPattern,'cone');assert.equal(profile(s).apparentRange,9);assert.equal(profile(control).apparentRange,12);
  const skilled=forecast(s).shots[0],untrained=forecast(control).shots[0];
  assert.equal(skilled.chance,92);assert.equal(untrained.chance,90);
  assert.ok(skilled.expectedDamage>untrained.expectedDamage);assert.equal(shotChance(s,player(s),target(s)),skilled.chance);
  assert.equal(firearmShotOptions(s,player(s),target(s),0).find(o=>o.hitLocation==='torso').chance,skilled.chance);
  assert.deepEqual(s,before,'read-only forecasts do not change seed, stock or stats');
  const cost=actionCosts(s,player(s),target(s)).fire,{next}=execute(s);
  assert.equal(player(next).ap,player(s).ap-cost);assert.equal(player(next).loaded,0);assert.equal(totalAmmo(player(next)),totalAmmo(player(s)));
  assert.equal(player(next).condition,99);assert.equal(next.elapsedSeconds,6);assert.equal(next.smoke.length,1);
  assert.ok(target(next).hp<target(s).hp);assert.equal(player(next).hp,player(s).hp);
 }
});

test('an authored single ray using the shot ammunition family remains neutral and clear targets give no specialty benefit',()=>{
 const single=field({weaponMetadata:definition(1800,'single')}),control=plain(single);
 assert.equal(weaponFor(player(single)).loadPattern,'single');assert.equal(player(single).ammunitionChoice,'ammoShot');
 assert.deepEqual(profile(single),profile(control));assert.deepEqual(forecast(single),forecast(control));
 assert.deepEqual(withoutAbilities(execute(single).next),withoutAbilities(execute(control).next));
 const clear=field({}, {tiles:Array.from({length:144},(_,i)=>({x:i%18,y:Math.floor(i/18),type:'grass',blocked:false,cover:0}))}),clearControl=plain(clear);
 assert.deepEqual(profile(clear),profile(clearControl));assert.deepEqual(forecast(clear),forecast(clearControl));
 assert.deepEqual(withoutAbilities(execute(clear).next),withoutAbilities(execute(clearControl).next));
});

test('legacy identity fallback and explicit authored omission retain their distinct ability admission for the selected load',()=>{
 const legacy=field({id:6}, {},true),explicit=field({id:6,abilities:legacyCharacterAbilities(6)}),omitted=field({id:6,abilities:[]});
 assert.deepEqual(profile(legacy),profile(explicit));assert.deepEqual(forecast(legacy),forecast(explicit));
 assert.equal(profile(legacy).apparentRange,9);assert.equal(profile(omitted).apparentRange,12);
 const ball=field({id:6,weapon:1807,ammunitionChoice:'ammoMusket'}, {},true);
 const ballControl=field({id:6,weapon:1807,ammunitionChoice:'ammoMusket',abilities:legacyCharacterAbilities(6).filter(a=>a!==ability)});
 assert.deepEqual(profile(ball),profile(ballControl));assert.deepEqual(forecast(ball),forecast(ballControl));
});

test('paired hand views train only their own selected pellet load while preserving original finite pair costs',()=>{
 const metadata=definition(1806,'cone');
 const offHand={weapon:1806,count:1,weight:metadata.contentWeapon.weight,loaded:1,condition:100,jammed:false,instanceId:'second',ammunitionChoice:'ammoShot',weaponMetadata:metadata};
 const s=field({weapon:1805,ammunitionChoice:'ammoPistol',offHand}),control=plain(s),trained=forecast(s),untrained=forecast(control);
 assert.equal(trained.paired,true);assert.deepEqual(trained.shots[0],untrained.shots[0]);assert.equal(trained.shots[0].chance,36);
 assert.equal(trained.shots[1].chance,88);assert.equal(untrained.shots[1].chance,86);
 assert.equal(firearmRangeProfile(s,secondaryPistolView(player(s)),target(s)).apparentRange,9);
 assert.equal(profile(s).apparentRange,12);
 const cost=actionCosts(s,player(s),target(s)).fire,{next}=execute(s);
 assert.equal(player(next).ap,player(s).ap-cost);assert.equal(player(next).loaded,0);assert.equal(player(next).offHand.loaded,0);
 assert.equal(player(next).condition,99);assert.equal(player(next).offHand.condition,99);assert.equal(player(next).offHand.instanceId,'second');
 assert.equal(player(next).ammo,player(s).ammo);assert.equal(next.elapsedSeconds,6);assert.equal(next.smoke.length,2);
 assert.ok(target(next).hp<target(s).hp);
});

test('private bodies and cover do not change specialty forecasts, risk or public projectile metadata',()=>{
 const s=field(),hidden=field({}, {npcs:[{id:'secret',name:'Habitante secreto',x:4,y:3,hp:100,roomId:'unrevealed'}],props:[{id:'private-cover',type:'barrels',x:4,y:3,blocksSight:false,obstacleHeight:2,projectileResistance:1000,roomId:'unrevealed'}]});
 assert.deepEqual(forecast(hidden),forecast(s));assert.deepEqual(firearmShotOptions(hidden,player(hidden),target(hidden),0),firearmShotOptions(s,player(s),target(s),0));
 assert.deepEqual(targetPreview(hidden,player(hidden),target(hidden),{mode:'fire'}),targetPreview(s,player(s),target(s),{mode:'fire'}));
 assert.deepEqual(firearmBystanderRisk(hidden,player(hidden),target(hidden)),firearmBystanderRisk(s,player(s),target(s)));
 const clear=execute(s),privateResult=execute(hidden);
 assert.deepEqual(privateResult.presented.frames.filter(f=>f.shotVisual).map(f=>f.shotVisual),clear.presented.frames.filter(f=>f.shotVisual).map(f=>f.shotVisual));
 assert.ok(privateResult.presented.frames.every(f=>!f.impacts.some(i=>i.unitId==='secret')));
 assert.doesNotMatch(privateResult.next.log.join(' '),/Habitante secreto|private-cover/);
 assert.equal(player(privateResult.next).ap,player(clear.next).ap);assert.equal(player(privateResult.next).loaded,0);
 assert.equal(privateResult.next.elapsedSeconds,clear.next.elapsedSeconds);
});
