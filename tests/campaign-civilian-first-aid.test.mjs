import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {applyCivilianHarm,civilianIncidents} from '../game/civilian-harm.js';
import {hasPendingCivilianHarm} from '../game/campaign-civilian-harm.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {playerKnownBattle} from '../game/player-known-state.js';

const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const act=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const sync=(campaign,battle)=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null,pair.error);return pair;};
const save=campaign=>decodeSave(encodeSave(campaign)).campaign;
const finish=(campaign,battle)=>order(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
const npc=(battle,id='sosa')=>battle.npcs.find(npc=>npc.id===id);
const serviceRow=(campaign,id='sosa')=>Object.values(campaign.civilianHarm.records).find(record=>record.npcId===id);

function paidVisit({sector='buenos_aires',target='sosa'}={}){
 let campaign=initialCampaign(8);
 // This lifecycle fixture starts after local liberation and uses a compact,
 // open treatment area. Hiring, supply purchase, march, visit and all reports
 // are ordinary paid actions; every authored resident remains in the scene.
 if(sector!=='retiro')campaign.sectors[sector].owner='patriot';
 const initialCash=campaign.resources.treasury,stock=campaign.merchants.retiro.supplies.medkits;
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign=order(campaign,{type:'purchaseMedicalSupplies',operativeId:112,quantity:1});
 assert.equal(campaign.resources.treasury,initialCash-campaign.contracts[112].paid-30);
 assert.equal(campaign.merchants.retiro.supplies.medkits,stock-1);
 assert.equal(campaign.operativeState[112].medkits,3);
 if(sector!=='retiro')campaign=order(campaign,{type:'travel',sector});
 campaign=order(campaign,{type:'visitSector'});const request=campaign.pendingBattle;
 let battle=createBattle(request.squad.map(unit=>({...unit,x:2,y:2})),{...request,width:12,height:10,props:[],enemies:[],
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
  npcs:request.npcs.map((resident,index)=>({...resident,x:resident.id===target?3:8,y:resident.id===target?2:5+index}))});
 assert.ok(npc(battle,target));battle=act(battle,{type:'weapon',unitId:'112',slot:'medical'});
 return {campaign,battle};
}
function wound(battle,{target='sosa',damage=20,source='player'}={}){
 // The shared damage path supplies the actual wound/bleed attribution; the
 // fixture chooses its magnitude so this test isolates treatment persistence.
 applyCivilianHarm(battle,npc(battle,target),{source:source==='player'?battle.units.find(unit=>unit.id==='112'):null,damage,intentional:source==='player'});
}
const aid=battle=>act(battle,{type:'useItem',unitId:'112',targetId:'sosa',targetKind:'npc'});

function repeatSync(campaign,battle){
 const before=structuredClone(campaign),again=sync(campaign,battle);assert.deepEqual(again.campaign,before,'repeated medical sync does not subtract wounds or consume supplies again');return again;
}

test('paid first aid keeps wounds and refusal through save, reentry, and paid service transfer',()=>{
 let {campaign,battle}=paidVisit();wound(battle);
 assert.equal(npc(battle).hp,npc(battle).maxHp-20);assert.equal(npc(battle).bleeding,2);assert.equal(npc(battle).bandaged,0);
 assert.equal(Object.hasOwn(playerKnownBattle(battle).npcs.find(npc=>npc.id==='sosa'),'bleedSource'),false);
 ({campaign,battle}=sync(campaign,battle));
 const woundedHp=campaign.operativeState[100].maxHp-20;
 assert.equal(campaign.operativeState[100].hp,woundedHp);assert.equal(campaign.operativeState[100].bleeding,2);
 ({campaign,battle}=repeatSync(campaign,battle));
 const before=structuredClone(npc(battle)),supplies=battle.units[0].medkits,loyalty=campaign.sectors.buenos_aires.loyalty;
 battle=aid(battle);
 assert.equal(npc(battle).hp,before.hp);assert.equal(npc(battle).energy,before.energy);assert.equal(npc(battle).unconscious,before.unconscious);
 assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bandaged,20);assert.equal(npc(battle).bleedSource,undefined);assert.equal(npc(battle).civilianWoundVersion,1);
 assert.equal(battle.units[0].medkits,supplies-1);assert.deepEqual(civilianIncidents(npc(battle)),civilianIncidents(before));
 assert.equal(hasPendingCivilianHarm(campaign,battle),true,'bandaging alone must synchronize the named service record');
 ({campaign,battle}=sync(campaign,battle));({campaign,battle}=repeatSync(campaign,battle));
 assert.equal(campaign.operativeState[100].hp,woundedHp);assert.equal(campaign.operativeState[100].bleeding,0);assert.equal(campaign.operativeState[100].bandaged,20);
 assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty);assert.equal(campaign.cityLoyaltyEvents.length,0);
 ({campaign,battle}=decodeSave(encodeSave(campaign,battle)));campaign=save(finish(campaign,battle));
 assert.equal(campaign.operativeState[112].medkits,supplies-1);
 campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle).hp,npc(battle).maxHp-20);assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bandaged,20);assert.equal(npc(battle).civilianWoundVersion,1);
 const refusal=dispatchCampaign(campaign,{type:'talkNPC',unitId:112,npcId:'sosa',approach:'friendly',sectorState:battle});assert.match(refusal.lastError,/Me heriste/);
 campaign=finish(campaign,battle);const cash=campaign.resources.treasury;
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.resources.treasury,cash-campaign.contracts[100].paid);
 assert.equal(campaign.operativeState[100].hp,woundedHp);assert.equal(campaign.operativeState[100].bleeding,0);assert.equal(campaign.operativeState[100].bandaged,20);assert.equal(serviceRow(campaign).transferredTo,100);
 campaign=save(campaign);campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle),undefined);const soldier=battle.units.find(unit=>unit.id==='100');assert.equal(soldier.hp,woundedHp);assert.equal(soldier.bandaged,20);assert.equal(soldier.bleeding,0);
 campaign=save(finish(campaign,battle));assert.equal(campaign.operativeState[100].hp,woundedHp);
});

test('unattributed civilian bleeding survives paid hiring and dismissal without invented blame or respawn',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{source:'unknown'});
 ({campaign,battle}=sync(campaign,battle));({campaign,battle}=repeatSync(campaign,battle));
 const hp=campaign.operativeState[100].maxHp-20;
 assert.equal(campaign.operativeState[100].hp,hp);assert.equal(campaign.operativeState[100].bleeding,2);assert.equal(campaign.operativeState[100].bandaged,0);
 assert.deepEqual(serviceRow(campaign).incidents,[]);assert.deepEqual(serviceRow(campaign).effects,[]);assert.equal(civilianIncidents(npc(battle)).length,0);
 ({campaign,battle}=decodeSave(encodeSave(campaign,battle)));campaign=save(finish(campaign,battle));
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(serviceRow(campaign).transferredTo,100);
 assert.equal(campaign.operativeState[100].hp,hp);assert.equal(campaign.operativeState[100].bleeding,2);assert.equal(campaign.operativeState[100].bandaged,0);
 campaign=order(campaign,{type:'dismiss',id:100});campaign=save(campaign);campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(npc(battle),undefined);campaign=save(finish(campaign,battle));assert.equal(campaign.cityLoyaltyEvents.length,0);
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});assert.equal(campaign.operativeState[100].hp,hp);assert.equal(campaign.operativeState[100].bleeding,2);assert.equal(campaign.operativeState[100].bandaged,0);
});

test('first aid to an ordinary resident persists without a service record or health gain',()=>{
 let {campaign,battle}=paidVisit({sector:'retiro',target:'local-retiro'});wound(battle,{target:'local-retiro',source:'unknown'});
 const hp=npc(battle,'local-retiro').hp,treasury=campaign.resources.treasury;
 battle=act(battle,{type:'useItem',unitId:'112',targetId:'local-retiro',targetKind:'npc'});({campaign,battle}=sync(campaign,battle));({campaign,battle}=decodeSave(encodeSave(campaign,battle)));
 campaign=save(finish(campaign,battle));campaign=order(campaign,{type:'visitSector'});
 // Legacy deployments could omit their civilian roster. A saved injured
 // resident still owns its condition even without an attributed harm receipt.
 delete campaign.pendingBattle.npcs;battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 const resident=npc(battle,'local-retiro');assert.equal(resident.hp,hp);assert.equal(resident.bleeding,0);assert.equal(resident.bandaged,100-hp);assert.equal(resident.civilianWoundVersion,1);
 assert.equal(serviceRow(campaign,'local-retiro'),undefined);assert.equal(campaign.resources.treasury,treasury);assert.equal(campaign.cityLoyaltyEvents.length,0);
 assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
});

test('invalid civilian wound fields and missing canonical medical records reject at save and report boundaries',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{source:'unknown'});({campaign,battle}=sync(campaign,battle));
 const raw=JSON.parse(encodeSave(campaign,battle));
 for(const change of [n=>n.bleeding=-1,n=>n.bleeding=11,n=>n.bleeding=1.5,n=>n.bandaged=-1,n=>n.bandaged=21,n=>n.civilianWoundVersion=2,n=>delete n.civilianWoundVersion,n=>delete n.bleedSource,n=>n.bleedSource.intentional=true,n=>n.bleedSource.extra=true]){
  const bad=structuredClone(raw);change(npc(bad.battle));assert.throws(()=>decodeSave(JSON.stringify(bad)));
  const before=structuredClone(campaign),report=dispatchCampaign(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:bad.battle,survivors:bad.battle.units.filter(unit=>unit.side==='player')});assert.ok(report.lastError);assert.deepEqual(campaign,before);
 }
 const missing=structuredClone(raw);delete missing.campaign.civilianHarm;assert.throws(()=>decodeSave(JSON.stringify(missing)));
 const treated=aid(battle),treatedPair=sync(campaign,treated),downgraded=JSON.parse(encodeSave(treatedPair.campaign,treatedPair.battle));
 delete npc(downgraded.battle).civilianWoundVersion;assert.throws(()=>decodeSave(JSON.stringify(downgraded)),'a treated canonical wound cannot masquerade as a legacy record');
 campaign=finish(campaign,battle);const returned=JSON.parse(encodeSave(campaign));
 for(const change of [s=>delete s.civilianHarm,s=>s.civilianHarm.records={},s=>s.sectorStates.buenos_aires.npcs.find(n=>n.id==='sosa').bandaged=99]){const bad=structuredClone(returned);change(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
});

test('a delayed civilian death retains its real absent attacker across sector reentry exactly once',()=>{
 let {campaign,battle}=paidVisit();wound(battle,{damage:npc(battle).hp-4});({campaign,battle}=sync(campaign,battle));campaign=save(finish(campaign,battle));
 const loyalty=campaign.sectors.buenos_aires.loyalty;campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=order(campaign,{type:'squad',ids:[110]});campaign=order(campaign,{type:'visitSector'});
 battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);assert.equal(battle.units.some(unit=>unit.id==='112'),false);assert.equal(npc(battle).bleedSource.attackerId,'112');
 battle=act(battle,{type:'rest'});assert.equal(npc(battle).hp,0);assert.equal(npc(battle).bleeding,0);assert.equal(npc(battle).bleedSource,undefined);
 assert.equal(civilianIncidents(npc(battle)).at(-1).attackerId,'112');
 for(const change of [event=>event.attackerId='other-attacker',event=>event.intentional=false]){
  const bad=structuredClone(battle),before=structuredClone(campaign);change(civilianIncidents(npc(bad)).at(-1));assert.ok(syncBattleTime(campaign,bad).error);assert.deepEqual(campaign,before);
 }
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty-10);assert.equal(campaign.operativeState[100].alive,false);
 ({campaign,battle}=repeatSync(campaign,battle));({campaign,battle}=decodeSave(encodeSave(campaign,battle)));campaign=save(finish(campaign,battle));
 assert.equal(campaign.sectors.buenos_aires.loyalty,loyalty-10);assert.equal(serviceRow(campaign).incidents.length,2);
});

test('a pristine or legacy contact cannot heal a dismissed soldier during synchronization',()=>{
 let campaign=initialCampaign(8);campaign.sectors.buenos_aires.owner='patriot'; // Local-control checkpoint only.
 campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign=order(campaign,{type:'travel',sector:'buenos_aires'});campaign=order(campaign,{type:'visitSector'});
 const request=campaign.pendingBattle;
 // A soldier wound is the fixture input. The ordinary deployment report,
 // dismissal, civilian revisit and later paid rehire must preserve it.
 let battle=createBattle(request.squad.map((unit,index)=>({...unit,x:2,y:2+index,...(unit.id===100?{hp:60,bleeding:2,bandaged:3}:{})})),{...request,width:12,height:10,props:[],enemies:[],
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),npcs:request.npcs.map((resident,index)=>({...resident,x:8,y:5+index}))});
 campaign=save(finish(campaign,battle));const wounded=structuredClone(campaign.operativeState[100]);
 assert.equal(wounded.hp,60);assert.equal(wounded.bleeding,2);assert.equal(wounded.bandaged,3);
 campaign=order(campaign,{type:'dismiss',id:100});campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.ok(npc(battle));assert.equal(npc(battle).hp,60);assert.equal(npc(battle).civilianWoundVersion,1);assert.equal(npc(battle).bleeding,2);
 for(const legacy of [false,true]){
  const field=structuredClone(battle);if(legacy){delete npc(field).civilianWoundVersion;delete npc(field).bleeding;delete npc(field).bandaged;delete npc(field).bleedSource;}
  const synced=sync(campaign,field);assert.equal(synced.campaign.operativeState[100].hp,60);assert.equal(synced.campaign.operativeState[100].bleeding,2);assert.equal(synced.campaign.operativeState[100].bandaged,3);
  assert.equal(hasPendingCivilianHarm(synced.campaign,synced.battle),false);assert.deepEqual(decodeSave(encodeSave(synced.campaign,synced.battle)),{campaign:synced.campaign,battle:synced.battle});
 }
 ({campaign,battle}=sync(campaign,battle));campaign=save(finish(campaign,battle));campaign=order(campaign,{type:'recruitCivic',id:100,term:'week'});
 assert.equal(campaign.operativeState[100].hp,60);assert.equal(campaign.operativeState[100].bleeding,2);assert.equal(campaign.operativeState[100].bandaged,3);
});
