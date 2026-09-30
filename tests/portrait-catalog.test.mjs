import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_PORTRAITS,SELECTABLE_CHARACTER_PORTRAITS,LEGACY_ONLY_PORTRAIT_IDS,PORTRAITS_PER_COMBINATION,PORTRAIT_GENDERS,PORTRAIT_ROLES,PORTRAIT_SKIN_TONES,characterPortrait} from '../game/character-portraits.js';
import {CHARACTER_PORTRAITS as creatorPortraits,defaultProfile,createOfficerRecord} from '../game/recruitment.js';
import {SPRITE_APPEARANCES,spriteAppearance} from '../game/sprite-appearances.js';
import {spriteSkinTone} from '../game/sprite-skin.js';
import {selectSprite} from '../game/sprite-state.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {portraitFor} from '../web/lib/portraits.ts';
import {BALANCED_PORTRAITS} from '../game/portrait-expansion.js';

const oldIds=['avatar-woman-scout','avatar-woman-civilian','avatar-man-gaucho','avatar-man-soldier',...Array.from({length:48},(_,index)=>String(100+index))];
const newIds=['man','woman'].flatMap(gender=>['soldier','officer','scout','gaucho','artisan','medic'].map(role=>`avatar-${gender}-black-${role}`));
const answers={origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'night',temperament:'steady'};
const signature=unit=>({appearance:spriteAppearance(unit),skin:spriteSkinTone(unit)});

test('all 36 chooser combinations have exactly five portraits and surplus faces still load from old saves',()=>{
 assert.equal(PORTRAITS_PER_COMBINATION,5);
 assert.equal(SELECTABLE_CHARACTER_PORTRAITS.length,180);
 assert.equal(CHARACTER_PORTRAITS.length,186);
 assert.equal(new Set(SELECTABLE_CHARACTER_PORTRAITS.map(p=>p.src)).size,180);
 for(const gender of PORTRAIT_GENDERS)for(const role of PORTRAIT_ROLES)for(const tone of PORTRAIT_SKIN_TONES){
  const group=SELECTABLE_CHARACTER_PORTRAITS.filter(p=>p.gender===gender.id&&p.role===role.id&&p.skinTone===tone.id);
  assert.equal(group.length,5,`${gender.id}/${role.id}/${tone.id}`);
 }
 assert.deepEqual(CHARACTER_PORTRAITS.filter(p=>!p.selectable).map(p=>p.id).sort(),[...LEGACY_ONLY_PORTRAIT_IDS].sort());
 assert.equal(characterPortrait(defaultProfile().portraitId).selectable,true);
 for(const portraitId of LEGACY_ONLY_PORTRAIT_IDS){
  const portrait=characterPortrait(portraitId);
  assert.ok(portrait);assert.equal(portrait.selectable,false);
  assert.equal(portraitFor(Number(portraitId)),portrait.src,'paid recruits retain their own face');
  const campaign=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Rostro conservado',answers,profile:{...defaultProfile(),portraitId}});
  assert.equal(campaign.lastError,null);
  const restored=decodeSave(encodeSave(campaign)).campaign;
  assert.equal(rosterFor(restored).find(unit=>unit.id===1000).portrait,portrait.src);
 }
});

test('catalog preserves existing save IDs and supplies complete visual categories for every portrait',()=>{
 assert.equal(creatorPortraits,CHARACTER_PORTRAITS);
 assert.deepEqual(CHARACTER_PORTRAITS.map(p=>p.id),[...oldIds,...newIds,...BALANCED_PORTRAITS.map(p=>p.id)]);
 for(const portrait of CHARACTER_PORTRAITS){
  assert.ok(PORTRAIT_GENDERS.some(option=>option.id===portrait.gender),portrait.id);
  assert.ok(PORTRAIT_ROLES.some(option=>option.id===portrait.role),portrait.id);
  assert.ok(PORTRAIT_SKIN_TONES.some(option=>option.id===portrait.skinTone),portrait.id);
  assert.equal(typeof portrait.name,'string');assert.ok(portrait.name.length>0);
  assert.equal(characterPortrait(portrait.id),portrait);
  assert.equal(portraitFor(portrait.id),portrait.src);
 }
 assert.equal(characterPortrait('avatar-man-black-unknown'),undefined);
 assert.equal(portraitFor('avatar-man-black-unknown'),null);
 assert.equal(characterPortrait('__proto__'),undefined);
 assert.equal(characterPortrait(100),undefined,'saved portrait IDs must remain strings');
 assert.equal(characterPortrait('103').src,'/art/portrait-103.png');
 assert.equal(characterPortrait('104').src,'/art/portrait-104.png');
});

test('new Black portrait choices cover both genders in all six roles and keep independent gameplay profiles',()=>{
 const baseline=createOfficerRecord('Rostro de prueba',answers,defaultProfile());
 const withoutPortrait=({portrait,portraitId,...record})=>record;
 for(const gender of PORTRAIT_GENDERS)for(const role of PORTRAIT_ROLES){
  const portrait=characterPortrait(`avatar-${gender.id}-black-${role.id}`);
  assert.ok(portrait,`${gender.id}/${role.id}`);
  assert.equal(portrait.gender,gender.id);assert.equal(portrait.role,role.id);
  assert.equal(portrait.skinTone,role.id==='gaucho'?'brown':'dark');
  const selected=createOfficerRecord('Rostro de prueba',answers,{...defaultProfile(),portraitId:portrait.id});
  assert.deepEqual(withoutPortrait(selected),withoutPortrait(baseline),'visual roles never change the selected class, abilities, identity or equipment');
  assert.equal(SPRITE_APPEARANCES[spriteAppearance(selected)].gender,gender.id);
  assert.equal(spriteSkinTone(selected),portrait.skinTone);
 }
});

test('new portrait families and palettes remain stable across animation, saved overrides and independent characters',()=>{
 const expectedFamilies={man:{soldier:'granadero',officer:'granadero',scout:'gaucho',gaucho:'gaucho',artisan:'worker',medic:'surgeon'},woman:{soldier:'woman-scout',officer:'woman-scout',scout:'woman-scout',gaucho:'woman-scout',artisan:'woman-shawl',medic:'woman-shawl'}};
 for(const portraitId of [...newIds,...BALANCED_PORTRAITS.map(p=>p.id)]){
  const portrait=characterPortrait(portraitId);
  for(const id of [1000,'1000']){
   const unit={id,portraitId,side:'player',hp:100,weapon:1800};
   const expected={appearance:expectedFamilies[portrait.gender][portrait.role],skin:portrait.skinTone};
   for(const [change,moving,pose] of [[{},false,'idle'],[{},true,'idle'],[{mounted:true},true,'idle'],[{stance:'prone'},false,'fire'],[{hp:0},false,'idle']]){
    const current={...unit,...change};
    assert.deepEqual(signature(current),expected,portraitId);
    assert.ok(selectSprite(current,{direction:4,moving,frame:0},pose).name.startsWith(`${expected.appearance}-`),portraitId);
   }
   assert.deepEqual(signature({...unit,spriteAppearance:'friar',skinTone:'light'}),{appearance:'friar',skin:'light'});
   assert.equal(spriteSkinTone({...unit,skinTone:'white'}),'light');
   assert.equal(spriteSkinTone({...unit,skinTone:'black'}),'dark');
   assert.equal(spriteAppearance({...unit,side:'enemy',spriteAppearance:'granadero'}),'royalist');
  }
 }
 const dark={id:1000,portraitId:newIds[0]},brown={id:1000,portraitId:'avatar-man-black-gaucho'};
 assert.equal(spriteSkinTone(dark),'dark');assert.equal(spriteSkinTone(brown),'brown');assert.equal(spriteSkinTone(dark),'dark');
});

test('every new portrait survives campaign creation, deployment and tactical save with its matching appearance',()=>{
 for(const portraitId of [...newIds,...BALANCED_PORTRAITS.map(p=>p.id)]){
  const portrait=characterPortrait(portraitId);
  let campaign=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Rostro de prueba',answers,profile:{...defaultProfile(),portraitId}});
  assert.equal(campaign.lastError,null,`${portraitId}: ${campaign.lastError}`);
  campaign=decodeSave(encodeSave(campaign)).campaign;
  campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
  const pair=prepareCampaignBattle(campaign,{placement:true});assert.equal(pair.error,null);
  const original=structuredClone(pair),restored=decodeSave(encodeSave(pair.campaign,pair.battle));
  const record=rosterFor(restored.campaign).find(unit=>unit.id===1000),unit=restored.battle.units.find(unit=>unit.id==='1000');
  assert.equal(restored.campaign.officer.profile.version,2);
  assert.equal(restored.campaign.officer.profile.portraitId,portraitId);
  assert.equal(record.portraitId,portraitId);assert.equal(unit.portraitId,portraitId);
  assert.equal(unit.portrait,portrait.src);assert.equal(record.portrait,portrait.src);
  assert.equal(spriteSkinTone(unit),portrait.skinTone);
  assert.deepEqual(signature(unit),signature(record));
  assert.deepEqual(pair,original,'save operations do not change live campaign or tactical records');
  unit.spriteAppearance='friar';unit.skinTone='light';
  const overridden=decodeSave(encodeSave(restored.campaign,restored.battle)).battle.units.find(unit=>unit.id==='1000');
  assert.deepEqual(signature(overridden),{appearance:'friar',skin:'light'});
 }
});
