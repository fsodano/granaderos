import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {CHARACTER_ABILITIES,hasCharacterAbility} from '../game/character-abilities.js';
import {characterProfile} from '../game/characters.js';
import {createBattle,actBattle,endTurn,getReachable,shotChance,canSee,actionCosts} from '../game/tactical.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createContentTestRange} from '../game/content-test-range.js';
import {missionContacts,sanLorenzoAlly} from '../game/missions.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
function content(abilities=[]){
 const d=defaultContentPackage(),c={...structuredClone(d.characters.find(c=>c.id==='person-100')),id:'alma-nueva',name:'Alma Nueva',nickname:'Alma',abilities:[...abilities],traits:[],monthlyPay:0,arrivalHours:1,weapon:'firearm-1808'};
 Object.assign(c.attributes,{maxHp:100,marksmanship:100,leadership:85,agility:75,medical:98});d.characters.push(c);return d;
}
function subject(abilities=[],extra={}){
 const d=content(abilities);if(extra.weapon!==undefined)d.characters.at(-1).weapon=extra.weapon>=1809?null:`firearm-${extra.weapon}`;
 const op=rosterFor(initialCampaign(42,d)).find(o=>o.contentId==='alma-nueva');return {...op,...extra};
}
const tiles=(width=14,height=10)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const battle=(units,enemies=[],options={})=>createBattle(units,{width:14,height:10,tiles:tiles(),seed:45,enemies,...options});
const act=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const pa=(s,id)=>orderDescriptors(s,s.units[0]).find(o=>o.id===id).pa;

test('a new hired identity keeps explicit abilities in the dossier, range, deployment and saved reentry',()=>{
 const d=content(['bodyguard','rapid_first_aid']),id=operativeIdForCharacter(d,'alma-nueva');
 // Editor ordering and display names do not determine a runtime identity or power.
 const reordered=structuredClone(d);reordered.characters.reverse();reordered.characters.find(c=>c.id==='alma-nueva').name='Otra persona';assert.equal(operativeIdForCharacter(reordered,'alma-nueva'),id);
 assert.deepEqual(rosterFor(initialCampaign(42,reordered)).find(o=>o.id===id).abilities,['bodyguard','rapid_first_aid']);
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});s=order(save(s).campaign,{type:'wait',hours:1});s=order(s,{type:'visitSector'});
 let pair=save(s,enterSector(s.pendingBattle)),unit=pair.battle.units.find(u=>u.id===String(id));assert.deepEqual(unit.abilities,['bodyguard','rapid_first_aid']);
 assert.deepEqual(characterProfile(unit).skills,['Protección de compañeros','Atención rápida']);assert.equal(actionCosts(pair.battle,unit).heal,18);
 s=order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=order(save(s).campaign,{type:'visitSector'});pair=save(s,enterSector(s.pendingBattle,s.sectorStates.retiro));assert.deepEqual(pair.battle.units[0].abilities,unit.abilities);
 assert.deepEqual(createContentTestRange(d,'alma-nueva').units[0].abilities,unit.abilities);
});

test('authored bodyguards intercept real enemy fire and an explicit empty list removes the old identity power',()=>{
 const make=(abilities,id=2000,commanderAbilities=['protected_commander'],leader=85)=>battle([
  subject(abilities,{id,x:10,y:2,weapon:1811}),{id:'commander',name:'Mando',x:10,y:1,leadership:leader,abilities:commanderAbilities}
 ],[{id:'enemy',x:1,y:1,weapon:1800,loaded:1,marksmanship:100,ammo:0,fatigue:100,patrol:false}]);
 for(const id of [2000,3]){
  const enabled=make(['bodyguard'],id),n=endTurn(enabled);assert.equal(n.units[1].hp,100);assert.ok(n.units[0].hp<100);assert.ok(n.log.some(l=>l.includes('se interpone')));
  const disabled=endTurn(make([],id));assert.ok(disabled.units[1].hp<100);assert.equal(disabled.units[0].hp,100);
 }
 const unprotected=endTurn(make(['bodyguard'],2000,[]));assert.ok(unprotected.units[1].hp<100);
 const highLeader=endTurn(make(['bodyguard'],2000,[],90));assert.equal(highLeader.units[1].hp,100,'The existing high-leadership protection rule remains valid');
 const far=make(['bodyguard']);far.units[0].y=6;assert.ok(endTurn(far).units[1].hp<100);
});

test('an independent counterattacker responds to actual melee; Cabral can lose this ability',()=>{
 const make=(abilities,id)=>battle([subject(abilities,{id,x:4,y:1,weapon:1811})],[{id:'attacker',x:3,y:1,weapon:1811,ammo:0,patrol:false}]);
 for(const id of [2000,3]){
  const skilled=endTurn(make(['counterattack'],id)),plain=endTurn(make([],id));
  assert.ok(skilled.log.some(l=>l.includes('contragolpe')));assert.ok(skilled.units[1].hp<plain.units[1].hp);assert.ok(!plain.log.some(l=>l.includes('contragolpe')));
 }
});

test('authored shot, movement, breach and medical costs control real low-AP admission and HUD values',()=>{
 for(const id of [2000,4]){
  const make=abilities=>battle([subject(abilities,{id,x:1,y:1})],[{id:'enemy',x:6,y:1,overwatch:false}]);
  const fast=make(['quick_shot','quick_movement']),plain=make([]);fast.units[0].ap=6;plain.units[0].ap=6;
  assert.equal(pa(fast,'fire'),6);assert.equal(pa(plain,'fire'),8);assert.equal(act(fast,{type:'fire',unitId:id,targetId:'enemy'}).units[0].ap,0);assert.ok(actBattle(plain,{type:'fire',unitId:id,targetId:'enemy'}).lastError);
  assert.equal(act(fast,{type:'move',unitId:id,x:2,y:1}).units[0].x,2);assert.ok(actBattle(plain,{type:'move',unitId:id,x:2,y:1}).lastError);
 }
 for(const [ability,oldId,action]of [['breaching',6,'breach'],['rapid_first_aid',10,'heal']]){
  for(const id of [2000,oldId]){
   const make=abilities=>{const b=battle([subject(abilities,{id,x:1,y:1,hp:30,bleeding:4})],[{id:'enemy',x:12,y:8}]);b.units[0].ap=action==='heal'?18:25;Object.assign(b.tiles.find(t=>t.x===2&&t.y===1),{type:'wall',material:'adobe',blocked:true});return b;};
   const skilled=make([ability]),plain=make([]),a={type:action,unitId:id,x:2,y:1};const done=act(skilled,a);assert.equal(done.units[0].ap,0);assert.ok(actBattle(plain,a).lastError);
   if(action==='heal'){assert.equal(done.units[0].hp,30);assert.equal(done.units[0].bleeding,0);assert.equal(done.units[0].medkits,skilled.units[0].medkits-1);assert.equal(pa(skilled,'heal'),18);}else assert.equal(done.tiles.find(t=>t.x===2&&t.y===1).blocked,false);
  }
 }
 const rescuer=battle([subject([],{hp:30,traits:['field_rescuer']})]);assert.equal(pa(rescuer,'heal'),20);assert.equal(actionCosts(rescuer,rescuer.units[0]).heal,20);
});

test('mud riding, night scouting and scatter concealment follow authored abilities instead of names',()=>{
 const rider=abilities=>{const b=battle([subject(abilities,{x:1,y:1,mounted:true})],[],{exploration:true});b.tiles.find(t=>t.x===2&&t.y===1).type='mud';return b;};
 const fast=rider(['mud_rider']),plain=rider([]);assert.ok(getReachable(fast,'2000').find(p=>p.x===2&&p.y===1).cost<getReachable(plain,'2000').find(p=>p.x===2&&p.y===1).cost);
 const dark=abilities=>battle([subject(abilities,{x:1,y:1,weapon:1807,marksmanship:60})],[{id:'enemy',x:8,y:1}],{night:true});
 const scout=dark(['night_scout']),ordinary=dark([]);assert.equal(canSee(scout,scout.units[0],scout.units[1]),true);assert.equal(canSee(ordinary,ordinary.units[0],ordinary.units[1]),false);
 assert.ok(shotChance(scout,scout.units[0],scout.units[1])>shotChance(ordinary,ordinary.units[0],ordinary.units[1]));
 const cover=abilities=>{const b=battle([subject(abilities,{x:1,y:1,weapon:1807,marksmanship:55})],[{id:'enemy',x:4,y:1}]);b.tiles.find(t=>t.x===4&&t.y===1).cover=60;return b;};
 const scatter=cover(['scatter_concealment']),bare=cover([]);assert.ok(shotChance(scatter,scatter.units[0],scatter.units[1])>shotChance(bare,bare.units[0],bare.units[1]));
});

test('authored command holds morale only in the proper formation and support respects side and distance',()=>{
 for(const ability of ['militia_command','foot_morale','strategic_command']){
  const make=(enabled,extra={})=>battle([{id:'shooter',x:1,y:1,weapon:1800,marksmanship:100}],[{id:'line',x:4,y:1,morale:16,militia:ability==='militia_command',...extra},subject(enabled?[ability]:[],{x:4,y:2})]);
  const held=act(make(true),{type:'fire',unitId:'shooter',targetId:'line'}),broken=act(make(false),{type:'fire',unitId:'shooter',targetId:'line'});assert.equal(held.units[1].routed,false,ability);assert.equal(broken.units[1].routed,true,ability);
  if(ability!=='strategic_command'){const wrong=act(make(true,ability==='militia_command'?{militia:false}:{mounted:true}),{type:'fire',unitId:'shooter',targetId:'line'});assert.equal(wrong.units[1].routed,true);}
 }
 for(const ability of ['tactical_command','strategic_command']){
  const b=battle([{id:'shooter',x:1,y:1,marksmanship:35},subject([ability],{x:1,y:2})],[{id:'enemy',x:7,y:1}]);
  const aided=shotChance(b,b.units[0],b.units[2]),base=structuredClone(b);base.units[1].abilities=[];assert.ok(aided>shotChance(base,base.units[0],base.units[2]));
  b.units[1].side='enemy';assert.equal(shotChance(b,b.units[0],b.units[2]),shotChance(base,base.units[0],base.units[2]));b.units[1].side='player';b.units[1].y=9;assert.equal(shotChance(b,b.units[0],b.units[2]),shotChance(base,base.units[0],base.units[2]));
 }
 const b=battle([{id:'mover',x:1,y:1}],[{id:'fast',name:'Rápido',x:5,y:1,agility:90},{id:'trained',name:'Con apoyo',x:9,y:1,agility:80},subject(['tactical_command'],{x:9,y:3,loaded:0})]);
 const n=act(b,{type:'move',unitId:'mover',x:2,y:1});assert.ok(n.log.find(l=>l.includes('interrumpe el avance')).startsWith('Con apoyo'));
});

test('loading support changes actual firearm and artillery admission and the displayed reload cost',()=>{
 const make=abilities=>battle([{id:'gunner',x:1,y:1,loaded:0},subject(abilities,{x:2,y:1})],[{id:'enemy',x:12,y:8}],{artillery:[{id:'gun',type:'bronze4',side:'player',x:1,y:2,loaded:false,ammo:3}]});
 const supported=make(['loading_support']),plain=make([]);supported.units[0].ap=36;plain.units[0].ap=36;
 assert.equal(pa(supported,'reload'),36);assert.equal(pa(plain,'reload'),36);assert.equal(act(supported,{type:'reload',unitId:'gunner'}).units[0].loaded,1);const partial=act(plain,{type:'reload',unitId:'gunner'});assert.equal(partial.units[0].loaded,0);assert.equal(partial.units[0].ammo,plain.units[0].ammo);assert.equal(partial.units[0].reloadProgress,.8);
 for(const u of supported.units.filter(u=>u.side==='player'))u.ap=50;for(const u of plain.units.filter(u=>u.side==='player'))u.ap=50;
 const complete=act(supported,{type:'artilleryReload',unitId:'gunner',artilleryId:'gun'}),unfinished=act(plain,{type:'artilleryReload',unitId:'gunner',artilleryId:'gun'});assert.equal(complete.artillery[0].loaded,true);assert.equal(complete.artillery[0].ammo,2);assert.equal(complete.units[0].ap,2);assert.equal(unfinished.artillery[0].loaded,false);assert.equal(unfinished.artillery[0].ammo,3);assert.equal(unfinished.artillery[0].reloadProgress,50/60);assert.equal(unfinished.units[0].ap,0);
});

function battery(abilities,type='swivel'){
 return battle([subject(abilities,{x:1,y:2}),{id:'helper',x:2,y:2},{id:'helper-2',x:1,y:3}],[{id:'enemy',x:5,y:3,hp:100,morale:100,overwatch:false}],{artillery:[{id:'gun',type,side:'player',x:2,y:3,loaded:true,ammo:5}]});
}
test('authored artillery abilities affect real crew costs, canister damage and solid-shot penetration',()=>{
 const fast=battery(['artillery_fire']),plain=battery([]);fast.units[0].ap=17;plain.units[0].ap=17;
 assert.equal(act(fast,{type:'artillery',unitId:2000,artilleryId:'gun',x:10,y:3}).units[0].ap,0);assert.ok(actBattle(plain,{type:'artillery',unitId:2000,artilleryId:'gun',x:10,y:3}).lastError);
 const skillShot=act(battery(['artillery_fire']),{type:'artillery',unitId:2000,artilleryId:'gun',x:10,y:3,mode:'canister'}),baseShot=act(battery([]),{type:'artillery',unitId:2000,artilleryId:'gun',x:10,y:3,mode:'canister'});assert.ok(skillShot.units.at(-1).hp<baseShot.units.at(-1).hp);
 const crew=battery(['artillery_loading'],'field8'),bare=battery([],'field8');for(const b of [crew,bare]){b.artillery[0].loaded=false;for(const u of b.units.filter(u=>u.side==='player'))u.ap=60;}
 const skilled=act(crew,{type:'artilleryReload',unitId:2000,artilleryId:'gun'}),unskilled=act(bare,{type:'artilleryReload',unitId:2000,artilleryId:'gun'});assert.equal(skilled.units[0].ap,0);assert.equal(skilled.artillery[0].loaded,true);assert.equal(skilled.artillery[0].ammo,4);assert.equal(unskilled.artillery[0].loaded,false);assert.equal(unskilled.artillery[0].ammo,5);assert.equal(unskilled.artillery[0].reloadProgress,.8);assert.ok(unskilled.units.filter(u=>u.side==='player').every(u=>u.ap===0));
 const wall=abilities=>{const b=battery(abilities);for(const x of [3,4])Object.assign(b.tiles.find(t=>t.x===x&&t.y===3),{type:'wall',material:'adobe',blocked:true});return act(b,{type:'artillery',unitId:2000,artilleryId:'gun',x:10,y:3});};
 assert.equal(wall(['artillery_loading']).tiles.find(t=>t.x===4&&t.y===3).blocked,false);assert.equal(wall([]).tiles.find(t=>t.x===4&&t.y===3).blocked,true);
});

test('authored mounted charge and intimidation change damage and neighboring levy morale',()=>{
 const charge=abilities=>act(battle([subject(abilities,{x:1,y:1,weapon:1809,mounted:true})],[{id:'target',x:4,y:1,hp:100,morale:100,loaded:0,ammo:0,overwatch:false}]),{type:'charge',unitId:2000,targetId:'target'});
 assert.ok(charge(['mounted_charge']).units[1].hp<charge([]).units[1].hp);
 const shock=abilities=>act(battle([subject(abilities,{x:1,y:1,weapon:1812,mounted:true})],[{id:'target',x:6,y:1,hp:10,loaded:0,ammo:0},{id:'levy',x:6,y:2,militia:true,morale:35,loaded:0,ammo:0}]),{type:'charge',unitId:2000,targetId:'target'});
 assert.equal(shock(['mounted_intimidation']).units[2].routed,true);assert.equal(shock([]).units[2].routed,false);
});

test('historical contacts and mission actors carry changed abilities; save validation rejects divergent or malformed copies',()=>{
 const d=content(['quick_shot']);d.characters.find(c=>c.id==='person-3').abilities=[];d.characters.find(c=>c.id==='person-57').abilities=['rapid_first_aid'];
 let s=initialCampaign(42,d);assert.deepEqual(missionContacts(s).find(n=>n.id==='yatasto-san-martin').abilities,['rapid_first_aid']);assert.deepEqual(sanLorenzoAlly(s).abilities,['rapid_first_aid']);
 const id=operativeIdForCharacter(d,'alma-nueva');s=order(s,{type:'recruitCivic',id,term:'week'});s=order(s,{type:'wait',hours:1});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.deepEqual(b.npcs.find(n=>n.operativeId===3).abilities,[]);assert.ok(save(s,b));
 for(const mutate of [v=>v.campaign.operativeState[id].abilities=['bodyguard'],v=>v.campaign.pendingBattle.squad[0].abilities=[],v=>delete v.battle.units[0].abilities,v=>v.battle.npcs.find(n=>n.operativeId===3).abilities=['bodyguard'],v=>v.battle.units[0].abilities=['quick_shot','quick_shot'],v=>v.battle.units[0].abilities=null]){
  const v=JSON.parse(encodeSave(s,b));mutate(v);assert.throws(()=>decodeSave(JSON.stringify(v)),/habilidades/);
 }
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});const retained=structuredClone(s);retained.sectorStates.retiro.npcs.find(n=>n.operativeId===3).abilities=['bodyguard'];assert.throws(()=>save(retained),/habilidades/);
 const ally=structuredClone(s);ally.missionAllies.san_lorenzo=sanLorenzoAlly(ally);ally.missionAllies.san_lorenzo.abilities=[];assert.throws(()=>save(ally),/habilidades/);
 for(const abilities of [null,'bodyguard',['bad'],['bodyguard','bodyguard'],[{}]]){const invalid=content();invalid.characters.at(-1).abilities=abilities;assert.ok(validateContentPackage(invalid).length);assert.throws(()=>initialCampaign(42,invalid));}
 const malformed=battle([subject([])]);malformed.units[0].abilities=['bad'];assert.throws(()=>validateBattleSnapshot(malformed),/habilidades/);
 assert.equal(CHARACTER_ABILITIES.length,19);
});

test('older authored and ordinary campaigns retain historical behavior without allowing saved capability injection',()=>{
 for(const authored of [false,true]){
  const d=defaultContentPackage();for(const c of d.characters)delete c.abilities;
  let s=initialCampaign(42,authored?d:undefined);assert.equal(hasCharacterAbility(rosterFor(s).find(o=>o.id===3),'bodyguard'),true);
  s=order(s,{type:'recruitCivic',id:100,term:'week'});if(authored)s=order(s,{type:'wait',hours:6});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.ok(save(s,b));
  b.units[0].abilities=['bodyguard'];assert.throws(()=>save(s,b),/habilidades/);
 }
});
