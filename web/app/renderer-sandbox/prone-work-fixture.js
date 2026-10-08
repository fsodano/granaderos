import {createBattle} from '../../../game/tactical.js';

export const PRONE_WORK_TASKS=Object.freeze([
  {id:'rifle-prime',label:'Cebar fusil',weapon:1800,jammed:true},
  {id:'rifle-unload',label:'Descargar fusil',weapon:1800},
  {id:'pistol-prime',label:'Cebar pistola',weapon:1805,jammed:true},
  {id:'pistol-repair',label:'Mantener pistola',weapon:1805,condition:61},
  {id:'pistol-reload',label:'Recargar pistola',weapon:1805,loaded:0},
]);
export const PRONE_WORK_SCENARIO=Object.freeze({id:'prone-work',label:'Armas cuerpo a tierra',help:'Dos combatientes con armas propias y cartuchos finitos. Elige el trabajo. Usa Mayús + R para cebar o recargar, Equipo para mantener el arma, o su tarjeta para descargarla. Reinicia para repetir.'});

export function createProneWorkReviewBattle(taskId='rifle-prime'){
  const task=PRONE_WORK_TASKS.find(item=>item.id===taskId);
  if(!task)throw Error(`Unknown prone firearm task: ${taskId}`);
  const squad=['male','female'].map((anatomy,index)=>({id:index?'crawler-woman':'crawler',name:index?'Arrastre femenino':'Arrastre',nickname:index?'Arrastre femenino':'Arrastre',x:4,y:13+index*3,facing:2,weapon:task.weapon,weaponInstanceId:`review-prone-${anatomy}-${task.weapon}`,loaded:task.loaded??1,ammo:8,condition:task.condition??91,jammed:Boolean(task.jammed),toolkitPoints:50,activeSlot:'primary',blade:0,stance:'prone',movementMode:'prone',energy:100,agility:90,dexterity:90,wisdom:90,strength:90,marksmanship:85,mechanical:90,experienceLevel:7,spriteAppearance:index?'woman-scout':'granadero',skinTone:index?'light':'brown',headwear:null,outfit:null,legwear:null}));
  const width=24,height=24;
  return {...createBattle(squad,{id:`renderer-prone-work-${taskId}`,name:'Trabajo de armas cuerpo a tierra',width,height,seed:45,firstSide:'player',tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),enemies:[{id:'prone-work-observer',name:'Observador',x:22,y:22,facing:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false,spriteAppearance:'royalist'}]}),deploymentComplete:true};
}
