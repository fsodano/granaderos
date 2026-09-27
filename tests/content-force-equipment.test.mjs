import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {defaultForceEquipment,forceWeaponUsers} from '../game/content-force-equipment.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {oppositionFor} from '../game/narrative.js';
import {prepareGarrison} from '../game/garrison.js';
import {weaponSpecification,contentWeaponOf} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,endTurn,weaponFor} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const tiles=Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0}));
const definition=(id,changes={})=>({...defaultContentPackage().weapons.find(w=>w.template===1805),id,name:id,capacity:4,damage:37,fireAP:13,aimAP:0,reloadAP:40,range:24,weight:2,price:180,art:'/art/weapon-1808.png',...changes});
function content(){
 const d=defaultContentPackage();d.weapons.push(definition('guard-pistol'),definition('line-pistol',{capacity:8}),definition('veteran-pistol',{capacity:3}));
 d.oppositionEquipment={officer:'guard-pistol',line:'line-pistol',veteran:'veteran-pistol'};
 d.militiaEquipment={green:'line-pistol',regular:'guard-pistol',veteran:null};
 for(const c of d.characters.filter(c=>Number(c.id.slice(7))>=100)){c.arrivalHours=0;c.monthlyPay=30;}
 return d;
}
function attack(d=content()){
 let s=secureArea(initialCampaign(8,d),'buenos_aires');for(const id of [110,111,112,113])s=order(s,{type:'recruitCivic',id,term:'week'});
 s=order(s,{type:'travel',sector:'buenos_aires'});return order(s,{type:'attack',sector:'san_nicolas'});
}
function train(s,rank){s=order(s,{type:'militia',trainerId:1000,rank});return order(s,{type:'wait',hours:s.militiaTraining[0].remaining});}
function leave(s,b){const pair=syncBattleTime(s,b);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});}

test('force assignments round-trip and reject missing, extra and invalid weapon references',()=>{
 const d=content();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);
 assert.deepEqual(forceWeaponUsers(d,'guard-pistol'),['Oficiales enemigos','Montoneros']);
 assert.deepEqual(defaultForceEquipment('militiaEquipment',[]),{green:null,regular:null,veteran:null});
 for(const field of ['oppositionEquipment','militiaEquipment'])for(const value of [null,[],{},'bad',{...d[field],extra:null},{...d[field],[Object.keys(d[field])[0]]:'missing'}]){
  const bad=structuredClone(d);bad[field]=value;assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(8,bad));
 }
});
test('ordinary campaigns and older content without force assignments keep the original equipment',()=>{
 const request={theater:'coast',squad:[{},{},{}],difficulty:2};
 const ordinary=initialCampaign(),old=content();delete old.oppositionEquipment;delete old.militiaEquipment;
 for(const s of [ordinary,initialCampaign(8,old)]){
  assert.deepEqual(oppositionFor(request,s),oppositionFor(request));s.sectors.retiro.militia=[1,1,1];
  const units=prepareGarrison(s,'retiro');assert.deepEqual(units.map(u=>[u.weapon,u.loaded,u.ammo]),[[1804,1,5],[1803,1,5],[1801,1,5]]);assert.ok(units.every(u=>!contentWeaponOf(u)));
 }
});
test('an actual attack generates each authored role with finite ammunition and survives save',()=>{
 const s=attack(),b=enterSector(s.pendingBattle),restored=save(s,b);
 const enemies=restored.battle.units.filter(u=>u.side==='enemy');assert.equal(enemies.length,4);
 assert.deepEqual(enemies.map(u=>contentWeaponOf(u).id),['guard-pistol','line-pistol','line-pistol','veteran-pistol']);
 assert.deepEqual(enemies.map(u=>[u.loaded,u.ammo]),[[4,9],[8,5],[8,5],[3,10]]);
 for(const u of enemies){assert.equal(weaponFor(u).art,'/art/weapon-1808.png');assert.equal(u.loaded+u.ammo,13);}
 const d=content();d.oppositionEquipment={officer:null,line:null,veteran:null};const noGuns=attack(d),empty=enterSector(noGuns.pendingBattle);
 assert.ok(empty.units.filter(u=>u.side==='enemy').every(u=>u.weapon===0&&u.loaded===0&&u.ammo===0&&u.priming===0));assert.ok(save(noGuns,empty));
});
test('generated enemy AI spends the edited firing cost and consumes its own ammunition',()=>{
 const d=content();Object.assign(d.weapons.find(w=>w.id==='guard-pistol'),{fireAP:70,damage:1,range:100});const s=attack(d),enemy=s.pendingBattle.enemies[0];
 let b=createBattle([{id:'player',x:1,y:1,weapon:1800}],{width:14,height:10,seed:45,tiles,enemies:[{...enemy,x:4,y:1}]});
 b=endTurn(b);const fired=b.units.find(u=>u.side==='enemy');assert.equal(fired.loaded,3);assert.equal(fired.ammo,9);assert.equal(fired.ap,30);assert.ok(b.log.some(t=>t.includes('dispara')));
});
test('a generated enemy firearm can be recovered and retained through campaign retreat and reentry',()=>{
 const d=content();d.weapons.push(definition('player-pistol',{capacity:3,damage:100,range:100,fireAP:6}));const c=d.characters.find(c=>c.id==='person-110');c.weapon='player-pistol';c.attributes.marksmanship=100;
 let s=attack(d);const request=s.pendingBattle;
 // Compact terrain isolates weapon ownership while using real generated soldiers.
 let b=createBattle(request.squad.map((u,i)=>({...u,x:1,y:1+i*2})),{...request,weather:{rain:0,humidity:0},width:14,height:10,tiles,seed:45,enemies:request.enemies.map((u,i)=>({...u,x:i===0?2:12,y:i===0?1:5+i}))});
 for(let i=0;i<3&&b.units.find(u=>u.id==='enemy-0').hp>0;i++){b=actBattle(b,{type:'fire',unitId:'110',targetId:'enemy-0',aim:2});assert.equal(b.lastError,null);}
 assert.equal(b.units.find(u=>u.id==='enemy-0').hp,0);
 b=actBattle(b,{type:'loot',unitId:'110',targetId:'enemy-0',item:'weapon'});assert.equal(b.lastError,null);
 const key=Object.keys(b.units[0].inventory).find(k=>k.startsWith('weapon:'));b=actBattle(b,{type:'equipLoot',unitId:'110',inventoryKey:key});assert.equal(b.lastError,null);
 assert.equal(weaponFor(b.units[0]).contentId,'guard-pistol');assert.equal(b.units[0].loaded,4);
 const pair=syncBattleTime(s,b);assert.equal(pair.error,null);const funds=pair.campaign.resources.treasury,refund=pair.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.ammo+u.loaded,0);s=order(pair.campaign,{type:'battleResult',outcome:'retreat',battleId:request.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.resources.treasury,funds+refund);s=save(s).campaign;s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.pendingBattle.ammunitionSources.find(u=>u.id==='enemy-0').loaded,0);b=enterSector(s.pendingBattle,s.sectorStates.san_nicolas);
 assert.equal(b.units.find(u=>u.id==='enemy-0').hp,0);assert.equal(b.units.find(u=>u.id==='enemy-0').weaponDropped,true);
 assert.equal(weaponFor(b.units.find(u=>u.id==='110')).contentId,'guard-pistol');assert.ok(save(s,b));
});
test('trained militia use all authored ranks and retain identity, wear and spent ammunition on reentry',()=>{
 let s=order(secureArea(initialCampaign(8,content()),'buenos_aires','ensenada'),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 s=train(s,0);s=order(s,{type:'visitSector'});let request=s.pendingBattle;assert.equal(request.garrison.length,3);
 assert.ok(request.garrison.every(u=>contentWeaponOf(u).id==='line-pistol'&&u.loaded===6&&u.ammo===0));
 let b=createBattle([...request.squad.map(u=>({...u,x:1,y:8})),...request.garrison.map((u,i)=>({...u,x:1,y:1+i*2}))],{...request,exploration:false,width:14,height:10,tiles,seed:45,enemies:[{id:'raider',x:4,y:1,weapon:1800}]});
 const shooter=b.units.find(u=>u.militia),id=shooter.id;b=actBattle(b,{type:'fire',unitId:id,targetId:'raider'});assert.equal(b.lastError,null);
 const remaining=b.units.find(u=>u.id===id);assert.equal(remaining.loaded,5);const condition=remaining.condition;
 s=save(leave(s,b)).campaign;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 const retained=b.units.find(u=>u.id===id);assert.equal(retained.loaded,5);assert.equal(retained.condition,condition);assert.equal(weaponFor(retained).contentId,'line-pistol');assert.ok(save(s,b));s=leave(s,b);
 for(const [rank,weapon,loaded,ammo]of [[1,'guard-pistol',4,2],[2,null,0,0]]){
  s=train(s,rank);s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);
  const units=b.units.filter(u=>u.militia&&u.hp>0);assert.equal(units.length,3);assert.ok(units.every(u=>u.militiaRank===rank&&(contentWeaponOf(u)?.id??null)===weapon&&u.loaded===loaded&&u.ammo===ammo));s=save(leave(s,b)).campaign;
 }
});
test('saved pending forces and garrisons reject edited definitions, incompatible hosts and invalid ammunition',()=>{
 const s=attack();for(const mutate of [u=>u.weapon=1800,u=>u.loaded=99,u=>u.ammo=-1,u=>delete u.ammo,u=>u.weaponMetadata.contentWeapon.damage++]){
  const bad=structuredClone(s);mutate(bad.pendingBattle.enemies[0]);assert.throws(()=>save(bad,enterSector(s.pendingBattle)));
 }
 let militia=order(secureArea(initialCampaign(8,content()),'buenos_aires','ensenada'),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});militia=train(militia,0);militia=order(militia,{type:'visitSector'});militia=leave(militia,enterSector(militia.pendingBattle));
 for(const mutate of [u=>u.weapon=1800,u=>u.loaded=99,u=>u.ammo=-1,u=>u.weaponMetadata.contentWeapon.damage++]){const bad=structuredClone(militia);mutate(bad.garrisons.retiro[0]);assert.throws(()=>save(bad));}
});
