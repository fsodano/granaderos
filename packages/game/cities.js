import {campaignCities,campaignWorld} from './campaign-definition.js';
import {scenarioFor} from './campaign-scenario.js';
// Operational settlement areas, not surveyed nineteenth-century city limits.
// Buenos Aires and Retiro form one town; Ensenada has its own port agreement.
export const CITY_LOYALTY_THRESHOLD=50;
export const CITIES=Object.freeze(campaignCities());
export const RURAL_SECTORS=Object.freeze(campaignWorld().ruralSectors);
export function cityForSector(sectorId,context=null){return campaignCities(context).find(city=>city.sectors.includes(sectorId))??null;}
export function getCityStatus(state,cityOrSector){
 const city=campaignCities(state).find(c=>c.id===cityOrSector)||cityForSector(cityOrSector,state);
 if(!city)return null;
 const uncontrolled=city.sectors.filter(id=>state.sectors?.[id]?.owner!=='patriot');
 const loyalty=Math.floor(city.sectors.reduce((sum,id)=>sum+Math.max(0,Math.min(100,Number(state.sectors?.[id]?.loyalty)||0)),0)/city.sectors.length);
 return {...city,loyalty,threshold:CITY_LOYALTY_THRESHOLD,controlled:uncontrolled.length===0,uncontrolled};
}
// Integer local-town tuning of the classic responsibility distinctions.
// A wound alone is not a civic death event.
export const CITY_LOYALTY_REWARDS=Object.freeze({quest:8,victory:10,defense:3,defeat:-12,civilianPlayerIntentional:-10,civilianPlayerAccidental:-5,civilianMilitia:-7,civilianMilitiaAccidental:-4,civilianEnemyPatriot:-3,civilianEnemyPatriotAccidental:-1,civilianEnemyRoyalist:10,civilianEnemyRoyalistAccidental:5});
// Campaign calls this only after validating and applying the actual outcome.
// Stable quest/battle IDs prevent a repeated result from farming loyalty.
export function recordCityLoyalty(state,{sectorId,kind,eventId,delta:authoredDelta}){
 const city=cityForSector(sectorId,state);
 if(!city)return {applied:false,reason:'rural',city:null};
 const withdrawal=kind==='questWithdrawal';
 if((withdrawal?!Number.isSafeInteger(authoredDelta)||authoredDelta> -1||authoredDelta< -20:!Object.hasOwn(CITY_LOYALTY_REWARDS,kind)||authoredDelta!==undefined)||typeof eventId!=='string'||!eventId.trim()||eventId.length>160)throw Error('Registro de lealtad inválido.');
 const key=`${city.id}:${kind}:${eventId}`;
 state.cityLoyaltyEvents??=[];
 if(state.cityLoyaltyEvents.some(event=>event.key===key||(event.sectorId===sectorId&&event.kind===kind&&event.eventId===eventId)))return {applied:false,reason:'duplicate',city:city.id};
 if(state.cityLoyaltyEvents.length>=30000)throw Error('El registro de lealtad está completo.');
 const before=getCityStatus(state,city.id).loyalty,delta=withdrawal?authoredDelta:CITY_LOYALTY_REWARDS[kind];
 const anchors=withdrawal?city.sectors.map(sectorId=>({sectorId,before:state.sectors[sectorId].loyalty})):null;
 for(const id of city.sectors){const region=state.sectors?.[id];if(region)region.loyalty=Math.max(0,Math.min(100,(Number(region.loyalty)||0)+delta));}
 const after=getCityStatus(state,city.id).loyalty;
 const event={key,cityId:city.id,sectorId,kind,eventId,hour:state.hour??0,delta,before,after,...(withdrawal?{secondOfHour:state.secondOfHour??0,anchors:anchors.map(anchor=>({...anchor,after:state.sectors[anchor.sectorId].loyalty}))}:{})};
 state.cityLoyaltyEvents.push(event);
 return {applied:true,city:city.id,delta:after-before,event};
}
// Earlier saves grouped Ensenada under Buenos Aires. Keep those receipts as
// history; new Ensenada outcomes use its own town and cannot repeat old rewards.
export function validCityLoyaltyEvents(events,context=null){
 return Array.isArray(events)&&events.length<=30000&&new Set(events.map(e=>e?.key)).size===events.length&&events.every(e=>
  e&&typeof e.eventId==='string'&&e.eventId.trim()&&e.eventId.length<=160&&(cityForSector(e.sectorId,context)?.id===e.cityId||scenarioFor(context).legacyCityReceipt(e))&&
  (e.kind==='questWithdrawal'?validWithdrawalEvent(e,context):Object.hasOwn(CITY_LOYALTY_REWARDS,e.kind)&&e.delta===CITY_LOYALTY_REWARDS[e.kind])&&e.key===`${e.cityId}:${e.kind}:${e.eventId}`&&
  Number.isInteger(e.hour)&&e.hour>=0&&Number.isInteger(e.before)&&e.before>=0&&e.before<=100&&Number.isInteger(e.after)&&e.after>=0&&e.after<=100);
}
function validWithdrawalEvent(event,context){
 const city=campaignCities(context).find(c=>c.id===event.cityId),anchors=event.anchors;
 return city&&Number.isSafeInteger(event.delta)&&event.delta>=-20&&event.delta<=-1&&Number.isInteger(event.secondOfHour)&&event.secondOfHour>=0&&event.secondOfHour<3600&&Array.isArray(anchors)&&anchors.length===city.sectors.length&&anchors.every((a,i)=>a&&Object.keys(a).length===3&&a.sectorId===city.sectors[i]&&Number.isInteger(a.before)&&a.before>=0&&a.before<=100&&a.after===Math.max(0,a.before+event.delta))&&event.before===Math.floor(anchors.reduce((sum,a)=>sum+a.before,0)/anchors.length)&&event.after===Math.floor(anchors.reduce((sum,a)=>sum+a.after,0)/anchors.length);
}
