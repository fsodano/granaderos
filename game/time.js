import {applyQuestEscortOrders} from './quest-escort.js';
import {regionalWeatherAt,WEATHER_INTERVAL_HOURS} from './regional-weather.js';
import {gainFatigue,recoverFatigue} from './fatigue.js';
import {dispatchCampaign,hasPendingNpcGiftProgress} from './campaign.js';
import {hasPendingCivilianHarm} from './campaign-civilian-harm.js';
export const COMBAT_ROUND_SECONDS=6;
export const REST_SECONDS=600;
// Only references returned by this bridge have completed the campaign's full
// dispatch/migration path. New actions and decoded/cloned saves warm it again.
// Campaign state is immutable: the common sub-hour step changes only its clock
// and deployment receipt, while hourly work and NPC receipts still dispatch.
const synchronizedCampaigns=new WeakSet();
function syncSubHour(campaign,elapsed,receiptChange){
 if(!synchronizedCampaigns.has(campaign)||receiptChange||campaign.defeated||campaign.pendingEncounter)return null;
 const previous=campaign.pendingBattle.syncedSeconds??0,second=campaign.secondOfHour??0,delta=elapsed-previous;
 if(!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(elapsed)||delta<0||delta>864000||!Number.isInteger(second)||second<0||second>=3600||second+delta>=3600)return null;
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
 const giftChange=hasPendingNpcGiftProgress(campaign,battle),harmChange=hasPendingCivilianHarm(campaign,battle),receiptChange=giftChange||harmChange;
 const elapsed=battle.elapsedSeconds??0;
 const next=syncSubHour(campaign,elapsed,receiptChange)??dispatchCampaign(campaign,{type:'syncTacticalTime',battleId:campaign.pendingBattle?.id,elapsedSeconds:elapsed,...(receiptChange?{sectorState:battle}:{})});
 if(next.lastError)return {campaign,battle,error:next.lastError};
 const units=battle.units.map(u=>{const horse=u.mount&&next.horseState?.horses.find(h=>h.id===u.mount.id);return horse?{...u,mount:{...u.mount,condition:Math.min(u.mount.condition,horse.condition)}}:u;});
 const syncedBattle=applyQuestEscortOrders(next,{...battle,units,syncedSeconds:elapsed,savedHour:next.hour,savedSecond:next.secondOfHour??0});
 synchronizedCampaigns.add(next);
 return {campaign:next,battle:syncedBattle,error:null};
 }catch(error){return {campaign,battle,error:error.message};}
}
