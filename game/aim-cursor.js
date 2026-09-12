import {aimOptions,unitCanAct,attackCursorMode,visibleHover} from './ja2-hud.js';
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
// ordinary fire reducer only when the player confirms a shot.
export function rightClickAim(state,unit,{mode='move',aim=0,busy=false,target=null}={}){
 if(busy)return null;
 const character=target?.id&&[...state.units,...(state.npcs??[])].find(person=>person.id===target.id);
 if(['fire','useItem'].includes(mode)&&!visibleHover(state,character)?.id)return {mode:'move',aim:0};
 if(!unitCanAct(state,unit))return null;
 const nextMode=attackCursorMode(unit);
 const maximum=aimOptions(state,unit,{target:visibleHover(state,target)}).filter(option=>!option.disabled).at(-1)?.level??0;
 return {mode:nextMode,aim:mode==='fire'&&nextMode==='fire'?(Math.max(0,Math.min(maximum,Number.isFinite(aim)?Math.floor(aim):0))+1)%(maximum+1):0};
}
