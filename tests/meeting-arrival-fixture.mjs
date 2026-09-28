import {movementPackage} from './dialogue-movement-fixture.mjs';
import {order,talk} from './local-contract-fixture.mjs';
export function arrivalPackage(){
 const d=movementPackage();d.quests=[{id:'meeting',title:'El encuentro',description:'Reuní al vecino con Alma.'}];
 const nodes=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes;
 nodes[0].choices[0].effects.push({type:'quest',quest:'meeting',status:'active'});
 Object.assign(nodes[1].choices[0],{label:'Ya estamos reunidos.',conditions:[{type:'meeting',character:'pablo'}],effects:[{type:'quest',quest:'meeting',status:'completed'},{type:'treasury',operation:'receive',amount:100}]});return d;
}
export const finishMeeting=p=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'north',dialogueChoice:'back'})});
