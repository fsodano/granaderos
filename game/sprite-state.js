import {hasFirearm} from './tactical.js';
import {spriteAppearance} from './sprite-appearances.js';
import {FAMILY_SPRITE_SEQUENCES} from './sprite-family-sequences.js';

export const SPRITE_SEQUENCES=Object.freeze([...FAMILY_SPRITE_SEQUENCES,'prone-unarmed-idle','prone-unarmed-walk','dead-idle']);
export const CIVILIAN_SPRITE_SEQUENCES=SPRITE_SEQUENCES;

export function spriteCondition(unit){
 if(unit.hp<=0)return 'dead';
 if(unit.unconscious)return 'unconscious';
 return unit.stance==='prone'||unit.movementMode==='prone'?'prone':unit.stance==='crouched'||unit.movementMode==='crouch'?'crouch':'standing';
}

// Life state wins over stance, movement, equipment, and a pending action.
// Select a sequence first so all postures retain the same shared appearance.
function spriteSequence(unit,motion,pose,kind){
 const condition=spriteCondition(unit);
 if(condition==='dead')return {sequence:pose==='collapse'?'collapse':'dead-idle',playback:pose==='collapse'?'action':'still'};
 if(condition==='unconscious')return {sequence:'unconscious-breathe',playback:'breathing'};
 if(unit.mounted){
  const action=!motion.moving&&['fire','reload','strike'].includes(pose)?pose:null;
  return {sequence:`mounted-${action??(motion.moving?(unit.movementMode==='run'?'run':'walk'):'idle')}`,playback:action?'action':motion.moving?'movement':'still'};
 }
 if(condition==='prone'){
  const armed=hasFirearm(unit),action=armed&&!motion.moving&&['fire','reload'].includes(pose)?pose:null;
  if(armed&&!motion.moving&&pose==='aim')return {sequence:'prone-aim-idle',playback:'still'};
  return {sequence:`prone-${armed?'armed':'unarmed'}-${action??(motion.moving?'walk':'idle')}`,playback:action?'action':motion.moving?'movement':'still'};
 }
 const action=!motion.moving&&['fire','reload','interact',...(condition==='standing'?['strike']:[])].includes(pose)?pose:null;
 if(!motion.moving&&pose==='aim')return {sequence:`${condition==='crouch'?'crouch-':''}aim-idle`,playback:'still'};
 const gait=motion.moving?(condition==='standing'&&unit.movementMode==='run'?'run':'walk'):'idle';
 return {sequence:`${condition==='crouch'?'crouch-':''}${action??gait}`,playback:action?'action':motion.moving?'movement':'still'};
}

export function selectSprite(unit,motion,pose='idle',kind='soldier'){
 const {sequence,playback}=spriteSequence(unit,motion,pose,kind);
 return {name:`${spriteAppearance(unit,kind)}-${sequence}`,playback};
}

// Temporary migration fallback only. It never replaces an action with idle.
export function selectLegacySprite(unit,motion,pose='idle',kind='soldier'){
 const {sequence,playback}=spriteSequence(unit,motion,pose,kind);
 const family=kind==='civilian'?'civilian':unit.side==='enemy'?'royalist':'granadero';
 return {name:sequence.startsWith('mounted-')?sequence.replace('mounted-','cavalry-'):`${family}-${sequence}`,playback};
}

export function spriteAnimationFrame(playback,elapsed,frames=8,fps=playback==='breathing'?2:10){
 const count=Math.max(1,Math.floor(frames)),phase=Math.floor(Math.max(0,elapsed)*Math.max(0,fps)/1000);
 if(playback==='breathing'||playback==='movement')return phase%count;
 if(playback==='action')return Math.min(count-1,phase);
 return 0;
}
