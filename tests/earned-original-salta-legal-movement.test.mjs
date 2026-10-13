import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {dispatchCampaign} from '../game/campaign.js';
import {actBattle,endTurn,getReachable,canSee,teamCanSee,interruptAvailable} from '../game/tactical.js';
import {sameCell} from '../game/tactical-space.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {combatOrder,openingControlWindow} from './opening-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function earned(){
 const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-salta-rejected-move.provenance.json',import.meta.url)));
 const packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const observed=JSON.parse(raw),before=structuredClone(observed),paired=syncBattleTime(observed.campaign,observed.preActionBattle);assert.equal(paired.error,null);
 const pair=decodeSave(encodeSave(paired.campaign,paired.battle));assert.deepEqual(pair,{campaign:paired.campaign,battle:paired.battle});assert.deepEqual(observed,before);
 assert.deepEqual([pair.battle.turn,pair.battle.elapsedSeconds,pair.battle.mode,pair.battle.phase],[7,1495,'combat','player']);
 assert.equal(observed.orders.length,339);assert.deepEqual(observed.error.crew,[{gunId:'arsenal:cordoba:2',ids:['114','124']}]);
 // Keep the original initial deployment: recomputing preferences from the
 // wounded failure snapshot would assign a different crew and miss this case.
 const gun=observed.initial.artillery.find(g=>g.id==='arsenal:cordoba:2');
 const ids=observed.initial.units.filter(u=>u.side==='player'&&u.id!=='57'&&u.hp>0).sort((a,b)=>Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(b.x-gun.x,b.y-gun.y)||String(a.id).localeCompare(String(b.id))).slice(0,artilleryProfile(observed.initial,gun).crew).map(u=>u.id);
 assert.deepEqual(ids,['114','124']);
 return {observed,pair,meta};
}
const known=(battle,unit)=>({...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v)),npcs:(battle.npcs??[]).filter(v=>teamCanSee(battle,unit.side,v))});
const finite=u=>({hp:u.hp,bleeding:u.bleeding,bandaged:u.bandaged,loaded:u.loaded,ammo:u.ammo,medkits:u.medkits,inventory:u.inventory,weapon:u.weapon,condition:u.condition});
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle));
function synchronize(pair,battle){const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return {campaign:next.campaign,battle:next.battle};}
function record(name,value){const out=process.env.GRANADEROS_SALTA_MOVE_EVIDENCE;if(!out)return;mkdirSync(out,{recursive:true});writeFileSync(`${out}/${name}.json`,JSON.stringify(value));}

// Resume the exact failed 16-pass window at its original actor/attempt cursor,
// then retain the ordinary driver's 600-window/80-turn limits and native rounds.
function continueNative(input,observed,{saveAt=-1}={}){
 let pair=structuredClone(input),controller=coastalBatteryController(observed.initial,{sharedArtillerySight:true}),orders=[];
 const execute=action=>{const b=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(b.lastError,null,JSON.stringify(action));pair=synchronize(pair,b);orders.push(action);if(orders.length===saveAt)pair=saved(pair);};
 const ids=pair.battle.units.filter(u=>u.side==='player'&&!u.militia).sort((a,b)=>b.marksmanship-a.marksmanship).map(u=>u.id),first=ids.indexOf(observed.error.action.unitId);assert.ok(first>=0);
 for(let attempt=observed.error.attempt;attempt<16&&pair.battle.status==='active';attempt++){
  let acted=false;
  for(const id of ids.slice(attempt===observed.error.attempt?first:0)){
   if(pair.battle.status!=='active')break;const u=pair.battle.units.find(u=>u.id===id);if(!interruptAvailable(pair.battle,u)||u.ap<3)continue;
   const action=controller(pair.battle,u);if(!action)continue;execute(action);acted=true;
  }
  if(!acted)break;
 }
 if(pair.battle.status==='active')execute({type:'endTurn'});
 for(let window=observed.error.window+1;window<600&&pair.battle.turn<=80&&pair.battle.status==='active';window++){
  const result=openingControlWindow(pair.battle,{controller});
  // The existing window already executed these native orders. Synchronize its
  // exact output; replay each order only in the independent saved run below.
  pair=synchronize(pair,result.battle);orders.push(...result.orders);
  if(saveAt>0&&orders.length>=saveAt&&orders.length-result.orders.length<saveAt)pair=saved(pair);
  if(pair.battle.status==='active')execute({type:'endTurn'});
 }
 return {pair,orders};
}
function settle(pair){const c=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(u=>u.side==='player'),sectorState:pair.battle});assert.equal(c.lastError,null);return c;}

test('the exact rejected Salta move pays for its shared-known legal prefix without entering the incapacitated enemy cell',t=>{
 const {observed,pair,meta}=earned(),before=structuredClone(pair),b=pair.battle,u=b.units.find(v=>v.id==='11'),occupant=b.units.find(v=>v.id==='enemy-4');
 assert.deepEqual([u.x,u.y,u.ap,u.hp,u.bleeding],[41,26,38,18,0]);assert.deepEqual([occupant.x,occupant.y,occupant.hp],[42,28,2]);
 assert.equal(canSee(b,u,occupant),false);assert.equal(teamCanSee(b,u.side,occupant),true);
 const original=chooseEnemyAction(b,u);assert.deepEqual(original,meta.action);
 const refused=actBattle(b,original);assert.equal(refused.lastError,meta.refusal);assert.deepEqual(refused.units,b.units);
 assert.equal(getReachable(known(b,u),u).some(p=>sameCell(p,original)),false);
 const action=combatOrder(b,u);assert.deepEqual(action,{type:'move',unitId:'11',x:41,y:27,tacticalLevel:0});
 const controller=coastalBatteryController(observed.initial,{sharedArtillerySight:true});assert.deepEqual(controller(b,u),action);
 const path=getReachable(known(b,u),u).find(p=>sameCell(p,action));assert.equal(path.cost,8);assert.deepEqual(path.path,[observed.error.personalReach.path[0]]);
 const next=actBattle(b,action),moved=next.units.find(v=>v.id===u.id);assert.equal(next.lastError,null);assert.equal(moved.ap,u.ap-path.cost);assert.ok(moved.energy<u.energy);assert.deepEqual(moved.lastMovePath,path.path);
 for(const v of b.units)assert.deepEqual(finite(next.units.find(a=>a.id===v.id)),finite(v),'Movement must not heal, revive, supply or discard any actor.');
 assert.deepEqual(next.artillery,b.artillery);assert.equal(next.elapsedSeconds,b.elapsedSeconds);assert.equal(next.turn,b.turn);
 const actual=synchronize(pair,next),resumed=saved(pair),replayed=synchronize(resumed,actBattle(resumed.battle,controller(resumed.battle,resumed.battle.units.find(v=>v.id===u.id))));assert.deepEqual(replayed,actual);assert.deepEqual(saved(actual),actual);assert.deepEqual(pair,before);
 record('paid-prefix',{fixtureSha:meta.rawSha256,original,action,path,pair:actual});
 t.diagnostic(JSON.stringify({scope:'Exact original Salta refusal; one legal8AP move and official replay, no outcome claim',fixtureSha:meta.rawSha256,original,action,paidAP:8,elapsedSeconds:0,finiteActorsAndGunUnchanged:true}));
});

test('the original Salta window continues through native victory, exact saved replay and permanent finite settlement',t=>{
 const {observed,pair,meta}=earned(),before=structuredClone(pair),result=continueNative(pair,observed);record('native-result',result);
 assert.equal(result.pair.battle.status,'victory','The legal move must finish the actual native Salta encounter.');
 assert.ok(result.orders.length>0);assert.deepEqual(result.orders[0],{type:'move',unitId:'11',x:41,y:27,tacticalLevel:0});
 const replay=continueNative(saved(pair),observed,{saveAt:Math.floor(result.orders.length/2)});assert.deepEqual(replay,result,'Original crew selection and a real midpoint save must reproduce every native order and field.');
 const c=settle(result.pair),replayed=settle(replay.pair);assert.deepEqual(replayed,c);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 assert.equal(c.sectors.salta.owner,'patriot');assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 const deaths=result.pair.battle.units.filter(u=>u.side==='player'&&u.hp<=0).map(u=>Number(u.id));for(const id of deaths){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);assert.ok(Number.isFinite(c.operativeState[id].deathMinute));}
 for(const [id,r]of Object.entries(pair.campaign.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 for(const u of result.pair.battle.units.filter(u=>u.side==='player'&&u.hp>0)){
  const r=c.operativeState[Number(u.id)],growth=r.maxHp-result.pair.campaign.operativeState[Number(u.id)].maxHp;
  // Normal victory progression increases full-health actors with their new
  // maximum. A wounded actor retains the native wound instead of being healed.
  assert.ok(growth>=0);assert.equal(r.hp,u.hp+(u.hp===u.maxHp?growth:0));assert.equal(r.bleeding,u.bleeding);
 }
 const gun=result.pair.battle.artillery.find(g=>g.id==='arsenal:cordoba:2');assert.ok(gun);assert.equal(gun.type,'bronze4');assert.ok(Number(gun.loaded)+gun.ammo<=Number(pair.battle.artillery[0].loaded)+pair.battle.artillery[0].ammo);
 assert.equal(result.pair.battle.units.length,pair.battle.units.length);assert.deepEqual(pair,before);record('settled-campaign',c);
 t.diagnostic(JSON.stringify({scope:'Complete actual Salta continuation from turn7 refused order; not original whole recovery/ending',fixtureSha:meta.rawSha256,turns:result.pair.battle.turn,additionalOrders:result.orders.length,elapsedSeconds:result.pair.battle.elapsedSeconds,deaths,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,gun:{id:gun.id,loaded:gun.loaded,ammo:gun.ammo},officialReplayExact:true}));
});
