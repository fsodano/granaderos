import test from 'node:test';import assert from 'node:assert/strict';
import {runPrisonerRescue} from './prisoner-rescue-route.mjs';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {actBattle,endTurn,firearmShotOptions,actionCosts,teamCanSee} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sync,order} from './prisoner-rescue-fixture.mjs';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';

test('paid relief starts at the real arrival edge, fights, releases prisoners and escorts them back with persistent casualties',()=>{
 const {initial,campaign,battle,orders,savedDepartures,riskChoices}=runPrisonerRescue();
 const entry=initial.battle,players=entry.units.filter(u=>u.side==='player');
 assert.equal(players.length,6);assert.ok(players.every(u=>u.x===entry.width-1));assert.ok(initial.campaign.resources.treasury>=0);assert.deepEqual(entry.artillery.filter(g=>g.side==='player').map(g=>g.type),['swivel','bronze4']);
 assert.ok(orders.some(a=>a.type==='fire'));assert.ok(orders.some(a=>a.type==='move'));assert.equal(orders.filter(a=>a.type==='free').length,3);
 // This route clears the guard force before evacuation. It does not establish
 // a stealth rescue or escape while hostile guards still contest the field.
 assert.ok(orders.some(a=>a.type==='explore'));assert.equal(battle.sectorCleared,true);assert.equal(battle.status,'retreat');assert.ok(battle.turn<=20);
 assert.equal(battle.npcs.filter(n=>n.detentionEscape).length,3);
 assert.equal(campaign.location,'jujuy');assert.equal(campaign.sectors.humahuaca.owner,'royalist');assert.equal(campaign.resources.treasury,initial.campaign.resources.treasury);
 for(const id of [3,4,10]){const before=initial.campaign.operativeState[id],after=campaign.operativeState[id];assert.equal(after.captured,false);assert.equal(after.location,'jujuy');assert.equal(after.hp,before.hp);assert.equal(campaign.loadouts[id].weapon,0);assert.equal(campaign.loadouts[id].blade,0);assert.deepEqual(after.inventory,{});assert.ok(campaign.recruited.includes(id));}
 const fallen=battle.units.filter(u=>u.side==='player'&&u.hp<=0);
 assert.deepEqual(players.filter(u=>campaign.operativeState[u.id].alive===false).map(u=>u.id).sort(),fallen.map(u=>u.id).sort(),'settlement retains exactly the real relief deaths');
 for(const unit of fallen){assert.equal(campaign.operativeState[unit.id].alive,false);assert.equal(campaign.operativeState[unit.id].hp,0);}
 const evacuees=battle.units.filter(u=>u.side==='player'&&u.departure?.destination==='jujuy');
 assert.equal(evacuees.length,players.length-fallen.length);assert.equal(savedDepartures,evacuees.length);
 const shots=orders.filter(a=>a.type==='artillery');
 for(const gun of entry.artillery.filter(g=>g.side==='player')){
  const used=shots.filter(a=>a.artilleryId===gun.id),returnedGun=battle.artillery.find(g=>g.id===gun.id);
  assert.ok(used.length>0,'each paid gun must contribute through actual finite shots');
  assert.equal(returnedGun.ammo+Number(returnedGun.loaded),gun.ammo+Number(gun.loaded)-used.length);
 }
 const rounds=units=>units.reduce((sum,u)=>sum+(u.loaded??0)+totalReserveAmmunition(u),0);
 // A safer tactic need not propose a dangerous shot. Check each actual shot
 // below; dedicated shot-load tests establish that real warnings still occur.
 for(const choice of riskChoices){
  assert.ok([...choice.proposed.risk.direct,...choice.proposed.risk.scatter].some(v=>v.kind==='npc'));
  assert.ok(![...choice.selected.risk.direct,...choice.selected.risk.scatter].some(v=>v.kind==='npc'));
  assert.ok(choice.selected.score>0,'a safe alternative must retain real useful force');
 }
 // Replay every paid order from the complete initial save, retaining each
 // intermediate evacuation save. A misfire keeps its loaded cartridge.
 let {campaign:replayCampaign,battle:replayBattle}=decodeSave(encodeSave(initial.campaign,initial.battle)),firedRounds=0;
 for(const [orderIndex,recorded] of orders.entries()){
  const {turn,battleMode,...action}=recorded;assert.equal(replayBattle.turn,turn);assert.equal(replayBattle.mode,battleMode);
  const before=action.type==='fire'&&replayBattle.units.find(u=>u.id===action.unitId);
  if(before){
   const target=replayBattle.units.find(u=>u.id===action.targetId),risk=firearmBystanderRisk(replayBattle,before,target,action.hitLocation??'torso');assert.ok(![...risk.direct,...risk.scatter].some(v=>v.kind==='npc'),'every actual relief shot must avoid known prisoner lanes');
   const choice=riskChoices.find(c=>c.orderIndex===orderIndex);
   if(choice){
    assert.deepEqual(action,choice.selected.action);
    const scores=[];
    for(const t of replayBattle.units.filter(u=>u.side==='enemy'&&u.hp>=15&&!u.routed&&!u.departure&&!u.unconscious&&!u.surrendered&&teamCanSee(replayBattle,'player',u))){
     const cost=actionCosts(replayBattle,before,t);if(before.ap<cost.fire)continue;
     for(const o of firearmShotOptions(replayBattle,before,t,Math.min(4,Math.floor((before.ap-cost.fire)/cost.aim)))){
      const candidateRisk=firearmBystanderRisk(replayBattle,before,t,o.hitLocation);
      if(o.chance>=5&&o.damageFactor>0&&![...candidateRisk.direct,...candidateRisk.scatter].some(v=>v.kind==='npc'))scores.push(o.chance*o.damageFactor);
     }
    }
    assert.equal(choice.selected.score,Math.max(...scores),'the rescue selects the best affordable safe shot from the actual saved field');
   }
  }
  replayBattle=action.type==='endTurn'?endTurn(replayBattle):actBattle(replayBattle,action);assert.equal(replayBattle.lastError,null);
  if(before){const after=replayBattle.units.find(u=>u.id===action.unitId),spent=Number(!after.jammed);assert.equal(before.loaded-after.loaded,spent);firedRounds+=spent;}
  if(action.type==='exit'){const paired=sync(replayCampaign,replayBattle);({campaign:replayCampaign,battle:replayBattle}=decodeSave(encodeSave(paired.campaign,paired.battle)));}
 }
 assert.deepEqual(replayBattle,battle);assert.ok(firedRounds>0);assert.equal(rounds(players)-rounds(battle.units.filter(u=>u.side==='player')),firedRounds);
 const paired=sync(replayCampaign,replayBattle),restored=decodeSave(encodeSave(paired.campaign,paired.battle));
 replayCampaign=order(restored.campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 assert.deepEqual(replayCampaign,campaign);assert.deepEqual(decodeSave(encodeSave(replayCampaign)).campaign,campaign);
 const caches=Object.values(campaign.detentionRecords).filter(r=>r.escape).flatMap(r=>r.escape.cacheIds);assert.ok(caches.length>0);assert.equal(new Set(caches).size,caches.length);assert.ok(caches.every(id=>campaign.sectorStates.humahuaca.groundItems.some(g=>g.id===id&&g.count>0)));
});
