import {wallEdgeCells} from '../../../game/wall-geometry.js';
import {BUILDING_TEMPLATES} from '../../../game/map-templates.js';
import {blankMap} from '../../../game/map-schema.js';
import {applyMapCommands} from '../../../game/map-commands.js';
import {compileMap} from '../../../game/compile-map.js';
import {entranceFrame} from '../../../game/building-profile.js';
import {buildTerrace} from '../../../game/buildings.js';
import {createBattle} from '../../../game/tactical.js';
export const VARIED_ROOF_CLIMB_SCENARIO=Object.freeze({id:'varied-roof-climbs',label:'Azoteas a distintas alturas',help:'Accesos reales con terreno elevado. Selecciona un caso y usa las casillas o las órdenes Subir y Bajar. Los dos desplazamientos gastan los PA habituales.'});
export const ROOF_CLIMB_CASES=Object.freeze([
 {id:'tall-cardinal',label:'Casa de 5,6 m, base de 1,2 m',height:5.6,base:1.2,appearance:'granadero',vertical:false},
 {id:'raised-vertical',label:'Trampilla de 4,2 m, base de 1,1 m',height:4.2,base:1.1,appearance:'woman-scout',vertical:true},
 {id:'tall-return',label:'Casa de 6 m, base de 1,7 m',height:6,base:1.7,appearance:'woman-scout',vertical:false},
 {id:'low-vertical',label:'Trampilla de 2 m, base de 0,4 m',height:2,base:.4,appearance:'granadero',vertical:true},
]);
export function createVariedRoofClimbBattle(id='tall-cardinal'){
 const item=ROOF_CLIMB_CASES.find(c=>c.id===id);if(!item)throw Error('Unknown roof climb case');
 const size=18,result=applyMapCommands(blankMap({id:`roof-climb-${id}`,title:item.label,width:size,height:size}),[{type:'stampTemplate',id:'climb-house',template:BUILDING_TEMPLATES.casa,x:5,y:5},{type:'setObject',id:'climb-house',values:{roof:'terrace'}}]);if(result.errors.length)throw Error(result.errors.join('; '));
 const map=compileMap(result.document),building=map.buildings[0],frame=entranceFrame(building),entry=map.wallEdges.find(edge=>edge.doorId===frame.door.doorId),adjacent=wallEdgeCells(entry),inside=adjacent.find(cell=>cell.x>=building.x&&cell.x<building.x+building.width&&cell.y>=building.y&&cell.y<building.y+building.height),outside=adjacent.find(cell=>cell!==inside),from=item.vertical?{x:inside.x+frame.v.x,y:inside.y+frame.v.y}:outside,to=item.vertical?from:inside,upper=buildTerrace(building,{elevation:item.base+item.height,climbPoints:[{id:'height-access',from:{x:from.x,y:from.y},to:{x:to.x,y:to.y}}]});map.tiles=map.tiles.map(tile=>({...tile,elevation:item.base}));
 const squad=[{id:'height-climber',name:'Escalador de la casa',nickname:'Escalador',...from,spriteAppearance:item.appearance,activeSlot:'unarmed',weapon:1800,blade:1810,loaded:1,ammo:12,headwear:null,outfit:null,legwear:null,condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,experienceLevel:7},{id:'height-watch',name:'Vigía de la azotea',nickname:'Vigía',...{x:Math.round(frame.at(frame.doorU+2,frame.depth-2).x),y:Math.round(frame.at(frame.doorU+2,frame.depth-2).y)},tacticalLevel:1,spriteAppearance:'worker',weapon:0,blade:0,activeSlot:'unarmed',headwear:null,outfit:null,legwear:null}];
 return {...createBattle(squad,{...map,...upper,id:`renderer-varied-roof-${id}`,name:item.label,seed:45,firstSide:'player',enemies:[{id:'height-observer',name:'Observador distante',x:16,y:1,weapon:0,hp:100,patrol:false,overwatch:false}]}),deploymentComplete:true};
}
