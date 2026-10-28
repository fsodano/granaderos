import {DEFAULT_PHYSICAL,finiteCachesFor} from './campaign-physical.js';

// Legacy catalogue fields remain derived views of the one campaign source.
// Runtime contents always come from the pinned campaign world.
const quantity=(cache,predicate)=>cache.contents.filter(predicate).reduce((sum,item)=>sum+item.count,0);
export const FINITE_SECTOR_CACHES=Object.freeze(Object.fromEntries(Object.entries(DEFAULT_PHYSICAL.caches).map(([sector,cache])=>[sector,Object.freeze({
 chest:cache.chest,guns:cache.contents.filter(item=>item.weapon!==undefined).map(item=>item.weapon),
 musket:quantity(cache,item=>item.ammoType==='musket_75'),rifle:quantity(cache,item=>item.ammoType==='rifle_62'),
 pistol:quantity(cache,item=>item.ammoType==='pistol_69'),shot:quantity(cache,item=>item.ammoType==='shot_16'),medical:quantity(cache,item=>item.item==='medkits'),
})])));
export function finiteSectorCache(sector,map,context=map){
 const cache=finiteCachesFor(context)[sector];
 if(!cache||(map.props??[]).every(prop=>prop.type!=='chest'||prop.id!==cache.chest))return null;
 return {id:cache.chest,type:'chest',open:false,locked:false,contents:structuredClone(cache.contents)};
}
