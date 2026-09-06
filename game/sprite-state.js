import {hasFirearm} from './tactical.js';

export function spriteCondition(unit){
 if(unit.hp<=0)return 'dead';
 if(unit.unconscious)return 'unconscious';
 return unit.stance==='prone'||unit.movementMode==='prone'?'prone':unit.movementMode==='crouch'?'crouch':'standing';
}

// Life state wins over stance, movement, equipment, and a pending action.
export function selectSprite(unit,motion,pose='idle',appearance='soldier'){
 const condition=spriteCondition(unit),family=appearance==='civilian'?'civilian':unit.side==='enemy'?'royalist':'granadero';
 if(condition==='dead')return {name:`${family}-dead-idle`,playback:'still'};
 if(condition==='unconscious')return {name:`${family}-unconscious-breathe`,playback:'breathing'};
 if(appearance==='civilian')return {name:`civilian-${motion.moving?'walk':'idle'}`,playback:motion.moving?'movement':'still'};
 if(unit.mounted)return {name:`cavalry-${motion.moving?'walk':'idle'}`,playback:motion.moving?'movement':'still'};
 if(condition==='prone'){
  const armed=hasFirearm(unit),action=armed&&!motion.moving&&['fire','reload'].includes(pose)?pose:null;
  return {name:`${family}-prone-${armed?'armed':'unarmed'}-${action??(motion.moving?'walk':'idle')}`,playback:action?'action':motion.moving?'movement':'still'};
 }
 const action=condition==='standing'&&!motion.moving&&['fire','reload','strike'].includes(pose)?pose:null;
 const gait=motion.moving?(condition==='standing'&&unit.movementMode==='run'?'run':'walk'):'idle';
 return {name:`${family}-${condition==='crouch'?'crouch-':''}${action??gait}`,playback:action?'action':motion.moving?'movement':'still'};
}

export function spriteAnimationFrame(playback,elapsed){
 if(playback==='breathing')return Math.floor(Math.max(0,elapsed)/500)%8;
 if(playback==='action')return Math.min(7,Math.floor(Math.max(0,elapsed)/100));
 return 0;
}
