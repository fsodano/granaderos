import {createBattle,actBattle} from '../../../game/tactical.js';

export const PARTIAL_LOADING_SCENARIO=Object.freeze({id:'partial-loading',label:'Recarga interrumpida',help:'El fusil disparó, recargó y volvió a disparar con las órdenes normales. Quedan 7,75 PA: recarga para ver el trabajo parcial, termina el turno y continúa. Los cartuchos se descuentan al completar la carga.'});

/** An unfinished charge must come from paid orders, not an edited AP balance. */
export function createPartialLoadingBattle(){
  const width=24,height=20;
  const loader={id:'partial-loader',name:'Fusil',nickname:'Fusil',x:4,y:5,facing:2,weapon:1800,loaded:1,ammo:12,blade:1810,activeSlot:'primary',condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,experienceLevel:7,spriteAppearance:'granadero',skinTone:'brown',headwear:null,outfit:null,legwear:null};
  const target={id:'partial-target',name:'Blanco de fusil',x:10,y:5,facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,marksmanship:55,spriteAppearance:'royalist',skinTone:'light'};
  const reserve={...target,id:'partial-reserve',name:'Reserva distante',x:21,y:18,weapon:1810,loaded:0,ammo:0};
  let battle=createBattle([loader],{id:'renderer-partial-loading',name:'Recarga interrumpida',width,height,seed:45,firstSide:'player',tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),enemies:[target,reserve]});
  for(const action of [{type:'fire',targetId:target.id,aim:0},{type:'reload'},{type:'fire',targetId:target.id,aim:0}]){
    battle=actBattle(battle,{...action,unitId:loader.id});
    if(battle.lastError)throw Error(`Partial-loading fixture preparation failed: ${battle.lastError}`);
  }
  return {...battle,deploymentComplete:true};
}
