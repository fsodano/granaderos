// Shared construction catalogue. Styles are interpretations of 1810–1820 architecture.
export const BUILDING_TYPES=Object.freeze({
 house:{name:'Casa colonial',roof:'terrace',wall:'#ddd1b2',trim:'#e8d8b5',height:46},
 farmhouse:{name:'Rancho de campo',roof:'thatch',wall:'#aa8860',trim:'#c1a77b',height:38},
 estancia:{name:'Casco de estancia',roof:'tile',wall:'#c28d7a',trim:'#f3e2bc',height:43,gallery:true},
 church:{name:'Iglesia colonial',roof:'tile',wall:'#ded9c2',trim:'#c4b08a',height:62,tower:true},
 mansion:{name:'Casa de altos',roof:'terrace',wall:'#849c9c',trim:'#eee0be',height:80,upper:true},
 cabildo:{name:'Cabildo de Buenos Aires',roof:'tile',wall:'#dec46f',trim:'#f3e8cf',height:80,upper:true,arcade:true,tower:true},
 pulperia:{name:'Pulpería',roof:'tile',wall:'#b09a58',trim:'#e3cea2',height:46,awning:true},
 warehouse:{name:'Almacén del puerto',roof:'tile',wall:'#a9785d',trim:'#d5bc90',height:54},
 barracks:{name:'Barraca del cuartel',roof:'tile',wall:'#9aab89',trim:'#e2d9b9',height:39},
});
// Neighbourhood dimensions fit the street grid; landmarks keep their authored plans.
export const BUILDING_FOOTPRINTS=Object.freeze({house:[4,4],farmhouse:[4,3],estancia:[6,4],church:[4,5],mansion:[5,5],cabildo:[8,4],pulperia:[5,4],warehouse:[5,5],barracks:[6,3]});
export const buildingStyle=b=>BUILDING_TYPES[b?.architecture]??BUILDING_TYPES.house;
export function sectorBuildingType(id,index=0,landmark=false){
 if(landmark)return ({buenos_aires:'cabildo',san_lorenzo:'church',yatasto:'estancia',retiro:'barracks',ensenada:'warehouse',mendoza:'warehouse',cordoba:'warehouse'})[id]??'house';
 const types=id==='buenos_aires'?['mansion','pulperia','house','mansion','church']:id==='retiro'?['barracks','warehouse','pulperia']:id==='ensenada'?['warehouse','pulperia','house']:['yatasto','san_lorenzo'].includes(id)?['farmhouse','estancia','farmhouse','pulperia']:['house','pulperia','farmhouse','mansion','church','estancia'];
 return types[index%types.length];
}
