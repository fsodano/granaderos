import {createBattle,actBattle} from '../../../game/tactical.js';

export const BAYONET_SCENARIO=Object.freeze({id:'bayonets',label:'Bayonetas',help:'Bayoneta fijada al Brown Bess. Selecciona cada combatiente, pulsa B y ataca al blanco cercano para comparar la estocada. El fusil conserva su carga.'});

/** Both assemblies start as owned loose items and use the ordinary paid fit. */
export function createBayonetReviewBattle(){
  const squad=['male','female'].map((anatomy,index)=>({id:`bayonet-${anatomy}`,name:index?'Bayoneta femenina':'Bayoneta',nickname:index?'Bayoneta femenina':'Bayoneta',x:6,y:6+index*6,facing:2,weapon:1800,weaponInstanceId:`review-rifle-${anatomy}`,loaded:1,ammo:12,blade:1811,bladeInstanceId:`review-socket-${anatomy}`,bladeFittingPattern:'india_socket',bladeCondition:100,activeSlot:'primary',condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,wisdom:80,experienceLevel:7,spriteAppearance:index?'woman-scout':'granadero',skinTone:index?'light':'brown',headwear:null,outfit:null,legwear:null}));
  const enemies=squad.map((unit,index)=>({id:`target-${unit.id}`,name:index?'Blanco femenino':'Blanco masculino',x:7,y:unit.y,facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,marksmanship:55,spriteAppearance:'royalist',skinTone:'light'}));
  const width=24,height=20;
  let battle=createBattle(squad,{id:'renderer-bayonets',name:'Bayonetas',width,height,seed:45,firstSide:'player',tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),enemies});
  for(const unit of squad){battle=actBattle(battle,{type:'fitBayonet',unitId:unit.id,item:'blade'});if(battle.lastError)throw Error(`Bayonet review preparation failed: ${battle.lastError}`);}
  return {...battle,deploymentComplete:true};
}
