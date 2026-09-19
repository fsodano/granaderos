import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,isSupplied,restoreCampaign,serializeCampaign,recruitmentStatus} from '../game/campaign.js';
import {acknowledgeCivilianHarm,hasPendingCivilianHarm,validateCampaignCivilianHarm} from '../game/campaign-civilian-harm.js';
import {applyCivilianHarm,civilianIncidents} from '../game/civilian-harm.js';
import {ENCOUNTERS} from '../game/encounters.js';
import {grenadeOffer} from '../game/equipment.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const flat=()=>Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
const record=(s,id)=>Object.values(s.civilianHarm.records).find(record=>record.npcId===id);
const snapshot=s=>decodeSave(encodeSave(s)).campaign;
const sync=(s,b)=>{const pair=syncBattleTime(s,b);assert.equal(pair.error,null,pair.error);return pair;};
const finish=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(unit=>unit.side==='player')});

function visit(){let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'visitSector'});return {s,b:enterSector(s.pendingBattle)};}
function injury(b,npc,damage,{side='player',militia=false,intentional=false}={}){
 let source=null;
 if(side!=='unknown'){
  source=b.units.find(unit=>unit.side===side&&Boolean(unit.militia)===militia);
  if(!source){source={id:`source-${side}-${militia}`,side,militia,hp:80};b.units.push(source);}
 }
 applyCivilianHarm(b,npc,{source,damage,breathLoss:0,intentional});
}
function ruleFixture(sectorId='retiro',owner='patriot'){
 const pair=visit();
 // Responsibility fixtures change only the scene and its control. They call
 // the real damage recorder and campaign receipt API; they are not travel tests.
 pair.s.pendingBattle.sector=sectorId;pair.s.pendingBattle.npcs=structuredClone(ENCOUNTERS.filter(npc=>npc.sector===sectorId));
 pair.s.sectors[sectorId].owner=owner;pair.s.sectors[sectorId].loyalty=50;
 pair.b.sectorId=sectorId;pair.b.npcs=structuredClone(pair.s.pendingBattle.npcs);pair.b.npcs.forEach((npc,index)=>Object.assign(npc,{x:3+index,y:3}));
 return pair;
}

test('civilian death responsibility uses fixed civic weights, frozen control, and anonymous messages',()=>{
 for(const [side,militia,intentional,owner,expected,kind]of [
  ['player',false,true,'patriot',-10,'civilianPlayerIntentional'],['player',false,false,'patriot',-5,'civilianPlayerAccidental'],
  ['player',true,true,'patriot',-7,'civilianMilitia'],['player',true,false,'patriot',-4,'civilianMilitiaAccidental'],
  ['enemy',false,true,'patriot',-3,'civilianEnemyPatriot'],['enemy',false,false,'patriot',-1,'civilianEnemyPatriotAccidental'],
  ['enemy',false,true,'royalist',10,'civilianEnemyRoyalist'],['enemy',false,false,'royalist',5,'civilianEnemyRoyalistAccidental']
 ]){
  const {s,b}=ruleFixture('retiro',owner),npc=b.npcs.find(npc=>npc.id==='local-retiro');injury(b,npc,100,{side,militia,intentional});
  assert.equal(hasPendingCivilianHarm(s,b),true);const messages=acknowledgeCivilianHarm(s,b);assert.equal(s.sectors.retiro.loyalty,50+expected);
  const saved=record(s,npc.id);assert.equal(saved.effects[0].owner,owner);assert.equal(saved.effects[0].kind,kind);assert.equal(saved.effects[0].delta,expected);
  assert.equal(messages.length,1);assert.ok(messages.every(message=>!message.includes(npc.name)&&!message.includes(npc.id)&&!message.includes(`${npc.x},${npc.y}`)));
  s.sectors.retiro.owner=owner==='patriot'?'royalist':'patriot';assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);assert.equal(s.sectors.retiro.loyalty,50+expected);assert.equal(saved.effects[0].owner,owner);validateCampaignCivilianHarm(s);
 }
});

test('rural and unknown-source deaths are acknowledged once without civic reward or player blame',()=>{
 for(const [sector,side]of [['uspallata','player'],['retiro','unknown']]){
  const {s,b}=ruleFixture(sector),npc=b.npcs.find(npc=>npc.operativeId===undefined);injury(b,npc,100,{side,intentional:true});
  const before=structuredClone(s.sectors);assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);assert.deepEqual(s.sectors,before);assert.equal(s.cityLoyaltyEvents.length,0);assert.equal(record(s,npc.id).effects[0].kind,null);
  assert.equal(hasPendingCivilianHarm(s,b),false);assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);validateCampaignCivilianHarm(s);
 }
});

test('the first surviving direct player wound records no loyalty cost and death adds only one later effect',()=>{
 const {s,b}=visit(),npc=b.npcs.find(npc=>npc.id==='local-retiro'),loyalty=s.sectors.retiro.loyalty;
 injury(b,npc,20,{intentional:true});assert.equal(civilianIncidents(npc).length,1);assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);assert.equal(s.sectors.retiro.loyalty,loyalty);
 injury(b,npc,20,{intentional:true});assert.equal(civilianIncidents(npc).length,1);assert.equal(hasPendingCivilianHarm(s,b),false);
 injury(b,npc,60,{intentional:true});assert.equal(civilianIncidents(npc).length,2);assert.equal(acknowledgeCivilianHarm(s,b).length,1);assert.equal(s.sectors.retiro.loyalty,loyalty-10);
 const before=structuredClone(s);assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);assert.deepEqual(s,before);
});

test('omitted, changed, reordered, and foreign civilian receipts reject without applying a partial consequence',()=>{
 const {s,b}=visit(),npc=b.npcs.find(npc=>npc.id==='local-retiro');injury(b,npc,20);acknowledgeCivilianHarm(s,b);
 for(const change of [
  battle=>battle.npcs.splice(battle.npcs.findIndex(npc=>npc.id==='local-retiro'),1),
  battle=>delete battle.npcs.find(npc=>npc.id==='local-retiro').civilianHarm,
  battle=>battle.npcs.find(npc=>npc.id==='local-retiro').civilianHarm.incidents[0].intentional=true,
  battle=>battle.npcs.find(npc=>npc.id==='local-retiro').civilianHarm.incidents[0].sequence=2,
  battle=>battle.sceneId='yatasto',battle=>battle.battleId='other',battle=>battle.sectorId='mendoza'
 ]){
  const bad=structuredClone(b),before=structuredClone(s);change(bad);assert.throws(()=>hasPendingCivilianHarm(s,bad));assert.throws(()=>acknowledgeCivilianHarm(s,bad));assert.deepEqual(s,before);
 }
 for(const change of [npc=>npc.id='made-up-victim',npc=>npc.operativeId=57,npc=>npc.civilianHarm.incidents[0].attackerId='not-deployed']){
  const {s:clean,b:field}=visit(),victim=field.npcs.find(npc=>npc.id==='local-retiro');injury(field,victim,100);change(victim);const before=structuredClone(clean);assert.throws(()=>acknowledgeCivilianHarm(clean,field));assert.deepEqual(clean,before);
 }
});

test('a paid first visit cannot discard its civilian roster before the first damage acknowledgment',()=>{
 const {s,b}=visit(),npc=b.npcs.find(npc=>npc.id==='local-retiro');injury(b,npc,100);b.npcs=[];
 const before=structuredClone(s),next=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(unit=>unit.side==='player')});
 assert.match(next.lastError,/habitante/);assert.deepEqual(s,before);assert.deepEqual({...next,lastError:null},{...before,lastError:null});assert.equal(next.cityLoyaltyEvents.length,0);
});

test('injured named NPC health reaches the real service record and only lawful recruited survivors may leave the NPC list',()=>{
 let {s,b}=visit();const npc=b.npcs.find(npc=>npc.id==='cabral');injury(b,npc,60);acknowledgeCivilianHarm(s,b);assert.equal(s.operativeState[3].hp,s.operativeState[3].maxHp-60);assert.equal(s.operativeState[3].alive,true);
 const without=structuredClone(b);without.npcs=without.npcs.filter(npc=>npc.id!=='cabral');assert.throws(()=>hasPendingCivilianHarm(s,without));
 // Recruitment ownership is isolated here; dialogue permission is tested by
 // its own subsystem. Only this exact authored operative may leave the roster.
 s.recruited.push(3);assert.equal(hasPendingCivilianHarm(s,without),false);validateCampaignCivilianHarm(s);
 ({s,b}=visit());const dead=b.npcs.find(npc=>npc.id==='cabral');injury(b,dead,100);acknowledgeCivilianHarm(s,b);assert.equal(s.operativeState[3].hp,0);assert.equal(s.operativeState[3].alive,false);assert.equal(recruitmentStatus(s,3,true).available,false);
 s.recruited.push(3);const omitted=structuredClone(b);omitted.npcs=omitted.npcs.filter(npc=>npc.id!=='cabral');assert.throws(()=>hasPendingCivilianHarm(s,omitted));s.operativeState[3].alive=true;s.operativeState[3].hp=80;assert.throws(()=>validateCampaignCivilianHarm(s));
});

test('a critically wounded named volunteer stays unconscious through real remote hire and save, while a dead one cannot be hired',()=>{
 for(const damage of [95,100]){
  let s=initialCampaign(8);s.sectors.buenos_aires.owner='patriot'; // Local control checkpoint; all subsequent orders are paid/ordinary.
  s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});
  let b=enterSector(s.pendingBattle);let npc=b.npcs.find(npc=>npc.id==='sosa');assert.ok(npc);
  if(damage===95){
   injury(b,npc,20);({campaign:s,battle:b}=sync(s,b));assert.equal(s.operativeState[100].hp,s.operativeState[100].maxHp-20);npc=b.npcs.find(npc=>npc.id==='sosa');
   injury(b,npc,75);npc.energy=12;assert.equal(civilianIncidents(npc).length,1);assert.equal(hasPendingCivilianHarm(s,b),true);
  }else injury(b,npc,damage);
  ({campaign:s,battle:b}=sync(s,b));assert.equal(s.operativeState[100].hp,damage===100?0:1);assert.equal(s.operativeState[100].unconscious,damage===95);if(damage===95)assert.equal(s.operativeState[100].energy,12);
  ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));s=finish(s,b);
  const next=dispatchCampaign(s,{type:'recruitCivic',id:100,term:'week'});
  if(damage===100){assert.ok(next.lastError);assert.equal(next.operativeState[100].alive,false);assert.equal(next.recruited.includes(100),false);assert.deepEqual(snapshot(s),s);}
  else {
   assert.equal(next.lastError,null,next.lastError);s=snapshot(next);assert.equal(s.operativeState[100].hp,1);assert.equal(s.operativeState[100].energy,12);assert.equal(s.operativeState[100].unconscious,true);assert.ok(s.recruited.includes(100));
   s=order(s,{type:'visitSector'});const request=s.pendingBattle;assert.ok(!request.npcs.some(npc=>npc.id==='sosa'));
   // A later battlefield casualty is a soldier body, not a second civilian.
   // The completed report must retain the lawful recruitment transfer.
   b=createBattle(request.squad.map((unit,index)=>({...unit,x:1+index,y:2,...(Number(unit.id)===100?{hp:0}:{})})),{...request,width:12,height:10,tiles:flat(),enemies:[],props:[]});
   s=finish(s,b);assert.equal(s.operativeState[100].alive,false);assert.ok(s.recruited.includes(100));assert.ok(!s.sectorStates.buenos_aires.npcs.some(npc=>npc.id==='sosa'));assert.deepEqual(snapshot(s),s);
   assert.equal(record(s,'sosa').transferredTo,100);s=order(s,{type:'dismiss',id:100});assert.ok(!s.recruited.includes(100));assert.deepEqual(snapshot(s),s);
   s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);assert.ok(!b.npcs.some(npc=>npc.id==='sosa'));s=finish(s,b);assert.deepEqual(snapshot(s),s);
  }
 }
});

test('dismissal and real contract expiry preserve a wounded contact transfer across saves and revisits',()=>{
 for(const end of ['dismiss','expire']){
  let s=initialCampaign(8);s.sectors.buenos_aires.owner='patriot';
  s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});
  // Keep the actual resident roster and issued supplies in a compact aid
  // scene. Stabilize the real injury before a full contract day elapses.
  const request=s.pendingBattle;
  let b=createBattle(request.squad.map(unit=>({...unit,x:2,y:2})),{...request,width:12,height:10,tiles:flat(),enemies:[],props:[],npcs:request.npcs.map((npc,index)=>({...npc,x:npc.id==='sosa'?3:8,y:npc.id==='sosa'?2:5+index}))});
  b=act(b,{type:'weapon',unitId:'110',slot:'medical'});injury(b,b.npcs.find(npc=>npc.id==='sosa'),70);({campaign:s,battle:b}=sync(s,b));
  const hp=b.npcs.find(npc=>npc.id==='sosa').hp,dressings=b.units.find(unit=>unit.id==='110').medkits;
  b=act(b,{type:'useItem',unitId:'110',targetId:'sosa',targetKind:'npc'});assert.equal(b.npcs.find(npc=>npc.id==='sosa').hp,hp);assert.equal(b.units.find(unit=>unit.id==='110').medkits,dressings-1);
  ({campaign:s,battle:b}=sync(s,b));assert.equal(s.operativeState[100].bleeding,0);s=finish(s,b);
  s=order(s,{type:'recruitCivic',id:100,term:'day'});assert.equal(record(s,'sosa').transferredTo,100);
  s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);assert.ok(!b.npcs.some(npc=>npc.id==='sosa'));s=finish(s,b);
  if(end==='dismiss')s=order(s,{type:'dismiss',id:100});
  else for(let guard=0;guard<10&&s.recruited.includes(100);guard++)s=order(s,{type:'wait',hours:Math.max(1,s.contracts[100].expiresAt-s.hour)});
  assert.ok(!s.recruited.includes(100));assert.equal(record(s,'sosa').transferredTo,100);s=snapshot(s);
  s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);assert.ok(!b.npcs.some(npc=>npc.id==='sosa'));s=finish(s,b);assert.deepEqual(snapshot(s),s);
  s=order(s,{type:'recruitCivic',id:100,term:'day'});assert.ok(s.recruited.includes(100));assert.equal(record(s,'sosa').transferredTo,100);assert.deepEqual(snapshot(s),s);
 }
});

test('a retained same-scene injury cannot lose its receipts even before an old direct report is acknowledged',()=>{
 const {s,b}=visit(),npc=b.npcs.find(npc=>npc.id==='local-retiro');injury(b,npc,20);s.sectorStates.retiro=structuredClone(b);
 for(const change of [field=>field.npcs.splice(field.npcs.findIndex(npc=>npc.id==='local-retiro'),1),field=>delete field.npcs.find(npc=>npc.id==='local-retiro').civilianHarm]){
  const bad=structuredClone(b);change(bad);assert.throws(()=>hasPendingCivilianHarm(s,bad));
 }
 assert.equal(hasPendingCivilianHarm(s,b),true);acknowledgeCivilianHarm(s,b);assert.equal(record(s,npc.id).incidents.length,1);
});

test('legacy injuries never receive retroactive blame, and a missing canonical ledger cannot erase civic evidence',()=>{
 const {s,b}=visit(),npc=b.npcs.find(npc=>npc.id==='local-retiro');npc.hp=0;assert.equal(hasPendingCivilianHarm(s,b),false);assert.deepEqual(acknowledgeCivilianHarm(s,b),[]);assert.equal(s.cityLoyaltyEvents.length,0);
 const old=initialCampaign();delete old.civilianHarm;assert.doesNotThrow(()=>restoreCampaign(serializeCampaign(old)));
 const wounded=visit();injury(wounded.b,wounded.b.npcs.find(npc=>npc.id==='local-retiro'),20);const synchronized=sync(wounded.s,wounded.b),raw=JSON.parse(encodeSave(synchronized.campaign,synchronized.battle));assert.equal(raw.campaign.cityLoyaltyEvents.length,0);delete raw.campaign.civilianHarm;assert.throws(()=>decodeSave(JSON.stringify(raw)));
 const live=visit();injury(live.b,live.b.npcs.find(npc=>npc.id==='local-retiro'),100);acknowledgeCivilianHarm(live.s,live.b);
 for(const change of [
  bad=>delete bad.civilianHarm,bad=>bad.civilianHarm=null,bad=>bad.civilianHarm.version=2,
  bad=>bad.civilianHarm.records={},bad=>bad.cityLoyaltyEvents=[],
  bad=>Object.values(bad.civilianHarm.records)[0].effects[0].delta=-99,
  bad=>Object.values(bad.civilianHarm.records)[0].effects[0].owner='invalid',
  bad=>Object.values(bad.civilianHarm.records)[0].transferredTo=57,
  bad=>delete Object.values(bad.civilianHarm.records)[0].transferredTo
 ]){const bad=structuredClone(live.s);change(bad);assert.throws(()=>validateCampaignCivilianHarm(bad));}
 const rural=ruleFixture('uspallata');injury(rural.b,rural.b.npcs[0],100);acknowledgeCivilianHarm(rural.s,rural.b);rural.s.sectorStates.uspallata=rural.b;delete rural.s.civilianHarm;assert.throws(()=>validateCampaignCivilianHarm(rural.s));
});

test('real paid grenade death survives synchronization, live save, final report, and same-hour reentry exactly once',()=>{
 let s=initialCampaign(8);
 // The liberated Cuyo corridor and old wound are this late-campaign fixture.
 // Hire, travel, grenade purchase, main-hand equip and the lethal throw are real.
 s.phase=3;for(const id of ['buenos_aires','cordoba','mendoza'])s.sectors[id].owner='patriot';
 s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'mendoza'});
 const cash=s.resources.treasury;s=order(s,grenadeOffer(s,rosterFor(s).find(op=>op.id===110),isSupplied,1).action);assert.equal(s.resources.treasury,cash-80);
 const personal=sectorInventoryModel(s,'mendoza',rosterFor(s),110).personal,item='inventory:grenade:arsenal';
 s=order(s,{type:'sectorInventory',sector:'mendoza',operativeId:110,direction:'equip',slot:'mainhand',inventoryKey:item,expected:JSON.stringify(extractItemQuantity(personal,item,1).stack)});
 s=order(s,{type:'visitSector'});const request=s.pendingBattle,loyalty=s.sectors.mendoza.loyalty;
 let b=createBattle(request.squad.map(unit=>({...unit,x:1,y:2})),{...request,seed:45,width:12,height:10,tiles:flat(),enemies:[],props:[],npcs:request.npcs.map((npc,index)=>({...npc,x:index?10:5,y:index?6+index:2,...(index?{}:{hp:40,energy:100})}))});
 const id=b.npcs[0].id;b=act(b,{type:'throwGrenade',unitId:'110',x:5,y:2});assert.equal(b.npcs[0].hp,0);assert.equal(civilianIncidents(b.npcs[0])[0].kind,'death');
 ({campaign:s,battle:b}=sync(s,b));assert.equal(s.sectors.mendoza.loyalty,loyalty-10);assert.equal(s.cityLoyaltyEvents.filter(event=>event.kind.startsWith('civilian')).length,1);
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));const before=structuredClone(s);({campaign:s,battle:b}=sync(s,b));assert.deepEqual(s,before);
 const omitted=structuredClone(b);omitted.npcs=omitted.npcs.filter(npc=>npc.id!==id);assert.throws(()=>decodeSave(encodeSave(s,omitted)));const rejected=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:omitted,survivors:omitted.units.filter(unit=>unit.side==='player')});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},{...s,lastError:null});
 s=finish(s,b);s=snapshot(s);const hour=s.hour;s=order(s,{type:'visitSector'});assert.equal(s.hour,hour);b=enterSector(s.pendingBattle,s.sectorStates.mendoza);assert.equal(b.npcs.find(npc=>npc.id===id).hp,0);({campaign:s,battle:b}=sync(s,b));assert.equal(s.sectors.mendoza.loyalty,loyalty-10);assert.equal(record(s,id).incidents.length,1);s=finish(s,b);assert.deepEqual(snapshot(s),s);
});
