// Shared construction catalogue. Styles are interpretations of 1810–1820 architecture.
export const BUILDING_TYPES=Object.freeze({
 house:{name:'Casa colonial',roof:'tile',wall:'#d3c49e',trim:'#e8d8b5',height:46},
 farmhouse:{name:'Rancho de campo',roof:'thatch',wall:'#aa9168',trim:'#c1a77b',height:38},
 estancia:{name:'Casco de estancia',roof:'tile',wall:'#e0cfaa',trim:'#f3e2bc',height:48,gallery:true},
 church:{name:'Iglesia colonial',roof:'tile',wall:'#dfd7bb',trim:'#eddfbd',height:62,tower:true},
 mansion:{name:'Casa de altos',roof:'terrace',wall:'#c4b090',trim:'#eee0be',height:80,upper:true},
 cabildo:{name:'Cabildo de Buenos Aires',roof:'tile',wall:'#dfd8bd',trim:'#f3e8cf',height:86,upper:true,arcade:true,tower:true},
 pulperia:{name:'Pulpería',roof:'tile',wall:'#c5b58b',trim:'#e3cea2',height:46,awning:true},
 warehouse:{name:'Almacén del puerto',roof:'tile',wall:'#b09c77',trim:'#d5bc90',height:54},
 barracks:{name:'Barraca del cuartel',roof:'tile',wall:'#c4bfa5',trim:'#e2d9b9',height:46},
});
export const buildingStyle=b=>BUILDING_TYPES[b?.architecture]??BUILDING_TYPES.house;
export function sectorBuildingType(id,index=0,landmark=false){
 if(landmark)return ({buenos_aires:'cabildo',san_lorenzo:'church',yatasto:'estancia',retiro:'barracks',ensenada:'warehouse',mendoza:'warehouse',cordoba:'warehouse'})[id]??'house';
 const types=id==='buenos_aires'?['mansion','pulperia','house','mansion','church']:id==='retiro'?['barracks','warehouse','pulperia']:id==='ensenada'?['warehouse','pulperia','house']:['yatasto','san_lorenzo'].includes(id)?['farmhouse','estancia','farmhouse','pulperia']:['house','pulperia','farmhouse','mansion','church','estancia'];
 return types[index%types.length];
}
