import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteRender,spriteViewport,spriteMovementFrame} from '../game/sprite-render.js';
import {selectSprite,spriteAnimationFrame} from '../game/sprite-state.js';
import {SPRITE_APPEARANCES,ROSTER_SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {CHARACTER_PORTRAITS} from '../game/character-profile.js';

const motion={direction:3,moving:false,frame:0};
const atlas=(name,frames=1,fps=frames>1?5:0,logicalCell=52)=>({file:`${name}.png`,cell:logicalCell*3,anchor:[logicalCell*1.5,(logicalCell-6)*3],logicalCell,framesPerDirection:frames,fps,size:[logicalCell*3*(frames===1?8:frames),logicalCell*3*(frames===1?1:8)]});

test('all shared appearances persist through movement, combat, collapse and mounts',()=>{
 const states=[
  [{},false,'idle','idle'],[{},true,'idle','walk'],[{movementMode:'run'},true,'idle','run'],
  [{stance:'crouched'},false,'fire','crouch-fire'],[{stance:'crouched'},false,'reload','crouch-reload'],
  [{},false,'interact','interact'],[{stance:'crouched'},false,'interact','crouch-interact'],
  [{},false,'aim','aim-idle'],[{stance:'crouched'},false,'aim','crouch-aim-idle'],[{stance:'prone'},false,'aim','prone-aim-idle'],
  [{mounted:true},false,'reload','mounted-reload'],[{mounted:true},false,'strike','mounted-strike'],[{mounted:true,movementMode:'run'},true,'idle','mounted-run'],
  [{hp:0},false,'collapse','collapse'],
  [{},false,'fire','fire'],[{},false,'reload','reload'],[{},false,'strike','strike'],
  [{stance:'crouched'},false,'idle','crouch-idle'],[{movementMode:'crouch'},false,'idle','crouch-idle'],[{movementMode:'crouch'},true,'fire','crouch-walk'],
  [{stance:'prone'},false,'idle','prone-armed-idle'],[{stance:'prone'},true,'fire','prone-armed-walk'],
  [{stance:'prone'},false,'fire','prone-armed-fire'],[{stance:'prone'},false,'reload','prone-armed-reload'],
  [{stance:'prone',weaponDropped:true},false,'fire','prone-unarmed-idle'],[{stance:'prone',activeSlot:'blade'},true,'reload','prone-unarmed-walk'],
  [{hp:0,unconscious:true,mounted:true},true,'fire','dead-idle'],[{unconscious:true,mounted:true},true,'reload','unconscious-breathe'],
  [{mounted:true,stance:'prone'},false,'fire','mounted-fire'],[{mounted:true},true,'reload','mounted-walk'],
 ];
 for(const appearance of Object.keys(SPRITE_APPEARANCES))for(const [change,moving,pose,sequence] of states){
  const selected=selectSprite({spriteAppearance:appearance,hp:100,weapon:1800,activeSlot:'primary',...change},{...motion,moving},pose);
  assert.equal(selected.name,`${appearance}-${sequence}`);
 }
});

test('roster and custom portraits use their shared bodies while NPCs accept explicit appearances',()=>{
 for(const [id,appearance] of Object.entries(ROSTER_SPRITE_APPEARANCES)){
  assert.equal(selectSprite({id,hp:0},motion).name,`${appearance}-dead-idle`);
  assert.equal(selectSprite({id,mounted:true},{...motion,moving:true}).name,`${appearance}-mounted-walk`);
 }
 for(const portrait of CHARACTER_PORTRAITS){
  const selected=selectSprite({id:1000,portraitId:portrait.id,hp:100},motion);
  assert.ok(selected.name.endsWith('-idle'));
  if(portrait.id.startsWith('avatar-woman'))assert.ok(selected.name.startsWith('woman-'));
 }
 assert.equal(selectSprite({id:'npc',spriteAppearance:'woman-elder',hp:0,mounted:true},motion,'fire','civilian').name,'woman-shawl-dead-idle');
 assert.equal(selectSprite({id:'npc',spriteAppearance:'woman-headscarf'},{...motion,moving:true},'idle','civilian').name,'woman-shawl-walk');
 assert.equal(selectSprite({id:1,side:'enemy'},motion).name,'royalist-idle');
});

test('missing action, movement, mount and collapse atlases use explicit state-correct legacy art',()=>{
 const idleOnly={'woman-scout-idle':atlas('woman-scout-idle')};
 for(const [change,moving,pose,requested,legacy] of [
  [{},true,'idle','walk','granadero-walk'],[{},false,'fire','fire','granadero-fire'],
  [{mounted:true},true,'fire','mounted-walk','cavalry-walk'],[{hp:0,mounted:true},true,'fire','dead-idle','granadero-dead-idle'],
  [{unconscious:true,mounted:true},true,'fire','unconscious-breathe','granadero-unconscious-breathe'],
 ]){
  const result=spriteRender({id:101,hp:100,...change},{...motion,moving},pose,'soldier',idleOnly);
  assert.equal(result.requestedName,`woman-scout-${requested}`);assert.equal(result.name,legacy);
  assert.equal(result.fallbackReason,'missing-atlas');assert.equal(result.style,'native-pixel');
  assert.equal(result.href,`/art/pixel/${legacy}-atlas.png`);
 }
 const invalid=spriteRender({id:101},{...motion,moving:true},'idle','soldier',{'woman-scout-walk':atlas('woman-scout-walk')});
 assert.equal(invalid.fallbackReason,'invalid-atlas');assert.equal(invalid.name,'granadero-walk');
});

test('illustrated standing and padded cells keep the existing world scale and ground point',()=>{
 const bank={'granadero-idle':atlas('granadero-idle'),'granadero-fire':atlas('granadero-fire',4,5,70)};
 const standing=spriteRender({},motion,'idle','soldier',bank),firing=spriteRender({},motion,'fire','soldier',bank);
 assert.equal(standing.style,'illustrated-pixel-art');assert.equal(standing.fallbackReason,null);
 assert.deepEqual(spriteViewport(standing,{x:100,y:100},3,0),{x:74,y:54,width:52,height:52,viewBox:'468 0 156 156'});
 assert.deepEqual(spriteViewport(firing,{x:100,y:100},3,2),{x:65,y:36,width:70,height:70,viewBox:'420 630 210 210'});
 for(let dir=0;dir<8;dir++){
  assert.equal(spriteViewport(standing,{x:0,y:0},dir,7).viewBox,`${dir*156} 0 156 156`);
  assert.equal(spriteViewport(firing,{x:0,y:0},dir,3).viewBox,`630 ${dir*210} 210 210`);
 }
 assert.equal(spriteViewport(standing,{x:0,y:0},-1,0,104).width,104);
 assert.equal(spriteViewport(standing,{x:0,y:0},-1,0).viewBox,'1092 0 156 156');
});

test('four authored motion frames play at five fps and action/breathing clocks use metadata',()=>{
 assert.deepEqual([0,199,200,399,400,600,799,800,1000].map(elapsedMs=>spriteMovementFrame({frame:0,elapsedMs},4,5)),[0,0,1,1,2,3,3,0,1]);
 assert.deepEqual(Array.from({length:8},(_,frame)=>spriteMovementFrame({frame},4,5)),[0,0,1,1,2,2,3,3]);
 assert.equal(spriteMovementFrame({frame:0,elapsedMs:1400},6,5),1,'longer atlas cycles must not reset with the old eight-frame clock');
 assert.deepEqual([0,199,200,600,800,5000].map(t=>spriteAnimationFrame('action',t,4,5)),[0,0,1,3,3,3]);
 assert.deepEqual([0,500,1500,2000].map(t=>spriteAnimationFrame('breathing',t,4,2)),[0,1,3,0]);
});
