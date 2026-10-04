import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,reprimePlan,firearmFlightPreview,weaponFor} from '../game/tactical.js';
import {ammoCount} from '../game/ammo-types.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(s,a)=>{const next=actBattle(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const synced=pair=>{const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null,next.error);return saved(next);};
const player=b=>b.units.find(u=>u.side==='player');

// Prepared cover arena, not a fresh-campaign victory proof. The public hire
// and assault issue all soldiers, conditions, seed and finite owned equipment.
// Only positions, passive posts and nonblocking cover are declared here before
// battle creation; no execution step changes HP, AP, loads or random state.
function preparedArena(campaign,width){
 const request=campaign.pendingBattle;
 const battle=createBattle(request.squad.map(u=>({...u,x:1,y:3,facing:2})),{
  ...request,width:32,height:16,
  tiles:Array.from({length:512},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,blocksSight:false,cover:0})),
  props:[{id:'depth-screen',type:'hay',x:3,y:3,footprint:{width,height:1},obstacleHeight:2,projectileResistance:12,blocksMovement:false,blocksSight:false}],
  enemies:request.enemies.map((u,i)=>({...u,x:i?20:5,y:i?2+i*2:3,patrol:false,overwatch:false})),
  npcs:request.npcs.map((u,i)=>({...u,x:25-i,y:14})),
 });
 // Retain trusted unopened-arsenal context; this arena supplies no artillery.
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 return saved({campaign:structuredClone(campaign),battle});
}

function paidShot(start,targetId){
 let pair=start,apSpent=0;const actions=[],id=player(start.battle).id;
 const apply=action=>{
  const before=player(pair.battle),cost=action.type==='reprime'?reprimePlan(before,pair.battle).pa:actionCosts(pair.battle,before,pair.battle.units.find(u=>u.id===targetId));
  apSpent+=typeof cost==='number'?cost:cost.fire+(action.aim??0)*cost.aim;actions.push(action);
  const actual=act(pair.battle,action),shown=presentedActBattle(pair.battle,action);assert.deepEqual(shown.state,actual);
  pair=synced({campaign:pair.campaign,battle:actual});
 };
 apply({type:'fire',unitId:id,targetId,aim:0});
 if(player(pair.battle).jammed){
  // A real ignition failure can occur. Pay for cebado, keep the
  // retained charge, and aim the retry while reserving AP for the exit.
  assert.equal(player(pair.battle).loaded,player(start.battle).loaded);
  apply({type:'reprime',unitId:id});apply({type:'fire',unitId:id,targetId,aim:2});
 }
 assert.equal(player(pair.battle).jammed,false);assert.equal(player(pair.battle).loaded,player(start.battle).loaded-1);
 let replay=saved(start);for(const action of actions)replay=synced({campaign:replay.campaign,battle:act(replay.battle,action)});assert.deepEqual(replay,pair);
 return {pair,actions,apSpent};
}

test('a paid hire fires into finite cover, injures an embedded target and preserves costs through official replay and physical return',t=>{
 let campaign=initialCampaign(42);const quote=contractQuote(campaign,rosterFor(campaign).find(u=>u.id===110),'week'),startCash=campaign.resources.treasury;
 campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assert.equal(campaign.resources.treasury,startCash-quote.price);
 campaign=order(campaign,{type:'wait',hours:6});campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 assert.equal(campaign.pendingBattle.squad.length,1);assert.ok(campaign.pendingBattle.enemies.length>0);
 const cash=campaign.resources.treasury,contracts=structuredClone(campaign.contracts),thin=preparedArena(campaign,1),embedded=preparedArena(campaign,4);
 const unit=player(embedded.battle),target=embedded.battle.units.find(u=>u.side==='enemy'),weapon=weaponFor(unit),stock=unit.loaded+ammoCount(unit),action={type:'fire',unitId:unit.id,targetId:target.id};
 assert.equal(weapon.loadPattern,'single');assert.equal(stock,10);assert.equal(unit.loaded,1);assert.ok(target.x>=3&&target.x<7,'the target is physically inside the declared cover');
 const before=structuredClone(embedded),preview=firearmFlightPreview(embedded.battle,unit,target),hit=preview.bodyImpacts.find(hit=>hit.victimId===target.id&&hit.victimKind==='unit');
 const expectedForce=weapon.damage-12*2*Math.hypot(1,.3/4);assert.ok(hit);assert.ok(Math.abs(hit.incomingImpact-expectedForce)<1e-9);assert.ok(hit.incomingImpact>0);
 assert.deepEqual(embedded,before,'the depth forecast spends no RNG or property');
 const result=paidShot(embedded,target.id),ordinary=result.pair.battle,clearer=paidShot(thin,target.id).pair.battle;assert.deepEqual(embedded,before);
 const injured=ordinary.units.find(u=>u.id===target.id),lessCovered=clearer.units.find(u=>u.id===target.id),fired=player(ordinary);
 assert.ok(injured.hp<target.hp);assert.ok(injured.hp>lessCovered.hp,'extra entry-to-body depth reduces the actual injury');
 assert.equal(fired.loaded,unit.loaded-1);assert.equal(ammoCount(fired),ammoCount(unit));assert.equal(fired.condition,unit.condition-1);assert.equal(fired.ap,unit.ap-result.apSpent);
 assert.equal(ordinary.elapsedSeconds,embedded.battle.elapsedSeconds+6,'the paid actions occupy one real combat round');assert.notEqual(ordinary.seed,embedded.battle.seed);assert.equal(ordinary.units.filter(u=>u.side==='enemy').length,campaign.pendingBattle.enemies.length);
 let pair=result.pair;assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.contracts,contracts);
 const denied=actBattle(pair.battle,action);assert.ok(denied.lastError);assert.equal(denied.log.at(-1),denied.lastError);
 assert.deepEqual({...denied,lastError:null,log:pair.battle.log},pair.battle,'only the rejection notice changes; the empty gun cannot spend RNG, AP, force or another charge');
 const north=pair.battle.exits.find(exit=>exit.destination==='retiro');assert.ok(north);
 const energy=player(pair.battle).energy;pair.battle=act(pair.battle,{type:'movement',unitId:unit.id,movement:'run'});
 pair.battle=act(pair.battle,{type:'move',unitId:unit.id,x:1,y:0});assert.ok(player(pair.battle).energy<energy,'the physical return route spends actual running energy');
 pair.battle=act(pair.battle,{type:'exit',unitIds:[unit.id],exitId:north.id});assert.equal(pair.battle.status,'retreat');pair=synced(pair);
 const final=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 campaign=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:final,survivors:final.units.filter(u=>u.side==='player')});campaign=saved({campaign}).campaign;
 assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,contracts);assert.equal(campaign.sectorStates.buenos_aires.units.find(u=>u.id===target.id).hp,final.units.find(u=>u.id===target.id).hp);
 const fallen=final.units.filter(u=>u.side==='player'&&u.hp<=0).map(u=>Number(u.id));assert.deepEqual(request.squad.filter(u=>!campaign.operativeState[u.id].alive).map(u=>Number(u.id)),fallen);
 for(const enemy of final.units.filter(u=>u.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(u=>u.id===enemy.id).hp,enemy.hp,'all actual enemy health remains in the saved sector');
 campaign=order(campaign,{type:'visitSector'});pair=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 assert.equal(player(pair.battle).loaded+ammoCount(player(pair.battle)),stock-1);assert.equal(player(pair.battle).condition,fired.condition);assert.equal(pair.campaign.resources.treasury,cash);
 t.diagnostic(JSON.stringify({paidPrice:quote.price,treasury:cash,contract:contracts[110],issuedRounds:stock,returnedRounds:player(pair.battle).loaded+ammoCount(player(pair.battle)),paidFireActions:result.actions.map(a=>a.type),fireAP:result.apSpent,shotSeconds:ordinary.elapsedSeconds,finalSeconds:final.elapsedSeconds,seedAfterFire:ordinary.seed,issuedCondition:unit.condition,returnedCondition:player(pair.battle).condition,issuedEnergy:unit.energy,afterShotEnergy:fired.energy,returnedEnergy:player(pair.battle).energy,survivorHP:player(pair.battle).hp,thinTargetHP:lessCovered.hp,embeddedTargetHP:injured.hp,settledTargetHP:final.units.find(u=>u.id===target.id).hp,fallen}));
});
