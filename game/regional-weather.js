import {worldCell} from './world-cells.js';
// Regional game tuning, not a reconstruction of observed weather in 1812.
// Rain is the existing 0–100 intensity; humidity is the existing ignition penalty.
export const REGIONAL_CLIMATES={
 plata:{name:'Llanura húmeda del Plata',terrain:'Llanura, calles y ribera',humidity:[8,7,7,8],rain:[32,27,22,30]},
 parana:{name:'Litoral del Paraná',terrain:'Ribera, humedales y caminos',humidity:[9,8,7,8],rain:[38,30,22,33]},
 central:{name:'Interior serrano',terrain:'Monte y terreno pedregoso',humidity:[5,4,3,4],rain:[28,15,7,20]},
 cuyo:{name:'Cuyo seco',terrain:'Piedemonte y oasis',humidity:[3,2,2,2],rain:[13,6,3,8]},
 yungas:{name:'Valles húmedos del norte',terrain:'Bosque y valles serranos',humidity:[9,7,4,6],rain:[48,25,7,28]},
 quebrada:{name:'Quebrada seca de altura',terrain:'Roca y vegetación escasa',humidity:[4,3,2,3],rain:[19,8,2,9]},
 andes:{name:'Alta cordillera',terrain:'Pasos rocosos de montaña',humidity:[2,2,2,2],rain:[5,3,0,3]},
};
export const WEATHER_INTERVAL_HOURS=6;
const regions={retiro:'plata',buenos_aires:'plata',ensenada:'plata',san_nicolas:'parana',san_lorenzo:'parana',santa_fe:'parana',cordoba:'central',mendoza:'cuyo',uspallata:'andes',los_patos:'andes',tucuman:'yungas',yatasto:'yungas',salta:'yungas',jujuy:'yungas',humahuaca:'quebrada'};
export function regionalClimate(sector){const cell=worldCell(sector),id=Object.hasOwn(regions,sector)?regions[sector]:cell?.land?(regions[cell.locality]??(cell.biome==='mountain'?'andes':cell.biome==='wetland'?'parana':cell.theater==='north'?'yungas':cell.theater==='cuyo'?'cuyo':'central')):null;return id?{id,...REGIONAL_CLIMATES[id]}:null;}
export function campaignSeason(hour=0){if(!Number.isFinite(hour)||hour<0)throw Error('La hora del clima no es válida.');const month=(2+Math.floor(hour/720))%12+1;const index=month===12||month<=2?0:month<=5?1:month<=8?2:3;return {index,month,name:['Verano','Otoño','Invierno','Primavera'][index]};}
function weatherRoll(region,block){let h=2166136261;for(const c of `${region}:${block}:1812`)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x45d9f3b);return (h>>>0)%100;}
export function regionalWeatherAt(sector,hour=0){
 const climate=regionalClimate(sector);if(!climate)throw Error('La región climática no existe.');
 if(!Number.isFinite(hour)||hour<0)throw Error('La hora del clima no es válida.');
 const season=campaignSeason(hour).index,block=Math.floor(hour/WEATHER_INTERVAL_HOURS),roll=weatherRoll(climate.id,block);
 const wet=roll<climate.rain[season];
 return {rain:wet?(roll%3===0?60:roll%3===1?25:40):0,humidity:climate.humidity[season]+(wet?1:0)};
}
export function regionalConditions(sector,hour){return {regionalWeather:true,weather:regionalWeatherAt(sector,hour)};}
export function validateRegionalWeather(s){
 if(s.regionalWeather!==undefined&&typeof s.regionalWeather!=='boolean')throw Error('El origen del clima no es válido.');
 if(s.regionalWeather){
  if(!regionalClimate(s.sectorId??s.sector))throw Error('La región climática no existe.');
  if(!s.weather||!['rain','humidity'].every(key=>Number.isFinite(s.weather[key])&&s.weather[key]>=0&&s.weather[key]<=100))throw Error('El clima regional no es válido.');
 }
}
export function regionalWeatherLabel(weather){return weather.rain>=50?'Lluvia intensa':weather.rain>0?'Lluvia':'Sin lluvia';}
