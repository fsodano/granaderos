import {dialoguePackage} from './dialogue-fixture.mjs';
import {A,order,talk} from './local-contract-fixture.mjs';
import {projectDialogueMovements} from '../game/dialogue-movement.js';
export function movementPackage(){
 const d=dialoguePackage(),speaker=d.characters.find(c=>c.id==='alma-contract'),guest=structuredClone(speaker);guest.id='pablo';guest.name='Pablo';guest.nickname='Pablo';delete guest.encounter.dialogue;
 d.characters.push(guest);d.placements.push({id:'pablo-location',character:'pablo',mode:'fixed',sectors:[A],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});
 speaker.encounter.dialogue.nodes[0].choices[0].effects=[{type:'movement',character:'pablo',destination:'speaker'}];return d;
}
export const guest=p=>p.battle.npcs.find(n=>n.contentId==='pablo');
export function callGuest(p){const campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});return {campaign,battle:projectDialogueMovements(campaign,p.battle)};}
