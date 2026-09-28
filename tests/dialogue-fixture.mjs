import {localPackage} from './local-contract-fixture.mjs';
export function dialoguePackage(){
 const d=localPackage({pay:0,service:'permanent'});
 d.characters.at(-1).encounter.dialogue={entry:'start',nodes:[
  {id:'start',title:'Inicio',text:'El camino tiene dos salidas.\nPuedo explicarlas.',choices:[{id:'north',label:'Contame sobre el norte.',next:'north'},{id:'river',label:'Prefiero conocer el río.',next:'river'}]},
  {id:'north',title:'Camino del norte',text:'La posta está al norte.',choices:[{id:'back',label:'Volvamos a las opciones.',next:'start'}]},
  {id:'river',title:'Camino del río',text:'Seguí la ribera al amanecer.',choices:[]},
 ]};return d;
}
