import {aimOptions,unitCanAct,attackCursorMode,visibleHover,aimedCursorMode} from './ja2-hud.js';
import {canChooseShotLocation} from './targeted-combat.js';

// Fractions refer to the visible person's hit frame, independent of camera zoom.
export function aimedBodyPart(target,fraction=.5){
 if(!canChooseShotLocation(target))return 'torso';
 const y=Number.isFinite(fraction)?Math.max(0,Math.min(1,fraction)):.5;
 return y<.25?'head':y<.65?'torso':'legs';
}
export function targetHitFrame(target,position){
 const prone=!canChooseShotLocation(target),height=prone?24:target.mounted?72:target.stance==='crouched'?34:49;
 const width=prone?48:target.mounted?48:28;
 return {x:position.x-width/2,y:position.y-height,width,height};
}
// Changing the cursor is a selection, not a tactical action. AP is paid by the
// attack reducer only when the player confirms the shot or throw.
export function rightClickAim(state,unit,{mode='move',aim=0,busy=false,target=null,hitLocation='torso'}={}){
 if(busy)return null;
 if(mode==='throwGrenade')return {mode:'move',aim:0};
 const character=target?.id&&[...state.units,...(state.npcs??[])].find(person=>person.id===target.id);
 // Throwing weapons can be aimed at an empty tile: a ground click keeps the
 // throw cursor and cycles aim instead of canceling back to movement. Only a
 // person who is not visible cancels the throw aim.
 if(mode==='throwKnife'){
  if(target?.id&&!visibleHover(state,character)?.id)return {mode:'move',aim:0};
 }else if(['fire','useItem'].includes(mode)&&!visibleHover(state,character)?.id)return {mode:'move',aim:0};
 if(!unitCanAct(state,unit))return null;
 const nextMode=attackCursorMode(unit);
 if(nextMode==='throwGrenade'||!aimedCursorMode(nextMode))return {mode:nextMode,aim:0};
 const maximum=aimOptions(state,unit,{mode:nextMode,target:visibleHover(state,target),hitLocation}).filter(option=>!option.disabled).at(-1)?.level??0;
 return {mode:nextMode,aim:aimedCursorMode(mode)&&mode===nextMode?(Math.max(0,Math.min(maximum,Number.isFinite(aim)?Math.floor(aim):0))+1)%(maximum+1):0};
}
