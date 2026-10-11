import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {oppositionFor} from '../game/narrative.js';
import {prepareGarrison} from '../game/garrison.js';
import {militiaCourse} from '../game/militia.js';
import {contentWeaponOf} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,weaponFor} from '../game/tactical.js';
import {spriteAppearance} from '../game/sprite-appearances.js';
import {spriteSkinTone} from '../game/sprite-skin.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {scriptedWithdrawal} from './scripted-battle-report.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const enemyAppearance={officer:{spriteAppearance:'woman-scout',skinTone:'dark'},line:{spriteAppearance:'worker',skinTone:'light'},veteran:{spriteAppearance:'gaucho',skinTone:'brown'}};
const militiaAppearance={green:{spriteAppearance:'woman-shawl',skinTone:'dark'},regular:{spriteAppearance:'surgeon',skinTone:'light'},veteran:{spriteAppearance:'worker',skinTone:'brown'}};
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const save=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));
const art=unit=>({spriteAppearance:spriteAppearance(unit),skinTone:spriteSkinTone(unit)});
const role=i=>i===0?'officer':i%3===0?'veteran':'line';
function content(){
 const d=defaultContentPackage(),pistol=d.weapons.find(w=>w.template===1805),blade=d.weapons.find(w=>w.template===1812);
 Object.assign(d,{id:'post-forces',name:'Guardias de la posta',scenario:'generic-v1',includeOriginalResidents:false,errands:[],roadsideDiscoveries:[],placements:[],quests:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 d.weapons=[{...pistol,id:'post-sidearm',name:'Pistola de la posta',damage:100,fireAP:6,capacity:3,range:100},{...pistol,id:'guard-sidearm',name:'Pistola de la guardia',damage:37,fireAP:70,capacity:2},{...blade,id:'guard-tool',name:'Herramienta de la guardia',damage:13,ap:70,reach:3}];
 d.characters=d.characters.filter(c=>c.id==='person-110');const c=d.characters[0];Object.assign(c,{id:'post-guard',name:'Alma de la posta',nickname:'Alma',portrait:image,recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],abilities:[],arrivalHours:0,monthlyPay:30,weapon:'post-sidearm',spriteAppearance:'worker',skinTone:'brown'});delete c.blade;Object.assign(c.attributes,{marksmanship:100,leadership:80});
 Object.assign(d.rules,{startingTreasury:10000,enemyCartridges:6,militiaCartridges:6});
 for(const field of ['oppositionEquipment','oppositionBlades','militiaEquipment','militiaBlades'])delete d[field];
 return d;
}
function profiles(){
 const d=content();Object.assign(d,{oppositionEquipment:{officer:'guard-sidearm',line:'guard-tool',veteran:'guard-sidearm'},oppositionBlades:{officer:'guard-tool',line:'guard-tool',veteran:null},militiaEquipment:{green:'guard-sidearm',regular:'guard-tool',veteran:null},militiaBlades:{green:'guard-tool',regular:null,veteran:'guard-tool'},oppositionAppearance:structuredClone(enemyAppearance),militiaAppearance:structuredClone(militiaAppearance)});return d;
}
function recruit(d){let s=initialCampaign(45,d);const id=operativeIdForCharacter(d,d.characters[0].id);s=order(s,{type:'recruitCivic',id,term:'week'});return {s,id};}

test('force appearance maps round-trip and reject incomplete roles, unsupported sprites and palettes',()=>{
 const d=profiles();assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);
 for(const field of ['oppositionAppearance','militiaAppearance']){
  const first=Object.keys(d[field])[0];
  for(const value of [null,[],{},'bad',{...d[field],extra:d[field][first]},{...d[field],[first]:null},{...d[field],[first]:{spriteAppearance:'foreign-uniform',skinTone:'dark'}},{...d[field],[first]:{spriteAppearance:['worker'],skinTone:'brown'}},{...d[field],[first]:{spriteAppearance:'worker',skinTone:'blue'}},{...d[field],[first]:{spriteAppearance:'worker'}},{...d[field],[first]:{spriteAppearance:'worker',skinTone:'brown',bonus:true}}]){const bad=structuredClone(d);bad[field]=value;assert.ok(validateContentPackage(bad).length,field);assert.throws(()=>initialCampaign(45,bad),/apariencia|paleta/);}
 }
});

test('generic force omissions and explicit null blades issue no historical equipment or uniform',()=>{
 for(const explicitNull of [false,true]){
  const d=content();if(explicitNull){d.oppositionBlades={officer:null,line:null,veteran:null};d.militiaBlades={green:null,regular:null,veteran:null};}
  const s=initialCampaign(45,d),enemies=oppositionFor({squad:[{}],difficulty:1,enemyCount:4},s).enemies;s.sectors.retiro.militia=[1,1,1];const militia=prepareGarrison(s,'retiro');
  for(const unit of [...enemies,...militia]){assert.deepEqual([unit.weapon,unit.blade,unit.loaded,unit.ammo],[0,0,0,0]);assert.equal(contentWeaponOf(unit),undefined);assert.equal(contentWeaponOf(unit,'blade'),undefined);assert.deepEqual(art({...unit,side:'enemy'}),{spriteAppearance:'worker',skinTone:'brown'});}
  assert.ok(save(s));
 }
});

test('new force appearance references reject forged role, field and style while older snapshots remain readable',()=>{
 const {s:ready}=recruit(profiles()),s=order(ready,{type:'attack',sector:'buenos_aires'}),battle=enterSector(s.pendingBattle),wire=encodeSave(s,battle);
 const expected={field:'oppositionEquipment',role:'officer'};assert.deepEqual(battle.units.find(u=>u.id==='enemy-0').forceAppearance,expected);
 for(const edit of [unit=>unit.skinTone='light',unit=>unit.spriteAppearance='royalist',unit=>unit.forceAppearance=null,unit=>unit.forceAppearance={field:'oppositionEquipment',role:'foreign'},unit=>unit.forceAppearance={field:'foreign',role:'officer'},unit=>unit.forceAppearance={field:['oppositionEquipment'],role:'officer'},unit=>unit.forceAppearance={field:'oppositionEquipment',role:['officer']},unit=>unit.forceAppearance={field:'oppositionEquipment',role:'officer',bonus:true},unit=>delete unit.forceAppearance.role]){
  for(const location of ['battle','request']){const forged=JSON.parse(wire),unit=location==='battle'?forged.battle.units.find(u=>u.id==='enemy-0'):forged.campaign.pendingBattle.enemies[0];edit(unit);assert.throws(()=>decodeSave(JSON.stringify(forged)),/apariencia guardada/);}
 }
 const older=JSON.parse(wire);for(const unit of [...older.campaign.pendingBattle.enemies,...older.battle.units])delete unit.forceAppearance;const restored=decodeSave(JSON.stringify(older));assert.deepEqual(art(restored.battle.units.find(u=>u.id==='enemy-0')),enemyAppearance.officer);
 const peaceful=initialCampaign(45,profiles());peaceful.sectors.retiro.militia=[1,0,0];prepareGarrison(peaceful,'retiro');const stored=JSON.parse(encodeSave(peaceful));stored.campaign.garrisons.retiro[0].skinTone='light';assert.throws(()=>decodeSave(JSON.stringify(stored)),/apariencia guardada/);
});

test('generated campaign enemies keep authored appearance and finite equipment through real loot, retreat and saved reentry',()=>{
 const {s:ready,id}=recruit(profiles());let s=order(ready,{type:'attack',sector:'buenos_aires'}),request=s.pendingBattle;
 let deployed=enterSector(request);for(const [i,unit]of deployed.units.filter(u=>u.side==='enemy').entries()){assert.deepEqual(art(unit),enemyAppearance[role(i)]);assert.deepEqual(unit.forceAppearance,{field:'oppositionEquipment',role:role(i)});assert.equal(unit.blade,i%3===0&&i!==0?0:1812);}
 const first=save(s,deployed);assert.deepEqual(first.battle.units.filter(u=>u.side==='enemy').map(art),deployed.units.filter(u=>u.side==='enemy').map(art));
 // Issued forces use a compact open field to isolate physical loot and return.
 // This is a subsystem check, not a historical campaign route.
 const tiles=Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
 let b=createBattle(request.squad.map(u=>({...u,x:1,y:1})),{...request,width:20,height:20,tiles,seed:45,weather:{rain:0,humidity:0},enemies:request.enemies.map((u,i)=>({...u,x:i?19:2,y:i?19-i:1,overwatch:false}))});
 for(let i=0;i<3&&b.units.find(u=>u.id==='enemy-0').hp>0;i++){b=actBattle(b,{type:'fire',unitId:String(id),targetId:'enemy-0',aim:2});assert.equal(b.lastError,null,b.lastError);}
 assert.equal(b.units.find(u=>u.id==='enemy-0').hp,0);assert.deepEqual(art(b.units.find(u=>u.id==='enemy-0')),enemyAppearance.officer);
 b=actBattle(b,{type:'loot',unitId:String(id),targetId:'enemy-0',item:'weapon'});assert.equal(b.lastError,null,b.lastError);const holder=b.units.find(u=>u.id===String(id)),key=Object.keys(holder.inventory).find(k=>k.startsWith('weapon:'));assert.ok(key);
 b=actBattle(b,{type:'equipLoot',unitId:String(id),inventoryKey:key});assert.equal(b.lastError,null,b.lastError);assert.equal(weaponFor(b.units.find(u=>u.id===String(id))).contentId,'guard-sidearm');
 b=scriptedWithdrawal(b);const synced=syncBattleTime(s,b);assert.equal(synced.error,null,synced.error);s=order(synced.campaign,{type:'battleResult',outcome:'retreat',battleId:request.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});s=save(s).campaign;
 s=order(s,{type:'attack',sector:'buenos_aires'});b=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);const restored=save(s,b),corpse=restored.battle.units.find(u=>u.id==='enemy-0');assert.equal(corpse.hp,0);assert.equal(corpse.weaponDropped,true);assert.deepEqual(art(corpse),enemyAppearance.officer);assert.equal(weaponFor(restored.battle.units.find(u=>u.id===String(id))).contentId,'guard-sidearm');
});

test('paid militia retain their authored appearance and finite equipment through deployment, save and return',()=>{
 const {s:ready,id}=recruit(profiles());let s=order(secureArea(ready,'buenos_aires','ensenada'),{type:'militia',trainerId:id,rank:0});
 for(let n=0;s.militiaTraining.length&&n<12;n++)s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining+12});assert.equal(s.militiaTraining.length,0);
 s=order(s,{type:'visitSector'});let b=enterSector({...s.pendingBattle,hour:s.hour});const actual=b.units.filter(u=>u.militia);assert.equal(actual.length,3);for(const unit of actual){assert.deepEqual(art(unit),militiaAppearance.green);assert.equal(contentWeaponOf(unit).id,'guard-sidearm');assert.equal(contentWeaponOf(unit,'blade').id,'guard-tool');assert.deepEqual([unit.loaded,unit.ammo],[2,4]);}
 const restored=save(s,b);s=restored.campaign;b=restored.battle;const synced=syncBattleTime(s,b);assert.equal(synced.error,null,synced.error);s=order(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});s=save(s).campaign;
 const stored=structuredClone(s.garrisons.retiro);s=order(s,{type:'visitSector'});b=enterSector({...s.pendingBattle,hour:s.hour},s.sectorStates.retiro);for(const unit of b.units.filter(u=>u.militia)){const issued=stored.find(u=>String(u.id)===unit.id);assert.deepEqual(art(unit),art(issued));assert.deepEqual([unit.loaded,unit.ammo,unit.condition],[issued.loaded,issued.ammo,issued.condition]);}
 assert.ok(save(s,b));
});

test('stock training metadata preserves its bonus while generic legacy slots require explicit traits',()=>{
 const normal=militiaCourse({id:999,leadership:80,traits:[]},0);
 for(const id of [11,57]){assert.equal(militiaCourse({id,leadership:80,traits:[]},0).specialist,true);assert.ok(militiaCourse({id,leadership:80,traits:[]},0).hours<normal.hours);assert.deepEqual(militiaCourse({id,leadership:80,traits:[],genericCharacter:true},0),normal);assert.equal(militiaCourse({id,leadership:80,traits:['line_marksman'],genericCharacter:true},0).specialist,true);}
 const d=content();delete d.scenario;d.campaignStory=defaultCampaignStory();d.characters[0].id='person-11';const {s,id}=recruit(d),trainer=rosterFor(s).find(u=>u.id===id);assert.equal(id,11);assert.equal(trainer.genericCharacter,true);assert.deepEqual(militiaCourse(trainer,0),normal);
 const restored=save(s).campaign;assert.deepEqual(militiaCourse(rosterFor(restored).find(u=>u.id===id),0),normal);
});
