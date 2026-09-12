import {regionalWeatherAt,WEATHER_INTERVAL_HOURS} from './regional-weather.js';
import {gainFatigue,recoverFatigue} from './fatigue.js';
import {dispatchCampaign} from './campaign.js';
export const COMBAT_ROUND_SECONDS=6;
export const REST_SECONDS=600;
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
 if(!campaign.pendingBattle||battle.battleId&&battle.battleId!==campaign.pendingBattle.id)return {campaign,battle,error:'El reloj no corresponde al despliegue.'};
 const next=dispatchCampaign(campaign,{type:'syncTacticalTime',battleId:campaign.pendingBattle?.id,elapsedSeconds:battle.elapsedSeconds??0});
 if(next.lastError)return {campaign,battle,error:next.lastError};
 const units=battle.units.map(u=>{const horse=u.mount&&next.horseState?.horses.find(h=>h.id===u.mount.id);return horse?{...u,mount:{...u.mount,condition:Math.min(u.mount.condition,horse.condition)}}:u;});
 return {campaign:next,battle:{...battle,units,syncedSeconds:battle.elapsedSeconds??0,savedHour:next.hour,savedSecond:next.secondOfHour??0},error:null};
}
