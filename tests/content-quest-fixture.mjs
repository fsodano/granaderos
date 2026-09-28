import {dialoguePackage} from './dialogue-fixture.mjs';
export function questPackage({day=false}={}){
 const d=dialoguePackage();d.quests=[{id:'river-post',title:'El parte de la ribera',description:'Volvé con el parte de los caminos.'}];
 const state=status=>({type:'quest',quest:'river-post',status}),q=status=>[state(status)];
 d.characters.at(-1).encounter.dialogue={entry:'start',nodes:[
  {id:'start',title:'Oferta',text:'Necesitamos reconocer los caminos.',choices:[{id:'accept',label:'Acepto el encargo.',next:'active',effects:q('active')}]},
  {id:'active',title:'En curso',text:'Esperaré tu parte.',choices:[
   {id:'complete',label:'Aquí está el parte.',next:'done',conditions:[state('active'),...(day?[{type:'day',min:2,max:null}]:[])],effects:[...q('completed'),{type:'treasury',operation:'receive',amount:175}]},
   {id:'fail',label:'No puedo seguir.',next:'failed',conditions:q('active'),effects:q('failed')},
  ]},
  {id:'done',title:'Completado',text:'Gracias por el informe.',choices:[{id:'back',label:'Hablemos otra vez.',next:'active'}]},
  {id:'failed',title:'Fallido',text:'Buscaremos otra solución.',choices:[{id:'back',label:'Hablemos otra vez.',next:'active'}]},
 ]};return d;
}
