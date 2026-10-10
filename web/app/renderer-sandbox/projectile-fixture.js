import {createBattle} from '../../../game/tactical.js';

export const PROJECTILE_SCENARIO=Object.freeze({id:'projectiles',label:'Proyectiles',help:'Selecciona un caso y pulsa F. Dispara al Blanco o, en el caso de piedra, a la casilla F9. Reinicia para repetir. Los disparos usan las reglas y las cargas normales.'});
export const PROJECTILE_CASES=Object.freeze([
 {id:'hit',label:'Impacto en personaje'},
 {id:'miss',label:'Disparo fallado'},
 {id:'rock',label:'Impacto en piedra'},
 {id:'paired',label:'Dos pistolas'},
 {id:'gravity',label:'Caída a larga distancia'},
]);
export function projectileReviewOrder(id='hit'){
 return id==='rock'?{type:'firePoint',unitId:'projectile-gunner',x:8,y:5,aim:0}:{type:'fire',unitId:'projectile-gunner',targetId:'projectile-target',aim:0,hitLocation:'torso'};
}

/** Finite, declared firing setups. Review actions use the ordinary reducer. */
export function createProjectileReviewBattle(id='hit'){
 if(!PROJECTILE_CASES.some(item=>item.id===id))throw Error(`Unknown projectile case: ${id}`);
 const far=id==='gravity',width=far?44:28,height=14,miss=id==='miss'||far;
 const tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false,blocksSight:false}));
 if(id==='rock')Object.assign(tiles.find(tile=>tile.x===8&&tile.y===5),{type:'stone',material:'stone',cover:40,blocked:true,blocksSight:false,obstacleHeight:1.3,projectileResistance:100});
 const shooter={id:'projectile-gunner',name:'Tirador',nickname:'Tirador',x:3,y:5,facing:2,weapon:miss||id==='paired'?1805:1801,loaded:1,ammo:8,condition:100,marksmanship:miss?1:100,activeSlot:'primary',blade:0,spriteAppearance:'granadero',skinTone:'brown',...(id==='paired'?{offHand:{weapon:1806,count:1,weight:1.3,loaded:1,condition:100,jammed:false}}:{})};
 const observer=(key,x)=>({id:key,name:'Vigía',nickname:'Vigía',x,y:9,facing:0,weapon:1813,loaded:0,ammo:0,activeSlot:'unarmed',spriteAppearance:'worker',skinTone:'light'});
 const target={id:'projectile-target',name:'Blanco',x:far?34:9,y:id==='rock'?10:5,facing:6,weapon:1810,loaded:0,ammo:0,hp:100,morale:100,patrol:false,overwatch:false,spriteAppearance:'royalist',skinTone:'light'};
 return {...createBattle([shooter,observer('projectile-observer',17),...(far?[observer('projectile-far-observer',34)]:[])],{id:`renderer-projectile-${id}`,name:PROJECTILE_CASES.find(item=>item.id===id).label,width,height,tiles,enemies:[target],seed:id==='miss'?9:45,firstSide:'player',weather:{rain:0,humidity:0}}),deploymentComplete:true};
}
