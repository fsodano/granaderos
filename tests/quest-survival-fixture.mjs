import {questPackage} from './content-quest-fixture.mjs';
export function survivalPackage(){
 const d=questPackage(),pablo={...structuredClone(d.characters.at(-1)),id:'pablo',name:'Pablo',nickname:'Pablo',attributes:{...d.characters.at(-1).attributes,maxHp:30},traits:[],abilities:[]};delete pablo.encounter.dialogue;d.characters.push(pablo);d.placements.push({...structuredClone(d.placements.at(-1)),id:'pablo-place',character:'pablo'});d.quests[0].requiredAlive=['pablo'];return d;
}
