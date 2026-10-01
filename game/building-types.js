import {BUILDING_VERTICAL_SCALE as S} from './building-scale.js';

// Shared construction catalogue. Styles are interpretations of 1810–1820 architecture.
export const BUILDING_TYPES=Object.freeze({
 house:{name:'Casa colonial',roof:'terrace',wall:'#ddd1b2',trim:'#e8d8b5',height:46*S},
 farmhouse:{name:'Rancho de campo',roof:'thatch',wall:'#aa8860',trim:'#c1a77b',height:38*S},
 estancia:{name:'Casco de estancia',roof:'tile',wall:'#c28d7a',trim:'#f3e2bc',height:43*S,gallery:true},
 church:{name:'Iglesia colonial',roof:'tile',wall:'#ded9c2',trim:'#c4b08a',height:62*S,tower:true},
 mansion:{name:'Casa de altos',roof:'terrace',wall:'#849c9c',trim:'#eee0be',height:80*S,upper:true},
 cabildo:{name:'Cabildo de Buenos Aires',roof:'tile',wall:'#dec46f',trim:'#f3e8cf',height:80*S,upper:true,arcade:true,tower:true},
 pulperia:{name:'Pulpería',roof:'tile',wall:'#b09a58',trim:'#e3cea2',height:46*S,awning:true},
 warehouse:{name:'Almacén del puerto',roof:'tile',wall:'#a9785d',trim:'#d5bc90',height:54*S},
 barracks:{name:'Barraca del cuartel',roof:'tile',wall:'#9aab89',trim:'#e2d9b9',height:39*S},
});
// Neighbourhood dimensions fit the street grid; landmarks keep their authored plans.
export const BUILDING_FOOTPRINTS=Object.freeze({house:[6,5],farmhouse:[6,4],estancia:[8,5],church:[6,7],mansion:[7,6],cabildo:[11,6],pulperia:[7,5],warehouse:[7,6],barracks:[8,4]});
export const buildingStyle=b=>BUILDING_TYPES[b?.architecture]??BUILDING_TYPES.house;
export function sectorBuildingType(id,index=0,landmark=false){
 if(landmark)return ({buenos_aires:'cabildo',san_lorenzo:'church',yatasto:'estancia',retiro:'barracks',ensenada:'warehouse',mendoza:'warehouse',cordoba:'warehouse'})[id]??'house';
 const types=id==='buenos_aires'?['mansion','pulperia','house','mansion','church']:id==='retiro'?['barracks','warehouse','pulperia']:id==='ensenada'?['warehouse','pulperia','house']:['yatasto','san_lorenzo'].includes(id)?['farmhouse','estancia','farmhouse','pulperia']:['house','pulperia','farmhouse','mansion','church','estancia'];
 return types[index%types.length];
}
