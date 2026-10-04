import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAINABLE_SKILLS,practice,trainingProgress,validateTraining} from '../game/skill-training.js';
import {studyForecast,studyRate} from '../game/study-training.js';
import {createBattle,actBattle,artilleryCosts,artilleryReloadPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('all classic trainable attributes and the two period adaptations have valid saved progress, while wisdom remains excluded',()=>{
 const classic=['strength','dexterity','agility','maxHp','marksmanship','medical','mechanical','leadership','explosives'];
 assert.deepEqual(new Set(TRAINABLE_SKILLS),new Set([...classic,'stealth','ridingSkill']));
 for(const skill of TRAINABLE_SKILLS){const u={side:'player',hp:60,[skill]:60};practice(u,skill,40);assert.equal(u[skill],61);assert.equal(u.trainedStats[skill],1);assert.doesNotThrow(()=>validateTraining(u));}
 assert.throws(()=>validateTraining({trainedStats:{wisdom:1}}));
});

test('zero aptitude, dead or opposing actors and completed work cannot create practice records',()=>{
 for(const change of [{medical:0},{hp:0},{side:'enemy'},{medical:100},{trainedStats:{medical:10}}]){
  const u={side:'player',hp:70,medical:60,...change},before=structuredClone(u);assert.equal(practice(u,'medical',40),0);assert.deepEqual(u,before);
 }
 for(const skill of TRAINABLE_SKILLS){const u={side:'player',hp:70,[skill]:0},before=structuredClone(u);practice(u,skill,40);assert.deepEqual(u,before);assert.equal(trainingProgress(u).find(p=>p.skill===skill).zero,true);}
});

test('invalid or empty practice is atomic and large awards preserve complete gains within both caps',()=>{
 for(const [skill,amount]of [['money',1],['medical',-1],['medical',.5],['medical',Infinity]]){const u={side:'player',hp:70,medical:60},before=structuredClone(u);assert.throws(()=>practice(u,skill,amount));assert.deepEqual(u,before);}
 const u={side:'player',hp:70,dexterity:60,skillPractice:{dexterity:39}};assert.equal(practice(u,'dexterity',80),2);assert.equal(u.dexterity,62);assert.equal(u.skillPractice.dexterity,39);
 u.trainedStats.dexterity=9;assert.equal(practice(u,'dexterity',80),1);assert.equal(u.trainedStats.dexterity,10);assert.doesNotThrow(()=>validateTraining(u));
 const high={side:'player',hp:70,strength:99};assert.equal(practice(high,'strength',1000),1);assert.equal(high.strength,100);
 const before=structuredClone(high);assert.equal(practice(high,'strength',0),0);assert.deepEqual(high,before);
});

test('health practice preserves the wound deficit without removing bleeding or bandages',()=>{
 const u={side:'player',hp:50,maxHp:80,bleeding:10,bandaged:20};practice(u,'maxHp',40);
 assert.equal(u.maxHp,81);assert.equal(u.hp,51);assert.equal(u.maxHp-u.hp,30);assert.equal(u.bleeding,10);assert.equal(u.bandaged,20);
});

test('study forecast counts productive hours, current fractional credit, skill changes and instructor speed',()=>{
 const op={mechanical:40,wisdom:50},r={trainingSkill:'mechanical',trainingCredit:900,skillPractice:{mechanical:35}},teacher={mechanical:80,wisdom:50};
 const solo=studyForecast(r,op,'mechanical'),paired=studyForecast(r,op,'mechanical',teacher);
 assert.equal(studyForecast({},op,'mechanical').hoursToNext,24);assert.equal(studyForecast({},op,'mechanical',teacher).hoursToNext,16);
 assert.equal(solo.hoursToNext,Math.ceil(4100/studyRate(op,'mechanical')));assert.ok(paired.hoursToNext<solo.hoursToNext);
 assert.equal(studyForecast({...r,trainingSkill:'medical'},op,'mechanical').hoursToNext,Math.ceil(5000/studyRate(op,'mechanical')));
 assert.ok(studyForecast({}, {mechanical:80,wisdom:50},'mechanical').hoursToNext>24);
 assert.equal(studyForecast({}, {mechanical:0},'mechanical').hoursToNext,null);assert.equal(studyForecast({trainedStats:{mechanical:10}},op,'mechanical').capped,true);assert.equal(studyForecast({},op,'wisdom'),null);
});

const field=(skill=50)=>createBattle([{id:'a',x:1,y:2,explosives:skill},{id:'b',x:2,y:2,explosives:skill},{id:'observer',x:8,y:2,explosives:skill}],{width:20,height:12,tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:18,y:10,patrol:false}],artillery:[{id:'gun',type:'bronze4',side:'player',x:2,y:3,loaded:false,ammo:3}]});
const reload=b=>actBattle(b,{type:'artilleryReload',unitId:'a',artilleryId:'gun'});

test('powder proficiency changes the shared cannon loading cost within a bounded period-game range',()=>{
 for(const [skill,expected]of [[0,66],[50,60],[100,54]]){const b=field(skill);assert.equal(artilleryCosts(b,b.units[0],b.artillery[0]).reload,expected);const p=artilleryReloadPreview(b,b.units[0],b.artillery[0]);assert.equal(p.totalPA,expected);const n=reload(b);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,100-expected);assert.equal(n.units[1].ap,100-expected);assert.equal(n.artillery[0].ammo,2);}
 const legacy=field();delete legacy.units[0].explosives;assert.equal(artilleryCosts(legacy,legacy.units[0],legacy.artillery[0]).reload,60);
});

test('only the paid participating crew learns from completed cannon loading and firing',()=>{
 let b=field(49);for(const u of b.units.filter(u=>u.side==='player')){u.skillPractice={explosives:39};u.practiceSeed=0;};
 const cost=artilleryReloadPreview(b,b.units[0],b.artillery[0]).pa;assert.equal(cost,61);b=reload(b);assert.equal(b.lastError,null);
 for(const u of b.units.slice(0,2)){assert.equal(u.explosives,50);assert.equal(u.trainedStats.explosives,1);assert.equal(u.ap,39);}
 assert.equal(b.units[2].skillPractice.explosives,39);assert.equal(b.units[2].explosives,49);assert.doesNotThrow(()=>validateBattleSnapshot(b));
 const rejected=reload(b);assert.ok(rejected.lastError);assert.deepEqual(rejected.units,b.units);
 b=actBattle(b,{type:'artillery',unitId:'a',artilleryId:'gun',x:9,y:3});assert.equal(b.lastError,null);assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].ammo,2);
 for(const u of b.units.slice(0,2))assert.equal(u.skillPractice.explosives,1);assert.equal(artilleryCosts(b,b.units[0],b.artillery[0]).reload,60);
});

test('partial loading, repeated empty actions and movement never award powder practice',()=>{
 const b=field();b.units[0].ap=10;b.units[1].ap=10;const partial=reload(b);assert.equal(partial.lastError,null);assert.ok(partial.artillery[0].reloadProgress>0);assert.equal(partial.artillery[0].loaded,false);
 assert.ok(partial.units.slice(0,2).every(u=>!u.skillPractice));const rejected=reload(partial);assert.ok(rejected.lastError);assert.deepEqual(rejected.units,partial.units);
 const moved=actBattle(field(),{type:'artilleryMove',unitId:'a',artilleryId:'gun',x:3,y:3});assert.equal(moved.lastError,null);assert.ok(moved.units.slice(0,2).every(u=>!u.skillPractice));
});

// Legacy tactical snapshots allow fractional attributes. The earned record
// must remain an integer even when the last point reaches the stat ceiling.
test('fractional legacy attributes reach the ceiling with a valid whole earned point',()=>{
 for(const skill of ['strength','maxHp']){
  const u={side:'player',hp:70,[skill]:99.5};assert.equal(practice(u,skill,40),1);assert.equal(u[skill],100);assert.equal(u.trainedStats[skill],1);assert.doesNotThrow(()=>validateTraining(u));
  if(skill==='maxHp')assert.equal(u.hp,70.5);
 }
 assert.equal(studyForecast({}, {strength:99.5},'strength').remainingGains,1);
});
