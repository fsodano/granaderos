import {dispatchCampaign} from './campaign.js';
export const COMBAT_ROUND_SECONDS=6;
export const REST_SECONDS=600;
export function advanceBattleClock(s,seconds){
 s.elapsedSeconds=(s.elapsedSeconds??0)+seconds;
 const total=(s.startSeconds??0)+s.elapsedSeconds;s.night=total%86400<21600||total%86400>=72000;
 s.lights=(s.lights??[]).map(l=>Number.isFinite(l.turns)?{...l,remainingSeconds:Math.max(0,(l.remainingSeconds??l.turns*600)-seconds),turns:Math.max(0,Math.ceil(((l.remainingSeconds??l.turns*600)-seconds)/600))}:l).filter(l=>l.remainingSeconds!==0);
}
export function syncBattleTime(campaign,battle){
 if(!campaign.pendingBattle||battle.battleId&&battle.battleId!==campaign.pendingBattle.id)return {campaign,battle,error:'El reloj no corresponde al despliegue.'};
 const next=dispatchCampaign(campaign,{type:'syncTacticalTime',battleId:campaign.pendingBattle?.id,elapsedSeconds:battle.elapsedSeconds??0});
 if(next.lastError)return {campaign,battle,error:next.lastError};
 const units=battle.units.map(u=>{const horse=u.mount&&next.horseState?.horses.find(h=>h.id===u.mount.id);return horse?{...u,mount:{...u.mount,condition:Math.min(u.mount.condition,horse.condition)}}:u;});
 return {campaign:next,battle:{...battle,units,syncedSeconds:battle.elapsedSeconds??0,savedHour:next.hour,savedSecond:next.secondOfHour??0},error:null};
}
