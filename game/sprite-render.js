import {ILLUSTRATED_SPRITE_ATLASES} from './illustrated-sprite-atlases.js';
import {spriteLayout} from './sprite-layouts.js';
import {selectSprite,selectLegacySprite,spriteAnimationFrame} from './sprite-state.js';

/** @typedef {{file:string,cell:number,anchor:number[],logicalCell:number,framesPerDirection:number,fps:number,size:number[]}} IllustratedAtlas */

// Lookup is exact: no shared idle, recoloured family, or unrelated action is
// accepted in place of missing authored art. The fallback remains inspectable.
export function spriteRender(unit,motion,pose='idle',kind='soldier',atlases=ILLUSTRATED_SPRITE_ATLASES){
 const desired=selectSprite(unit,motion,pose,kind);
 const entry=/** @type {Record<string,IllustratedAtlas>} */(atlases)[desired.name];
 const frames=entry?.framesPerDirection,animated=desired.playback!=='still';
 const valid=entry&&Number.isInteger(frames)&&frames>0&&
  (animated?frames>1&&entry.fps>0:frames===1)&&
  entry.cell>0&&entry.logicalCell>0&&entry.anchor?.length===2&&
  entry.size?.[0]===entry.cell*(animated?frames:8)&&entry.size?.[1]===entry.cell*(animated?8:1);
 if(valid)return {...desired,requestedName:desired.name,style:'illustrated-pixel-art',fallbackReason:null,
  href:`/art/illustrated/${entry.file}`,cell:entry.cell,anchor:entry.anchor,logicalCell:entry.logicalCell,
  frames,fps:entry.fps,size:entry.size,mounted:desired.name.includes('-mounted-')};
 const legacy=selectLegacySprite(unit,motion,pose,kind),layout=spriteLayout(legacy.name);
 return {...legacy,requestedName:desired.name,style:'native-pixel',fallbackReason:entry?'invalid-atlas':'missing-atlas',
  href:`/art/pixel/${legacy.name}-atlas.png`,...layout,logicalCell:layout.cell,
  frames:animated?8:1,fps:legacy.playback==='breathing'?2:animated?10:0,
  size:[layout.cell*8,layout.cell*(animated?8:1)],mounted:legacy.name.startsWith('cavalry-')};
}

// The historical movement clock has eight 100 ms frames. elapsedMs avoids
// losing phase when an atlas has a different cycle length or playback rate.
export function spriteMovementFrame(motion,frames,fps){
 const elapsed=Number.isFinite(motion.elapsedMs)?motion.elapsedMs:Math.max(0,Math.floor(motion.frame)||0)*100;
 return spriteAnimationFrame('movement',elapsed,frames,fps);
}

export function spriteViewport(sprite,position,direction,frame,drawSize=52){
 const dir=((Math.round(direction)||0)%8+8)%8,animated=sprite.playback!=='still';
 const phase=((Math.floor(frame)||0)%sprite.frames+sprite.frames)%sprite.frames;
 // Authored cells have triple raster density but the same logical scale.
 // Wider action/prone/horse padding must not make the body smaller.
 const density=sprite.cell/sprite.logicalCell,scale=drawSize/52/density;
 return {x:Math.round(position.x-sprite.anchor[0]*scale),y:Math.round(position.y-sprite.anchor[1]*scale),
  width:sprite.cell*scale,height:sprite.cell*scale,
  viewBox:`${(animated?phase:dir)*sprite.cell} ${animated?dir*sprite.cell:0} ${sprite.cell} ${sprite.cell}`};
}
