import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {actBattle,actionCosts,canSee,teamCanSee,hasLineOfSight,getReachable,movementEnergy} from '../game/tactical.js';
import {sameCell,surfaceAt} from '../game/tactical-space.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {combatOrder} from './opening-driver.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-cordoba-shared-sighting.provenance.json',import.meta.url),'utf8'));
const bytes=readFileSync(new URL('./fixtures/opening-cordoba-shared-sighting.json.gz',import.meta.url));
assert.equal(bytes.length,provenance.fixture.bytes);assert.equal(digest(bytes),provenance.fixture.sha256);
const decoded=gunzipSync(bytes);
assert.equal(decoded.length,provenance.fixture.decodedBytes);assert.equal(digest(decoded),provenance.fixture.decodedSha256);
const fixture=JSON.parse(decoded);
const record=(name,value)=>{
 const directory=process.env.GRANADEROS_OPENING_CONTROL_DIR;if(!directory)return;
 mkdirSync(directory,{recursive:true});writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n');
};
const witness=()=>{
 const battle=structuredClone(fixture.battle),unit=battle.units.find(u=>u.id===fixture.unit.id);
 assert.deepEqual(unit,fixture.unit);
 assert.deepEqual({sector:battle.sectorId,turn:battle.turn,phase:battle.phase,mode:battle.mode,elapsed:battle.elapsedSeconds},
  {sector:'cordoba',turn:1,phase:'player',mode:'combat',elapsed:21});
 assert.deepEqual({id:unit.id,x:unit.x,y:unit.y,hp:unit.hp,bleeding:unit.bleeding,stance:unit.stance,ap:unit.ap,loaded:unit.loaded,ammo:unit.ammo,energy:unit.energy},
  {id:'124',x:63,y:27,hp:85,bleeding:0,stance:'prone',ap:78,loaded:1,ammo:9,energy:76});
 const sighting=battle.units.find(u=>u.id==='enemy-8');
 assert.deepEqual(fixture.sharedContacts,[sighting]);
 assert.equal(sighting.hp,46);assert.equal(canSee(battle,unit,sighting),false);
 assert.equal(teamCanSee(battle,unit.side,sighting),true);assert.equal(hasLineOfSight(battle,unit,sighting),true);
 assert.equal(unit.lastKnownEnemy??null,null);assert.equal(unit.lastHeardNoise??null,null);assert.equal(unit.patrolOrigin??null,null);
 assert.equal(fixture.automatic,null);assert.equal(provenance.capture.controllerReturnValue,null);
 return {battle,unit,sighting};
};

test('the actual post-prone Cordoba witness retains the original native personal-sight null',()=>{
 const {battle,unit}=witness(),original=structuredClone(battle);
 const automatic=chooseEnemyAction(battle,unit);
 record('original-native-null-control.json',{before:battle,automatic,nativeChooserInvocations:1,nativeActionInvocations:0});
 assert.deepEqual(automatic,fixture.automatic);
 assert.deepEqual(battle,original,'the native chooser does not change the raw witness');
});

test('the actual shared sighting admits one finite native investigation move while the soldier stays prone',()=>{
 const {battle,unit}=witness(),original=structuredClone(battle);
 let action,path,after,failure,nativeActionInvocations=0;
 try{
  action=combatOrder(battle,unit);
  assert.deepEqual(battle,original,'shared investigation cannot write remembered contact or equipment');
  assert.equal(action?.type,'move');assert.equal(action.unitId,unit.id);
  const observed=point=>teamCanSee(battle,unit.side,point);
  const planning={...battle,units:battle.units.filter(v=>v.side===unit.side||observed(v)),npcs:(battle.npcs??[]).filter(observed)};
  path=getReachable(planning,unit,{stopAt:point=>sameCell(point,action)})[0];
  assert.ok(path&&path.cost>0&&path.cost<=24&&path.path.length>0&&path.path.length<=3);
  const costs=actionCosts(battle,unit);
  assert.ok(unit.ap-path.cost>=costs.fire+costs.aim*2,'the native investigation retains its attack reserve');
  nativeActionInvocations++;
  after=actBattle(battle,action);
  assert.equal(after.lastError,null,JSON.stringify(action));
  const moved=after.units.find(u=>u.id===unit.id);
  assert.ok(sameCell(moved,action));assert.deepEqual(moved.lastMovePath,path.path);
  assert.equal(moved.ap,unit.ap-path.cost,'native movement charges the real prone route');
  let from=unit,energy=0;
  for(const step of path.path){
   const diagonal=from.x!==step.x&&from.y!==step.y?1.4:1;
   energy+=Math.ceil(movementEnergy(unit,surfaceAt(battle,step))*diagonal);from=step;
  }
  assert.equal(moved.energy,unit.energy-energy,'native movement spends finite energy');
  assert.equal(moved.stance,'prone');assert.equal(moved.movementMode,'prone');
  for(const key of ['loaded','ammo','medkits','weapon','condition','inventory','weaponFittings'])assert.deepEqual(moved[key],unit[key],key);
  assert.equal(after.elapsedSeconds,battle.elapsedSeconds,'this combat move retains the native round clock');
  assert.equal(Object.hasOwn(after,'actionDurationSeconds'),false,'the native reducer removes transient action duration');
  assert.equal(Object.hasOwn(after,'actionTimeAppliedSeconds'),false,'the native reducer removes transient time accounting');
  assert.equal(after.turn,battle.turn);assert.equal(after.status,'active');
  for(const before of battle.units){
   const current=after.units.find(u=>u.id===before.id);
   assert.ok(current.hp<=before.hp,'movement grants no healing or revival');
   if(before.hp<=0)assert.equal(current.hp,before.hp,'the earned casualty remains');
  }
  assert.deepEqual(battle,original,'native execution does not change its input');
 }catch(error){failure={name:error.name,code:error.code??null,message:error.message};throw error;}
 finally{record('corrected-native-investigation-control.json',{before:battle,action,path,after,failure,controllerInvocations:1,nativeActionInvocations});}
});
