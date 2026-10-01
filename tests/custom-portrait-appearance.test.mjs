import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {spriteSkinTone} from '../game/sprite-skin.js';
import {selectSprite} from '../game/sprite-state.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';

const portraits=Array.from({length:48},(_,index)=>String(100+index));
const answers={origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'night',temperament:'steady'};
const signature=unit=>({appearance:spriteAppearance(unit),skin:spriteSkinTone(unit)});

test('every numeric custom portrait uses the same family and palette as its hired counterpart',()=>{
 for(const portraitId of portraits)for(const id of [1000,'1000']){
  const custom={id,portraitId,side:'player',hp:100,weapon:1800},hire={...custom,id:portraitId};
  assert.deepEqual(signature(custom),signature(hire),portraitId);
  for(const [change,moving,pose] of [[{},false,'idle'],[{},true,'idle'],[{mounted:true},true,'idle'],[{stance:'prone'},false,'fire'],[{hp:0},false,'idle']]){
   const current={...custom,...change},other={...hire,...change},motion={direction:4,moving,frame:0};
   assert.equal(selectSprite(current,motion,pose).name,selectSprite(other,motion,pose).name,portraitId);
   assert.deepEqual(signature(current),signature(other),portraitId);
  }
 }
});

test('explicit saved visual overrides win and independent custom characters do not share a selection',()=>{
 const dark={id:1000,portraitId:'110'},light={id:1000,portraitId:'112'},before=structuredClone([dark,light]);
 assert.equal(spriteSkinTone(dark),'dark');assert.equal(spriteSkinTone(light),'light');assert.equal(spriteSkinTone(dark),'dark');
 for(const portraitId of portraits){
  const custom={id:1000,portraitId,spriteAppearance:'woman-scout',skinTone:'dark'};
  assert.deepEqual(signature(custom),{appearance:'woman-scout',skin:'dark'});
  assert.equal(spriteSkinTone({...custom,skinTone:'white'}),'light');
  assert.equal(spriteAppearance({...custom,side:'enemy'}),'royalist','enemy uniforms keep their existing precedence');
 }
 assert.deepEqual([dark,light],before);
});

test('the four existing avatars and legacy officer preserve their previous fallback appearance',()=>{
 for(const [portraitId,appearance] of [['avatar-woman-scout','woman-scout'],['avatar-woman-civilian','woman-shawl'],['avatar-man-gaucho','gaucho'],['avatar-man-soldier','granadero']]){
  assert.deepEqual(signature({id:1000,portraitId}),{appearance,skin:'brown'});
 }
 assert.deepEqual(signature({id:1000}),{appearance:'granadero',skin:'brown'});
 assert.deepEqual(signature({id:1000,portraitId:'unknown'}),{appearance:'granadero',skin:'brown'});
});

test('numeric portrait selection survives a real campaign and tactical save without altering either source',()=>{
 for(const portraitId of ['103','107','110','112','126','147']){
  let campaign=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Rostro de prueba',answers,profile:{...defaultProfile(),portraitId}});
  assert.equal(campaign.lastError,null,`${portraitId}: ${campaign.lastError}`);
  campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
  const pair=prepareCampaignBattle(campaign,{placement:true});assert.equal(pair.error,null);
  const before=structuredClone(pair),restored=decodeSave(encodeSave(pair.campaign,pair.battle));
  const record=rosterFor(restored.campaign).find(unit=>unit.id===1000),unit=restored.battle.units.find(unit=>unit.id==='1000');
  assert.equal(restored.campaign.officer.profile.version,2);assert.equal(restored.campaign.officer.profile.portraitId,portraitId);
  assert.equal(record.portraitId,portraitId);assert.equal(unit.portraitId,portraitId);assert.equal(unit.portrait,record.portrait);
  assert.deepEqual(signature(record),signature({id:portraitId}));assert.deepEqual(signature(unit),signature(record));
  assert.deepEqual(pair,before,'save operations do not rewrite the active campaign or battle');
 }
});
