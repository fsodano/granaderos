import {arrivalPackage,finishMeeting} from './meeting-arrival-fixture.mjs';
import {projectDialogueMovements} from '../game/dialogue-movement.js';
export function releasePackage(){
 const d=arrivalPackage(),nodes=d.characters.find(c=>c.id==='alma-contract').encounter.dialogue.nodes;
 nodes[1].choices[0].effects.push({type:'movement',character:'pablo',destination:'routine'});return d;
}
export function releaseMeeting(p){const next=finishMeeting(p);return {...next,battle:projectDialogueMovements(next.campaign,next.battle)};}
