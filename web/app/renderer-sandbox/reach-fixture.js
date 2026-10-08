import {createBattle} from '../../../game/tactical.js';

export const REACH_SCENARIO=Object.freeze({id:'reach-actions',label:'Vendas, recogida y liberación',help:'Dos grupos con vendas propias, un herido, un bulto cercano y un combatiente enredado. Usa Vendar, recoger equipo del suelo y Liberarse para comparar los apoyos durante las órdenes habituales.'});

/** Finite supplies and real target conditions; each order uses the normal HUD. */
export function createReachReviewBattle(){
  const squad=[],groundItems=[];
  for(const [index,anatomy]of ['male','female'].entries()){
    const y=4+index*12,appearance=index?'woman-scout':'granadero';
    const unit=(role,label,row,extra={})=>({id:`reach-${role}-${anatomy}`,name:role==='healer'?(index?'Sanitaria':'Sanitario'):role==='patient'?(index?'Herida':'Herido'):`${label} ${index?'femenina':'masculina'}`,nickname:label,x:6,y:row,facing:2,weapon:1800,weaponInstanceId:`reach-${role}-${anatomy}-rifle`,loaded:1,ammo:12,blade:0,condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,medical:70,experienceLevel:7,activeSlot:'primary',medkits:2,rations:0,torches:0,boleadoras:0,spriteAppearance:appearance,skinTone:index?'light':'brown',headwear:null,outfit:null,legwear:null,...extra});
    squad.push(unit('healer','Sanitario',y,{activeSlot:'medical'}));
    squad.push(unit('patient','Herido',y,{x:7,hp:60,bleeding:10,bandaged:0,medkits:0}));
    squad.push(unit('pickup','Recogida',y+4));
    squad.push(unit('free','Liberación',y+8,{entangled:true}));
    groundItems.push({id:`reach-dressings-${anatomy}`,type:'item',item:'medkits',count:2,weight:.2,x:7,y:y+4,knownToPlayer:true});
    groundItems.push({id:`reach-bolas-${anatomy}`,type:'boleadoras',count:1,x:6,y:y+8,heldBy:`reach-free-${anatomy}`,knownToPlayer:true});
  }
  const width=24,height=30;
  return {...createBattle(squad,{id:'renderer-reach-actions',name:'Apoyo al atender y recoger',width,height,seed:45,firstSide:'player',tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),groundItems,enemies:[{id:'reach-observer',name:'Observador',x:21,y:27,facing:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false,spriteAppearance:'royalist'}]}),deploymentComplete:true};
}
