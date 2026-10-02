import assert from 'node:assert/strict';
import {actBattle,endTurn,interruptAvailable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {combatOrder} from './opening-driver.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {decodeSave,encodeSave} from '../game/save.js';
function fight(request,sectorState,{controller=combatOrder,deploy,observe=()=>{},maxElapsedSeconds=Infinity}={}){let b=enterSector(request,sectorState,{placement:Boolean(deploy)}),actions=0;
 if(deploy)b=deploy(b);observe(b);assert.ok(b.elapsedSeconds<maxElapsedSeconds,'every actual deployment must retain the absolute launch margin');
 const orders=[];
 // Enemy movement can yield several control windows within the same round.
 for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
  const ids=b.units.filter(u=>u.side==='player'&&!u.militia).sort((a,c)=>c.marksmanship-a.marksmanship).map(u=>u.id);
  // Coordinate the squad one order at a time. Spending one scout's whole
  // turn before the others advance separates him from fire and medical aid.
  for(let attempt=0;attempt<16&&b.status==='active';attempt++){
   let acted=false;
   for(const id of ids){
    if(b.status!=='active')break;
    const u=b.units.find(u=>u.id===id);if(!interruptAvailable(b,u)||u.ap<3)continue;
    const action=controller(b,u);if(!action)continue;
    const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action));b=next;observe(b);assert.ok(b.elapsedSeconds<maxElapsedSeconds,'every actual order must retain the absolute launch margin');orders.push(action);actions++;acted=true;
   }
   if(!acted)break;
  }
  if(b.status==='active'){b=endTurn(b);observe(b);assert.ok(b.elapsedSeconds<maxElapsedSeconds,'every actual turn must retain the absolute launch margin');orders.push({type:'endTurn'});}
 }
 return {battle:b,actions,orders};
}

export function fightCreatedFinalCapital(start,sector,{report=()=>{},expectedOutcome='victory',controller,deploy,observe=()=>{},maxElapsedSeconds=Infinity}={}){
 const before=structuredClone(start),prepared=start.pendingBattle?structuredClone(start):finishReloadsBeforeMarch(start,{report});
 const preparationSeconds=(prepared.hour-start.hour)*3600+(prepared.secondOfHour??0)-(start.secondOfHour??0),campaign=start.pendingBattle?prepared:dispatchCampaign(prepared,{type:'attack',sector});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,before);assert.ok(campaign.pendingBattle,'the real march produces a tactical deployment');
 const request=campaign.pendingBattle;assert.equal(request.sector,sector);
 report({event:'battleStarted',sector,hour:campaign.hour,units:request.squad.map(u=>u.id)});
 const result=fight(request,campaign.sectorStates[sector],{controller,deploy,observe,maxElapsedSeconds});
 const summary={sector,preparationSeconds,startSeconds:result.battle.startSeconds,elapsedSeconds:result.battle.elapsedSeconds,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});
 assert.ok(['victory','defeat','retreat'].includes(expectedOutcome));
 assert.equal(result.battle.status,expectedOutcome,JSON.stringify(summary));
 const replay=fight(request,campaign.sectorStates[sector],{controller,deploy,observe,maxElapsedSeconds});assert.deepEqual(replay.battle,result.battle);
 const pair=syncBattleTime(campaign,result.battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 const returned=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:restored.battle.status,survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(returned.lastError,null,returned.lastError);
 // A cleared battlefield cannot certify a continuing campaign when its
 // commander has died and settlement has made the campaign terminal.
 if(expectedOutcome==='victory')assert.equal(returned.defeated,false,'a route victory must leave the campaign playable');
 const navalLoss=expectedOutcome==='defeat'&&request.defenseGroupId&&campaign.enemyGroups.find(group=>group.id===request.defenseGroupId)?.theater==='coast';
 if(request.missionId==='san_lorenzo'){assert.equal(returned.flags.sanLorenzo,expectedOutcome==='victory');if(expectedOutcome==='victory')assert.equal(returned.defeated,false);}
 else assert.equal(returned.sectors[sector].owner,expectedOutcome==='victory'?'patriot':expectedOutcome==='retreat'||navalLoss?campaign.sectors[sector].owner:'royalist');
 assert.equal(returned.pendingBattle,null);
 if(navalLoss){assert.equal(returned.blockade,true);assert.equal(returned.enemyGroups.find(group=>group.id===request.defenseGroupId).status,'stationed');}

 for(const u of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0)){
  if(u.militia)assert.ok(!(returned.garrisons[sector]??[]).some(v=>String(v.id)===u.id&&v.hp>0),'fallen militia must not return to the garrison');
  else if(u.missionAlly)assert.equal(returned.missionAllies[request.missionId].hp,0);
  else assert.equal(returned.operativeState[Number(u.id)].alive,false);
 }
 assert.deepEqual(decodeSave(encodeSave(returned)).campaign,returned);
 return {campaign:returned,summary};
}
