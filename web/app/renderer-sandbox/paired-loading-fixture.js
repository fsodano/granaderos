import {createBattle} from '../../../game/tactical.js';
export const PAIRED_LOADING_SCENARIO=Object.freeze({id:'paired-loading',label:'Recarga de dos pistolas',help:'Dos pistolas: recarga ambas con R. Segunda pistola: la principal ya está cargada; R recarga la pistola de la otra mano. Compara el arma sostenida, la mano de trabajo y la recuperación. Cada recarga usa los cartuchos y puntos de acción habituales.'});
export function createPairedLoadingBattle(){
 const soldier=(id,name,y,appearance,loaded)=>({id,name,x:3,y,facing:2,weapon:1805,loaded,ammo:8,blade:0,activeSlot:'primary',condition:81,weaponInstanceId:`${id}:right`,offHand:{weapon:1806,loaded:0,count:1,weight:1.2,condition:57,jammed:false,instanceId:`${id}:left`},spriteAppearance:appearance,skinTone:'brown',headwear:null,outfit:null,legwear:null});
 const width=18,height=14;
 return {...createBattle([soldier('paired-loader','Dos pistolas',4,'granadero',0),soldier('offhand-loader','Segunda pistola',8,'woman-scout',1)],{id:'renderer-paired-loading',name:'Recarga de dos pistolas',width,height,seed:45,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),enemies:[{id:'loading-reserve',name:'Guardia de reserva',x:16,y:12,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}]}),deploymentComplete:true};
}
