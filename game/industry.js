// Resource sites are campaign abstractions, not an archaeological deposit survey.
export const MATERIAL_STOCK={timber:60,scrapIron:40,lead:80,leather:60,saltpeter:30,charcoal:40,sulfur:20};
export const MATERIAL_SITES={
 cordoba:{timber:20,scrapIron:8},santa_fe:{timber:15,leather:12},
 mendoza:{copper:4,charcoal:10,sulfur:4},salta:{lead:10,saltpeter:12},
 tucuman:{saltpeter:10,leather:10},san_nicolas:{scrapIron:8,leather:10},
};
export function materialYield(state,supplied){
 const out={};for(const [id,goods]of Object.entries(MATERIAL_SITES))if(state.sectors[id]?.owner==='patriot'&&state.sectors[id].damageUntil<=state.hour&&supplied(state,id))for(const [key,n]of Object.entries(goods))out[key]=(out[key]??0)+n;
 return out;
}
export function productionHours(state,recipe,supplied){
 const sites=Object.keys(MATERIAL_SITES).filter(id=>state.sectors[id]?.owner==='patriot'&&state.sectors[id].damageUntil<=state.hour&&supplied(state,id)).length;
 return Math.max(1,Math.ceil(recipe.hours/(1+sites*.1)));
}
export function migrateMaterials(state){
 if(state.resources&&typeof state.resources==='object')for(const key of Object.keys(MATERIAL_STOCK))if(state.resources[key]===undefined)state.resources[key]=0;
}
