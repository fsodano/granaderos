import assert from 'node:assert/strict';
import {WEAPONS} from '../game/data.js';
import {dispatchCampaign,rosterFor,deploymentCost} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,reloadCost,reloadPlan,reprimePlan} from '../game/tactical.js';
import {syncBattleTime,COMBAT_ROUND_SECONDS} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

// A route controller must finish an unfinished gun through real equipment and
// reload orders. Returning to the map cannot finish the job for the player.
export function finishReloadsBeforeMarch(start,{report=()=>{},deadlineSeconds,readyPrimary=false}={}){
 const bounded=deadlineSeconds!==undefined,clock=s=>s.hour*3600+(s.secondOfHour??0),orders=[];let lastAction=null,refusedSync=null;
 if(bounded){assert.ok(Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(start));assert.equal(start.pendingEncounter,null);assert.equal(start.pendingBattle,null);}
 const roster=rosterFor(start),ids=start.squad.filter(id=>{const r=start.operativeState[id],capacity=WEAPONS[roster.find(u=>u.id===id)?.weapon]?.capacity??0;return !r.weaponDropped&&capacity>0&&(r.jammed||r.carriedLoaded!==undefined&&r.carriedLoaded<capacity||(bounded||readyPrimary)&&(r.activeSlot??'primary')!=='primary');});
 if(!ids.length)return start;
 report({event:'reloadDeployment',ammunitionCost:deploymentCost(start)});
 let campaign=dispatchCampaign(start,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
 const before=battle.elapsedSeconds,rounds=battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0);let completed=0,reprimed=0;
 const check=()=>{if(bounded){assert.equal(campaign.pendingEncounter,null,'An actual encounter stops bounded reload preparation.');assert.equal(campaign.defeated,false);assert.ok(clock(campaign)<=deadlineSeconds,'Reloads share the original roof-preparation deadline.');assert.equal(battle.status,'active');assert.equal(battle.mode,'exploration','Actual contact stops bounded reload preparation.');assert.equal(battle.phase,'player');assert.ok(!battle.reactionStack?.length);}};
 const act=action=>{
  if(bounded){check();const unit=battle.units.find(u=>u.id===action.unitId),pa=action.type==='reload'?reloadPlan(unit,battle).pa:action.type==='reprime'?reprimePlan(unit,battle).pa:4;
   // Quote Native equipment time and reserve its possible contact round too.
   assert.ok(Number.isFinite(pa)&&pa>0);assert.ok(clock(campaign)+Math.max(1,Math.ceil(pa*.06))+COMBAT_ROUND_SECONDS<=deadlineSeconds,'The next paid reload step exceeds the original preparation deadline.');lastAction=structuredClone(action);
  }
  battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  if(bounded){const pair=syncBattleTime(campaign,battle);if(pair.error!==null)refusedSync=pair;assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;orders.push(structuredClone(action));check();}
 };
 try{
 check();
 for(const id of ids){
  let unit=battle.units.find(u=>u.id===String(id));
  if(unit.activeSlot!=='primary')act({type:'weapon',unitId:unit.id,slot:'primary'});
  unit=battle.units.find(u=>u.id===String(id));if(unit.jammed){const ownedRounds=unit.ammo+unit.loaded;act({type:'reprime',unitId:unit.id});unit=battle.units.find(u=>u.id===String(id));assert.equal(unit.jammed,false);assert.equal(unit.ammo+unit.loaded,ownedRounds);reprimed++;report({event:'finishedReprime',id,loaded:unit.loaded,ammo:unit.ammo});}
  unit=battle.units.find(u=>u.id===String(id));const cost=reloadCost(unit,battle),ammo=unit.ammo,loaded=unit.loaded;
  if(!cost){report({event:'reloadUnavailable',id,loaded,ammo});continue;}
  act({type:'reload',unitId:unit.id});unit=battle.units.find(u=>u.id===String(id));
  completed++;
  assert.equal(unit.reloadProgress,undefined);assert.equal(unit.ammo+unit.loaded,ammo+loaded);
  report({event:'finishedReload',id,paidPAEquivalent:cost,loaded:unit.loaded,ammo:unit.ammo});
 }
 assert.equal(battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.ammo+u.loaded,0),rounds);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null);campaign=synced.campaign;battle=synced.battle;
 campaign=dispatchCampaign(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.equal(campaign.lastError,null,campaign.lastError);
 if(bounded){assert.equal(campaign.pendingEncounter,null,'An actual arrival stops bounded reload preparation before another visit.');assert.equal(campaign.pendingBattle,null);assert.ok(clock(campaign)<=deadlineSeconds);report({event:'boundedPreMarchReload',ids,orders,startSeconds:clock(start),endSeconds:clock(campaign),deadlineSeconds});}
 assert.ok(completed||reprimed?battle.elapsedSeconds>before:battle.elapsedSeconds>=before);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return campaign;
 }catch(error){if(bounded&&error&&typeof error==='object'){error.campaign=campaign;error.battle=battle;error.boundedPreMarchReload={ids,orders,lastAction,deadlineSeconds,startSeconds:clock(start),endSeconds:clock(campaign)};if(refusedSync)error.boundedPreMarchRefusedSync=refusedSync;}throw error;}
}
