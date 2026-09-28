import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {initialCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {localPackage,order,saved,visit,leave,tactical,readyLocal,localNPC} from './local-contract-fixture.mjs';
const phrase='Gracias por las vendas. Todavía necesito reposo.';
const person=(d,id)=>d.characters.find(c=>c.id===`person-${id}`);
const count=b=>b.log.filter(line=>line.includes(phrase)).length;
const condition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};

test('treatment speech is optional, strictly validated and preserves older package identities',()=>{
 const older=defaultContentPackage(),identity=contentIdentity(older);assert.ok(older.characters.every(c=>!Object.hasOwn(c.speech,'treated')));
 const loaded=parseContentPackage(encodeContentPackage(older));assert.deepEqual(loaded,older);assert.deepEqual(contentIdentity(loaded),identity);
 for(const value of [phrase,'','  ','á'.repeat(800)]){const d=structuredClone(older);person(d,112).speech.treated=value;assert.equal(parseContentPackage(encodeContentPackage(d)).characters.find(c=>c.id==='person-112').speech.treated,value);assert.ok(initialCampaign(42,d));}
 for(const value of [null,42,{},'x'.repeat(801)]){const d=structuredClone(older);person(d,112).speech.treated=value;assert.throws(()=>initialCampaign(42,d));}
 for(const change of [c=>delete c.speech.death,c=>c.speech.unknown='No',c=>c.speech={treated:phrase}]){const d=structuredClone(older);change(person(d,112));assert.throws(()=>initialCampaign(42,d));}
});

test('a paid deployed patient speaks after actual finite stabilization restores consciousness, with no replay after save or failed care',()=>{
 const d=defaultContentPackage();for(const id of [110,112])person(d,id).arrivalHours=0;person(d,110).attributes.medical=80;person(d,112).startingCondition={...condition};person(d,112).speech.treated=phrase;
 let s=initialCampaign(42,d);for(const id of [110,112])s=order(s,{type:'recruitCivic',id,term:'week'});let p=visit(s);
 p=tactical(p,{type:'heal',targetId:'112'});assert.equal(count(p.battle),0);assert.ok(p.battle.units.find(u=>u.id==='112').hp<15);
 p=tactical(saved(p),{type:'heal',targetId:'112'});assert.equal(p.battle.units.find(u=>u.id==='112').hp,15);assert.equal(p.battle.units.find(u=>u.id==='112').unconscious,false);assert.equal(p.battle.units.find(u=>u.id==='110').medkits,0);assert.equal(count(p.battle),1);
 p=saved(p);assert.equal(count(p.battle),1);const again=actBattle(p.battle,{type:'heal',unitId:'110',targetId:'112'});assert.ok(again.lastError);assert.equal(count(again),1);assert.deepEqual(again.units,p.battle.units);
 p=tactical(p,{type:'ambient'});assert.equal(count(p.battle),1);s=saved({campaign:leave(p)}).campaign;assert.equal(s.operativeState[112].hp,15);assert.equal(s.operativeState[110].medkits,0);assert.ok(saved({campaign:s}));
});

test('an authored resident responds to actual care and keeps the pinned voice and spent dressings through active save and return',()=>{
 const d=localPackage(),resident=d.characters.at(-1);resident.startingCondition={...condition};resident.speech.treated=phrase;person(d,110).attributes.medical=80;
 let p=readyLocal(undefined,d),npc=localNPC(p.battle);assert.equal(count(p.battle),0);p=tactical(p,{type:'heal',targetId:npc.id});assert.equal(count(p.battle),0);p=tactical(saved(p),{type:'heal',targetId:npc.id});assert.equal(count(p.battle),1);assert.ok(p.battle.log.some(line=>line===`Alma: «${phrase}»`||line===`Alma Contratada: «${phrase}»`));assert.equal(localNPC(p.battle).hp,15);
 p=saved(p);const bad=JSON.parse(encodeSave(p.campaign,p.battle));bad.battle.npcs.find(n=>n.id===npc.id).storyProfile.speech.treated='Changed';assert.throws(()=>decodeSave(JSON.stringify(bad)),/voz o apariencia/);
 d.characters.at(-1).speech.treated='Later draft';assert.equal(localNPC(p.battle).storyProfile.speech.treated,phrase);
 p=visit(saved({campaign:leave(p)}).campaign);assert.equal(localNPC(p.battle).hp,15);assert.equal(localNPC(p.battle).storyProfile.speech.treated,phrase);assert.equal(p.battle.units[0].medkits,0);const prior=count(p.battle);p=tactical(p,{type:'ambient'});assert.equal(count(p.battle),prior);
});

const field=(patient={},doctor={})=>createBattle([
 {id:'doc',name:'Sanitario',x:1,y:1,medical:80,dexterity:75,experienceLevel:4,medkits:3,...doctor},
 {id:'patient',name:'Paciente',x:2,y:1,maxHp:100,hp:55,bleeding:4,bandaged:0,energy:100,storyProfile:{speech:{treated:phrase}},...patient}
],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}]});
const aid=s=>actBattle(s,{type:'heal',unitId:'doc',targetId:'patient'});

test('only accepted care for another conscious patient emits the optional line; rejected, silent, exhausted and self-care boundaries stay silent',()=>{
 const before=field(),treated=aid(before);assert.equal(treated.lastError,null);assert.equal(treated.units[1].hp,55);assert.equal(treated.units[1].bleeding,0);assert.equal(count(treated),1);assert.equal(treated.units[0].medkits,2);assert.ok(validateBattleSnapshot(treated));
 for(const patient of [{storyProfile:undefined},{storyProfile:{speech:{treated:'  '}}},{hp:14,energy:0},{hp:1}]){const next=aid(field(patient));assert.equal(next.lastError,null);assert.equal(count(next),0);assert.ok(validateBattleSnapshot(next));}
 for(const original of [field({}, {medkits:0}),field({}, {medical:0}),field({hp:0,bleeding:0}),field({x:4,y:4}),field({hp:100,bleeding:0})]){const next=aid(original);assert.ok(next.lastError);assert.equal(count(next),0);assert.deepEqual(next.units,original.units);}
 const self=field({}, {hp:55,bleeding:4,bandaged:0,storyProfile:{speech:{treated:phrase}}}),next=actBattle(self,{type:'heal',unitId:'doc',targetId:'doc'});assert.equal(next.lastError,null);assert.equal(next.units[0].medkits,2);assert.equal(count(next),0);
});

test('a resident that wakes in the following ambient phase does not retroactively speak for care received while exhausted',()=>{
 const b=createBattle([{id:'doc',name:'Sanitario',x:1,y:1,medical:80,medkits:2}],{width:8,height:8,enemies:[],exploration:true,npcs:[{id:'civil',name:'Vecina',x:2,y:1,civilianHealthVersion:1,maxHp:100,hp:14,energy:0,unconscious:true,civilianWoundVersion:1,bleeding:0,bandaged:0,storyProfile:{speech:{treated:phrase}}}]});
 const n=actBattle(b,{type:'heal',unitId:'doc',targetId:'civil'});assert.equal(n.lastError,null);assert.equal(n.npcs[0].hp,15);assert.equal(n.units[0].medkits,1);assert.equal(n.npcs[0].energy,10);assert.equal(n.npcs[0].unconscious,false);assert.equal(count(n),0);assert.ok(validateBattleSnapshot(n));
 const later=actBattle(validateBattleSnapshot(n),{type:'ambient'});assert.equal(later.npcs[0].hp,15);assert.equal(later.npcs[0].energy,20);assert.equal(count(later),0);
});
