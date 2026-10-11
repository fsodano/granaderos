import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultProfile,createOfficerRecord} from '../game/recruitment.js';
import {campaignCharacterPortraits} from '../game/campaign-portraits.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {spriteSkinTone} from '../game/sprite-skin.js';
import {characterProfile} from '../game/characters.js';
import {campaignOfficerCreation,validateOfficerCreation} from '../game/campaign-officer-creation.js';
import {contentWeaponOf} from '../game/weapon-definition.js';

const answers={origin:'workshop',doctrine:'line_marksman',crisis:'rescue',specialty:'night',temperament:'steady'};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const portrait={id:'post-doctor',name:'Médica de la posta',src:image,gender:'woman',role:'medic',skinTone:'dark',spriteSkinTone:'dark',spriteAppearance:'woman-shawl',selectable:true};
function content(){
 const d=defaultContentPackage();Object.assign(d,{id:'post-profiles',name:'Guardias de la posta',scenario:'generic-v1',includeOriginalResidents:false,errands:[],roadsideDiscoveries:[],placements:[],quests:[],campaignRoles:{foundryEngineer:null,marchCommander:null},presentation:{version:1,title:'Guardias de la posta',characterPortraits:[portrait]}});
 d.characters=d.characters.filter(c=>c.id==='person-110');Object.assign(d.characters[0],{traits:[],abilities:[],recruitmentSource:'contract',service:'contract',progression:'experience',arrivalHours:0});return d;
}
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};

test('a campaign-only portrait creates, deploys and restores its officer with the selected art and palette',()=>{
 const d=content();assert.deepEqual(validateContentPackage(d),[]);let s=initialCampaign(8,d);const profile=defaultProfile(s);assert.equal(profile.portraitId,portrait.id);
 s=order(s,{type:'createOfficer',name:'Inés de la posta',answers,profile});let op=rosterFor(s).find(o=>o.id===1000);assert.equal(op.portrait,image);assert.equal(op.spriteAppearance,'woman-shawl');assert.equal(spriteSkinTone(op),'dark');
 s=order(s,{type:'visitSector'});const p=prepareCampaignBattle(s);assert.equal(p.error,null,p.error);const actor=p.battle.units.find(u=>u.id==='1000');assert.equal(actor.portrait,image);assert.equal(spriteAppearance(actor),'woman-shawl');assert.equal(spriteSkinTone(actor),'dark');
 const wire=encodeSave(p.campaign,p.battle),saved=decodeSave(wire);op=rosterFor(saved.campaign).find(o=>o.id===1000);assert.equal(op.portraitId,portrait.id);assert.equal(op.portrait,image);assert.equal(saved.battle.units.find(u=>u.id==='1000').skinTone,'dark');
 for(const [field,bad]of [['portraitId','avatar-man-gaucho'],['portrait','/art/avatar-man-gaucho.webp'],['spriteAppearance','granadero'],['skinTone','light']]){const forged=JSON.parse(wire);forged.battle.units.find(u=>u.id==='1000')[field]=bad;assert.throws(()=>decodeSave(JSON.stringify(forged)),/apariencia|retrato|personaje/i,field);}
 const forged=JSON.parse(wire);forged.campaign.officer.profile.portraitId='avatar-man-gaucho';assert.throws(()=>decodeSave(JSON.stringify(forged)),/retrato|apariencia/i);
});

test('generic portrait fallback uses configured characters and the neutral engine portrait when none have art',()=>{
 const d=content();delete d.presentation;d.characters[0].portrait=image;d.characters[0].skinTone='light';d.characters[0].spriteAppearance='worker';const profile=defaultProfile(d),op=createOfficerRecord('Alma de la posta',answers,profile,d);
 assert.equal(profile.portraitId,'portrait-person-110');assert.equal(op.portrait,image);assert.equal(spriteAppearance(op),'worker');assert.equal(spriteSkinTone(op),'light');
 const empty={scenario:'generic-v1',characters:[]},neutral=defaultProfile(empty);assert.equal(campaignCharacterPortraits(empty).length,1);assert.equal(neutral.portraitId,'neutral-avatar');assert.equal(createOfficerRecord('Alma de la posta',answers,neutral,empty).portrait,'/portrait-placeholder.svg');
});

test('generic officer creation uses only explicit local equipment and campaign display fields',()=>{
 const d=content(),firearm={...d.weapons.find(w=>w.id==='firearm-1805'),id:'post-sidearm',name:'Pistola de la posta',damage:33},blade={...d.weapons.find(w=>w.id==='blade-1813'),id:'post-tool',name:'Herramienta de la posta',damage:37};d.weapons.push(firearm,blade);
 d.presentation.officerCreation={classes:[{id:'gaucho',name:'Correísta',description:'Custodia la correspondencia.',weapon:firearm.id,blade:blade.id}],defaults:{classId:'gaucho',portraitId:portrait.id},registry:'Diario de la posta',biography:'Persona encargada de la correspondencia.'};
 assert.deepEqual(validateOfficerCreation(d.presentation.officerCreation,d),[]);assert.deepEqual(validateContentPackage(d),[]);
 let s=order(initialCampaign(8,d),{type:'createOfficer',name:'Inés de la posta',answers,profile:defaultProfile(d)});const op=rosterFor(s).find(o=>o.id===1000);assert.equal(op.role,'Correísta');assert.equal(op.biography,d.presentation.officerCreation.biography);assert.equal(characterProfile(op).registry,'Diario de la posta · Correísta');assert.equal(contentWeaponOf(op).id,firearm.id);assert.equal(contentWeaponOf(op,'blade').id,blade.id);
 s=order(s,{type:'visitSector'});const p=prepareCampaignBattle(s);assert.equal(p.error,null,p.error);const saved=decodeSave(encodeSave(p.campaign,p.battle));assert.equal(contentWeaponOf(saved.battle.units.find(u=>u.id==='1000')).damage,33);assert.equal(contentWeaponOf(saved.battle.units.find(u=>u.id==='1000'),'blade').damage,37);
 const neutral=createOfficerRecord('Alma de la posta',answers,defaultProfile(content()),content());assert.equal(neutral.weapon,0);assert.equal(neutral.blade,undefined);assert.doesNotMatch(neutral.biography,/Granadero|Cabildo|Buenos Aires/);assert.doesNotMatch(characterProfile(neutral).registry,/granadero/);
 for(const weapon of ['foreign-weapon',1805]){const forged=structuredClone(d.presentation.officerCreation);forged.classes[0].weapon=weapon;assert.ok(validateOfficerCreation(forged,d).length>0);}
 const forged=structuredClone(d.presentation.officerCreation);forged.classes[0].id='invented-power';assert.ok(validateOfficerCreation(forged,d).length>0);assert.equal(campaignOfficerCreation(d).classes[0].name,'Correísta');
});
