import {createBattle} from '../../../game/tactical.js';

export const CLIMB_HATCH_SCENARIO=Object.freeze({id:'climb-hatches',label:'Escaleras y trampillas',help:'Granadero: trampilla de tres metros. Mujer con rebozo: trampilla de 4,2 metros. Selecciona cada personaje y sube o baja en su misma casilla con las órdenes habituales. Recorre la plataforma para comprobar el apoyo de la tapa cerrada.'});
export function createClimbHatchBattle(){
  const width=12,height=10,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'stone',blocked:false,cover:0}));
  const places=[{id:'hatch-man',name:'Granadero de la trampilla',x:3,y:4,elevation:3,spriteAppearance:'granadero'},{id:'hatch-woman',name:'Mujer de la trampilla',x:8,y:4,elevation:4.2,spriteAppearance:'woman-shawl'}];
  const upperSurfaces=places.flatMap(place=>Array.from({length:9},(_,i)=>({id:`${place.id}:roof:${i}`,x:place.x-1+i%3,y:place.y-1+Math.floor(i/3),tacticalLevel:1,type:'floor',kind:'platform',cover:0,elevation:place.elevation,slabThickness:.2,blocked:false})));
  const climbLinks=places.map(place=>({id:place.id,kind:'climb',from:{x:place.x,y:place.y},to:{x:place.x,y:place.y,tacticalLevel:1}}));
  const squad=places.map(({elevation,...place})=>({...place,nickname:place.name,facing:4,weapon:1800,blade:1810,loaded:1,ammo:12,activeSlot:'unarmed',headwear:null,outfit:null,legwear:null,condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,experienceLevel:7}));
  return {...createBattle(squad,{id:'renderer-climb-hatches',name:'Escaleras y trampillas',width,height,tiles,upperSurfaces,climbLinks,enemies:[],exploration:true,seed:45}),deploymentComplete:true};
}
