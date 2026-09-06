import {incomeSources} from './economy.js';
// Approximate geographic anchors; operational areas are not surveyed city limits.
export const MAP_PLACES = Object.freeze({
 buenos_aires:{lon:-58.373,lat:-34.608,label:'Buenos Aires',dx:-12,dy:32},
 retiro:{lon:-58.381,lat:-34.59,label:'Retiro',dx:30,dy:-20},
 ensenada:{lon:-57.91,lat:-34.86,label:'Ensenada',dx:28,dy:28},
 san_nicolas:{lon:-60.22,lat:-33.33,label:'San Nicolás',dx:18,dy:8},
 santa_fe:{lon:-60.7,lat:-31.63,label:'Santa Fe',dx:17,dy:0},
 cordoba:{lon:-64.19,lat:-31.42,label:'Córdoba',dx:15,dy:0},
 mendoza:{lon:-68.84,lat:-32.89,label:'Mendoza',dx:15,dy:16},
 uspallata:{lon:-69.35,lat:-32.59,label:'Uspallata',dx:16,dy:-16},
 los_patos:{lon:-70.42,lat:-32.4,label:'Los Patos',dx:-12,dy:-26},
 tucuman:{lon:-65.22,lat:-26.83,label:'San Miguel de Tucumán',dx:17,dy:5},
 salta:{lon:-65.41,lat:-24.79,label:'Salta',dx:17,dy:5},
 jujuy:{lon:-65.3,lat:-24.19,label:'San Salvador de Jujuy',dx:17,dy:0},
 humahuaca:{lon:-65.35,lat:-23.2,label:'Humahuaca',dx:17,dy:0},
});
// Equirectangular projection, with longitude scaled at 30 degrees south.
export function project(lon,lat){return {x:36+(lon+72)*36.37,y:36+(-22-lat)*42};}
export function sectorPosition(id){const p=MAP_PLACES[id];return p?project(p.lon,p.lat):null;}
export function sectorIncome(state,def){
 return incomeSources(state).find(source=>source.id===def.id)?.income??0;
}
export const MAP_MODES=Object.freeze([
 {id:'cities',label:'Ciudades'}, {id:'resources',label:'Recursos'},
 {id:'squads',label:'Escuadras'}, {id:'militia',label:'Milicias'},
 {id:'horses',label:'Caballos'}, {id:'items',label:'Objetos'},
]);

// Enlarged urban footprints on one shared map grid. Districts are display areas
// of existing operational sectors, not new income sources or tactical maps.
export const MAP_TILE_SIZE=18;
const URBAN_TILES={
 buenos_aires:[[25,28,'Barrio del oeste'],[26,28,'San Nicolás'],[25,29,'Monserrat'],[26,29,'Plaza Mayor'],[27,29,'Fuerte y ribera'],[26,30,'San Telmo']],
 retiro:[[27,28,'Cuarteles de Retiro']],
 ensenada:[[28,30,'Puerto de Barragán'],[29,30,'Batería costera'],[28,31,'Poblado de Ensenada']],
 san_nicolas:[[22,26,'Plaza'],[23,26,'Ribera'],[22,27,'Arrabales']],
 santa_fe:[[21,22,'Cabildo'],[22,22,'Puerto'],[21,23,'Plaza'],[22,23,'Arrabales']],
 cordoba:[[14,20,'Arrabal norte'],[14,21,'Cabildo'],[15,21,'Plaza Mayor'],[16,21,'Ribera'],[14,22,'Talleres'],[15,22,'Arrabal sur']],
 mendoza:[[6,25,'Plaza'],[7,25,'Cabildo'],[6,26,'Acequias'],[7,26,'Chacras']],
 tucuman:[[12,11,'Cabildo'],[13,11,'Plaza'],[12,12,'La Ciudadela'],[13,12,'Arrabales']],
 salta:[[12,7,'Cabildo'],[13,7,'Plaza'],[14,7,'Cuarteles'],[13,8,'Arrabales']],
 jujuy:[[12,5,'Cabildo'],[13,5,'Plaza'],[14,5,'Ribera']],
};
/** @returns {Array<{id:string,sectorId:string,col:number,row:number,name:string,x:number,y:number,urban:boolean}>} */
export function mapTilesForSector(id){
 const p=sectorPosition(id);if(!p)return [];
 const cells=URBAN_TILES[id]??[[Math.floor((p.x-36)/MAP_TILE_SIZE),Math.floor((p.y-36)/MAP_TILE_SIZE),MAP_PLACES[id].label]];
 return cells.map(([col,row,name],index)=>({id:`${id}:${index}`,sectorId:id,col,row,name,x:36+col*MAP_TILE_SIZE,y:36+row*MAP_TILE_SIZE,urban:Boolean(URBAN_TILES[id])}));
}
export function mapTileBounds(tiles){
 return {left:Math.min(...tiles.map(t=>t.x)),top:Math.min(...tiles.map(t=>t.y)),right:Math.max(...tiles.map(t=>t.x+MAP_TILE_SIZE)),bottom:Math.max(...tiles.map(t=>t.y+MAP_TILE_SIZE))};
}
// Only external edges are emphasized; internal grid lines remain visible.
export function mapTileOutline(tiles){
 const occupied=new Set(tiles.map(t=>`${t.col},${t.row}`));
 return tiles.flatMap(t=>[
  !occupied.has(`${t.col},${t.row-1}`)?`M${t.x},${t.y}h${MAP_TILE_SIZE}`:'',
  !occupied.has(`${t.col+1},${t.row}`)?`M${t.x+MAP_TILE_SIZE},${t.y}v${MAP_TILE_SIZE}`:'',
  !occupied.has(`${t.col},${t.row+1}`)?`M${t.x},${t.y+MAP_TILE_SIZE}h${MAP_TILE_SIZE}`:'',
  !occupied.has(`${t.col-1},${t.row}`)?`M${t.x},${t.y}v${MAP_TILE_SIZE}`:'',
 ]).filter(Boolean).join(' ');
}
