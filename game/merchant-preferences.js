// Period-game adaptation: these percentages are not historical market prices.
// Every offer remains below the 80% used-stock purchase rate in every town.
const cavalry=new Set([1803,1805,1809,1810,1812,1813]);
const artillery=new Set(['bronze4','field8','swivel']);
const profiles={
 retiro:{name:'Maestranza de Retiro',description:'Compra armamento de todo tipo al 40% del valor nuevo, ajustado por su estado.'},
 cordoba:{name:'Talleres de Caroya',description:'Prefiere tercerolas, pistolas de arzón, sables, lanzas y facones: ofrece el 50% del valor nuevo. Otros equipos: 30%. No compra armas de mano con menos de 25% de estado.'},
 mendoza:{name:'Fundición de El Plumerillo',description:'Prefiere cañones y pedreros: ofrece el 50% del valor nuevo. Otros equipos: 40%. Acepta armas dañadas que conserven valor de recuperación.'},
};
export function merchantProfile(sector){return profiles[sector]??null;}
export function merchantBuyingTerms(sector,item){
 const preferred=sector==='cordoba'&&cavalry.has(Number(item))||sector==='mendoza'&&artillery.has(item);
 const percent=preferred?50:sector==='cordoba'?30:40;
 return {percent,fraction:percent/100,preferred};
}
export function merchantWeaponRefusal(sector,instance){
 return sector==='cordoba'&&instance.condition<25?'Caroya no compra armas de mano con menos de 25% de estado. Repara el arma o busca otra maestranza.':null;
}
