import {applyQuestEscortOrders} from './quest-escort.js';
import {regionalWeatherAt,WEATHER_INTERVAL_HOURS} from './regional-weather.js';
import {gainFatigue,recoverFatigue} from './fatigue.js';
import {dispatchCampaign,hasPendingNpcGiftProgress} from './campaign.js';
import {hasPendingCivilians,nextUnloadedCivilianDeath} from './campaign-civilians.js';
import {campaignStory} from './campaign-story.js';
import {nextContentQuestDeadline} from './content-quests.js';
import {nextCampaignPresenceChange} from './campaign-presence.js';
export const COMBAT_ROUND_SECONDS=6;
export const REST_SECONDS=600;
// Only dispatcher results establish trust. Decoded saves, campaign commands and
// clones must take the full path again. Between minute boundaries, a settled
// campaign can share its unchanged maps instead of cloning them for every step.
const synchronizedCampaigns=new WeakSet();
function syncSettledClock(campaign,battle,elapsed){
 if(!synchronizedCampaigns.has(campaign)||campaign.defeated||campaign.pendingEncounter||campaignStory(campaign))return null;
 const previous=campaign.pendingBattle.syncedSeconds??0,second=campaign.secondOfHour??0,delta=elapsed-previous;
 if(!Number.isSafeInteger(elapsed)||delta<0||!Number.isInteger(second)||second<0||second>=3600||Math.floor(second/60)!==Math.floor((second+delta)/60))return null;
 // These cases can change more than the clock, including events between hours.
 const end=campaign.hour*3600+second+delta;
 if(Number.isFinite(nextUnloadedCivilianDeath(campaign))||end>=nextContentQuestDeadline(campaign)||end>=nextCampaignPresenceChange(campaign)||battle.units.some(u=>u.side==='player'&&(u.hp<=0||u.missionAlly)))return null;
 if(hasPendingNpcGiftProgress(campaign,battle)||hasPendingCivilians(campaign,battle))return null;
 const pendingBattle={...campaign.pendingBattle,syncedSeconds:elapsed};delete pendingBattle.resumeSnapshot;
 return {...campaign,pendingBattle,secondOfHour:second+delta,lastError:null};
}
export function advanceBattleClock(s,seconds,{resting=false}={}){
 const before=(s.startSeconds??0)+(s.elapsedSeconds??0);
 s.elapsedSeconds=(s.elapsedSeconds??0)+seconds;
 const total=(s.startSeconds??0)+s.elapsedSeconds;
 const hours=Math.floor(total/3600)-Math.floor(before/3600);
 if(hours)for(const unit of s.units??[]){
  if(unit.hp<=0||unit.departure||unit.fled||unit.surrendered)continue;
  if(resting&&s.mode==='exploration')recoverFatigue(unit,hours,0);else gainFatigue(unit,2*hours);
 }
 s.night=total%86400<21600||total%86400>=72000;
 if(s.regionalWeather&&Math.floor(before/(WEATHER_INTERVAL_HOURS*3600))!==Math.floor(total/(WEATHER_INTERVAL_HOURS*3600)))s.weather=regionalWeatherAt(s.sectorId,total/3600);
 s.lights=(s.lights??[]).map(l=>Number.isFinite(l.turns)?{...l,remainingSeconds:Math.max(0,(l.remainingSeconds??l.turns*600)-seconds),turns:Math.max(0,Math.ceil(((l.remainingSeconds??l.turns*600)-seconds)/600))}:l).filter(l=>l.remainingSeconds!==0);
}
export function syncBattleTime(campaign,battle){
 try{
 if(!campaign.pendingBattle||battle.battleId&&battle.battleId!==campaign.pendingBattle.id)return {campaign,battle,error:'El reloj no corresponde al despliegue.'};
 const elapsed=battle.elapsedSeconds??0;
 const next=syncSettledClock(campaign,battle,elapsed)??dispatchCampaign(campaign,{type:'syncTacticalTime',battleId:campaign.pendingBattle.id,elapsedSeconds:elapsed,sectorState:battle});
 if(next.lastError)return {campaign,battle,error:next.lastError};
 const units=battle.units.map(u=>{const horse=u.mount&&next.horseState?.horses.find(h=>h.id===u.mount.id);return horse?{...u,mount:{...u.mount,condition:Math.min(u.mount.condition,horse.condition)}}:u;});
 const syncedBattle=applyQuestEscortOrders(next,{...battle,units,syncedSeconds:elapsed,savedHour:next.hour,savedSecond:next.secondOfHour??0});
 synchronizedCampaigns.add(next);
 return {campaign:next,battle:syncedBattle,error:null};
 }catch(error){return {campaign,battle,error:error.message};}
}
