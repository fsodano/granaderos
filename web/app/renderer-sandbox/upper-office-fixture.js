import {createBattle} from '../../../game/tactical.js';
import {placeBuilding,buildTerrace} from '../../../game/buildings.js';

export const UPPER_OFFICE_SCENARIO=Object.freeze({id:'upper-office',label:'Oficina superior',help:'El Granadero está al pie de una trampilla de tres metros. El vigía descubre el despacho superior por la percepción normal. Selecciona el Granadero y usa Subir o Bajar; después recorre el piso para revisar el apoyo, las juntas de madera y la tapa.'});
export function createUpperOfficeBattle(){
 const width=16,height=14,id='floor-review-house',roomId=`${id}:upper-office`;
 const ground=Array.from({length:width*height},(_,n)=>({x:n%width,y:Math.floor(n/width),type:'grass',cover:0,blocked:false}));
 const placed=placeBuilding(ground,{id,name:'Despacho sobre la casa',x:4,y:3,width:7,height:7,architecture:'house',roof:'terrace',doors:[{id:`${id}:entrance`,x:7,y:9,open:true}],windows:[{x:4,y:6},{x:10,y:6}]});
 const upperRoom={id:roomId,name:'Despacho superior',purpose:'office',tacticalLevel:1,cells:Array.from({length:25},(_,n)=>({x:5+n%5,y:4+Math.floor(n/5),tacticalLevel:1}))};
 const building={...placed.building,rooms:[{...placed.building.rooms[0],name:'Sala familiar',purpose:'reception'},upperRoom]};
 const terrace=buildTerrace(building,{elevation:3,climbPoints:[{id:'office-hatch',from:{x:7,y:6},to:{x:7,y:6}}]});
 const cells=new Set(upperRoom.cells.map(p=>`${p.x},${p.y}`));
 const upperSurfaces=terrace.upperSurfaces.map(surface=>({...surface,...(cells.has(`${surface.x},${surface.y}`)?{roomId}:{}),material:'wood'}));
 const common={weapon:1800,loaded:1,ammo:12,blade:1810,activeSlot:'unarmed',condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,headwear:null,outfit:null,legwear:null};
 const squad=[{...common,id:'office-climber',name:'Granadero de la oficina',nickname:'Oficina',x:7,y:6,facing:4,spriteAppearance:'granadero',skinTone:'brown'}, {...common,id:'office-watch',name:'Vigía del despacho',nickname:'Vigía',x:8,y:7,tacticalLevel:1,facing:0,spriteAppearance:'worker',skinTone:'brown'}];
 return {...createBattle(squad,{id:'renderer-upper-office',name:'Piso del despacho superior',width,height,tiles:placed.tiles,buildings:[building],upperSurfaces,climbLinks:terrace.climbLinks,enemies:[],exploration:true,seed:45}),deploymentComplete:true};
}
