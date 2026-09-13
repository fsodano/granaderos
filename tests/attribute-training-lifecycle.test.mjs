import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {practice,validateTraining} from '../game/skill-training.js';
import {handRecord} from '../game/tactical-inventory.js';
import {STEAL_MIN_AP} from '../game/unarmed-combat.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';

const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const act=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;};
const hire=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});
const op=campaign=>rosterFor(campaign).find(u=>u.id===110);
const actor=battle=>battle.units.find(u=>u.id==='110');
const save=(campaign,battle)=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);return decodeSave(encodeSave(pair.campaign,pair.battle));};
const restore=campaign=>restoreCampaign(serializeCampaign(campaign));

function grabField(player={},enemy={}){
 let campaign=hire();
 // A veteran fixture one successful grab below the next earned point. The
 // contract, attack supply allocation, equipment transfer and exit are real.
 campaign.operativeState[110].skillPractice={dexterity:39};
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const request=campaign.pendingBattle,width=64,height=48;
 const battle=createBattle(request.squad.map(u=>({...u,x:31,y:0,facing:4,...player})),{...request,width,height,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),props:[],npcs:[],
  // Open boundary encounter: preserve every issued enemy identity, weapon and
  // cartridge; give the adjacent defender a weak grip to make seed45 succeed.
  enemies:request.enemies.map((u,i)=>({...u,x:i?50:31,y:i?35+i:1,facing:4,strength:1,dexterity:1,agility:1,experienceLevel:1,overwatch:false,patrol:false,...(i?{}:enemy)})),seed:45});
 for(const unit of battle.units.filter(u=>u.side==='enemy'))unit.ap=0;
 return {campaign,battle,targetId:battle.units.find(u=>u.side==='enemy').id};
}
const freeHands=battle=>act(battle,{type:'weapon',unitId:'110',slot:'unarmed'});
const grab=(battle,targetId)=>act(battle,{type:'steal',unitId:'110',targetId});

test('a successful ordinary-skill grab earns dexterity and survives full save, paid retreat and sector reentry exactly once',()=>{
 let {campaign,battle,targetId}=grabField();const baseline=op(campaign).dexterity,treasury=campaign.resources.treasury;
 assert.ok(baseline>0&&baseline<100,'the old dexterity100 fixture skipped the practice path');
 const target=battle.units.find(u=>u.id===targetId),taken=handRecord(target,'primary'),reserve=actor(battle).ammo;
 battle=freeHands(battle);const energy=actor(battle).energy;battle=grab(battle,targetId);
 assert.equal(actor(battle).dexterity,baseline+1);assert.equal(actor(battle).trainedStats.dexterity,1);assert.equal(actor(battle).skillPractice.dexterity,0);
 assert.deepEqual(handRecord(actor(battle),'primary'),taken);assert.equal(actor(battle).ammo,reserve);assert.equal(actor(battle).ap,0);assert.equal(actor(battle).energy,energy-8);assert.equal(battle.units.find(u=>u.id===targetId).weaponDropped,true);
 assert.doesNotThrow(()=>validateBattleSnapshot(battle));({campaign,battle}=save(campaign,battle));assert.equal(campaign.resources.treasury,treasury);
 const beforeTurn=battle.turn;battle=endTurn(battle);assert.equal(battle.lastError,null);assert.equal(battle.phase,'player');assert.equal(battle.turn,beforeTurn+1);assert.equal(battle.elapsedSeconds,6);assert.ok(actor(battle).ap>0);
 const beforeExit=actor(battle).ap;battle=act(battle,{type:'exit',unitIds:['110'],exitId:battle.exits.find(e=>e.destination==='retiro').id});assert.equal(battle.status,'retreat');assert.ok(actor(battle).ap<beforeExit);
 campaign=order(campaign,{type:'battleResult',battleId:campaign.pendingBattle.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.location,'retiro');assert.equal(op(campaign).dexterity,baseline+1);assert.equal(campaign.operativeState[110].trainedStats.dexterity,1);assert.equal(campaign.operativeState[110].skillPractice.dexterity,0);
 campaign=restore(campaign);campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 assert.equal(actor(pair.battle).dexterity,baseline+1);assert.equal(actor(pair.battle).trainedStats.dexterity,1);assert.equal(actor(pair.battle).weapon,taken.weapon);save(pair.campaign,pair.battle);
});

test('invalid and failed grabs do not award dexterity and an empty target cannot be farmed',()=>{
 const field=grabField(),badHand=actBattle(field.battle,{type:'steal',unitId:'110',targetId:field.targetId});assert.ok(badHand.lastError);assert.deepEqual(badHand.units,field.battle.units);assert.equal(badHand.seed,field.battle.seed);
 const short=freeHands(field.battle);actor(short).ap=STEAL_MIN_AP-1;const rejected=actBattle(short,{type:'steal',unitId:'110',targetId:field.targetId});assert.ok(rejected.lastError);assert.deepEqual(rejected.units,short.units);assert.equal(rejected.elapsedSeconds,short.elapsedSeconds);
 const weak=grabField({strength:1,dexterity:1,agility:40,experienceLevel:1},{strength:100,dexterity:100,agility:100,experienceLevel:10});let attempt=freeHands(weak.battle);const previous=structuredClone(actor(attempt).skillPractice),oldWeapon=actor(attempt).weapon;
 attempt=grab(attempt,weak.targetId);assert.match(attempt.log.at(-1),/no logra/);assert.equal(actor(attempt).ap,0);assert.equal(actor(attempt).weapon,oldWeapon);assert.deepEqual(actor(attempt).skillPractice,previous);assert.equal(actor(attempt).trainedStats?.dexterity??0,0);
 const noBackup=grabField({}, {blade:0});let success=grab(freeHands(noBackup.battle),noBackup.targetId);success=endTurn(success);success=freeHands(success);const progress=structuredClone(actor(success).skillPractice),earned=structuredClone(actor(success).trainedStats);
 const repeated=actBattle(success,{type:'steal',unitId:'110',targetId:noBackup.targetId});assert.ok(repeated.lastError);assert.deepEqual(actor(repeated).skillPractice,progress);assert.deepEqual(actor(repeated).trainedStats,earned);assert.deepEqual(repeated.units,success.units);
});

test('zero aptitude, dead actors, enemies, empty credit and capped skills produce no practice records',()=>{
 for(const skill of ['medical','mechanical','explosives']){const unit={side:'player',hp:80,[skill]:0},before=structuredClone(unit);assert.equal(practice(unit,skill,40),0);assert.deepEqual(unit,before);}
 for(const unit of [{side:'player',hp:0,maxHp:80},{side:'enemy',hp:80,maxHp:80},{side:'player',hp:80,maxHp:100},{side:'player',hp:80,maxHp:90,trainedStats:{maxHp:10},skillPractice:{maxHp:39}}]){const before=structuredClone(unit);assert.equal(practice(unit,'maxHp',40),0);assert.deepEqual(unit,before);}
 const idle={side:'player',hp:80,dexterity:60},before=structuredClone(idle);assert.equal(practice(idle,'dexterity',0),0);assert.deepEqual(idle,before);
 for(const [skill,amount]of [['treasury',40],['dexterity',-1],['dexterity',.5],['dexterity',Infinity]]){assert.throws(()=>practice(idle,skill,amount));assert.deepEqual(idle,before);}
});

for(const skill of ['strength','dexterity','leadership','explosives','maxHp'])test(`${skill} study spends a real hour, preserves its earned point through a complete visit and does not apply it twice`,()=>{
 let campaign=hire(),baseline=op(campaign)[skill];campaign=order(campaign,{type:'assignWork',operativeId:110,assignment:'practice',skill});
 // Existing practice from prior hours; this hour must consume energy and
 // fractional study credit before the final point is earned.
 Object.assign(campaign.operativeState[110],{skillPractice:{[skill]:39},trainingCredit:999});
 if(skill==='maxHp'){campaign.operativeState[110].hp-=5;campaign.operativeState[110].bandaged=5;}
 campaign=restore(campaign);const before=structuredClone(campaign),recordBefore=before.operativeState[110];campaign=order(campaign,{type:'wait',hours:1});
 assert.equal(campaign.hour,before.hour+1);assert.ok(campaign.operativeState[110].energy<recordBefore.energy);assert.equal(campaign.resources.treasury,before.resources.treasury);assert.equal(op(campaign)[skill],baseline+1);assert.equal(campaign.operativeState[110].trainedStats[skill],1);
 if(skill==='maxHp'){assert.equal(campaign.operativeState[110].maxHp,baseline+1);assert.equal(campaign.operativeState[110].hp,recordBefore.hp+1);assert.equal(campaign.operativeState[110].maxHp-campaign.operativeState[110].hp,5);assert.equal(campaign.operativeState[110].bandaged,5);}
 if(skill==='strength')assert.equal(campaign.operativeState[110].strength,baseline+1);
 campaign=restore(campaign);assert.equal(op(campaign)[skill],baseline+1);campaign=order(campaign,{type:'assignCare',operativeId:110,assignment:'active'});campaign=order(campaign,{type:'visitSector'});
 let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);pair=save(pair.campaign,pair.battle);assert.equal(actor(pair.battle)[skill],baseline+1);
 campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});campaign=restore(campaign);assert.equal(op(campaign)[skill],baseline+1);assert.equal(campaign.operativeState[110].trainedStats[skill],1);
 campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(actor(pair.battle)[skill],baseline+1);save(pair.campaign,pair.battle);
});

test('new strength study adds to a legacy carried-load gain without double-counting either source',()=>{
 let campaign=hire();const authored=op(campaign).strength;campaign.operativeState[110].strength=authored+4;assert.equal(op(campaign).strength,authored+4);
 campaign=order(campaign,{type:'assignWork',operativeId:110,assignment:'practice',skill:'strength'});Object.assign(campaign.operativeState[110],{skillPractice:{strength:39},trainingCredit:999});campaign=order(campaign,{type:'wait',hours:1});
 assert.equal(op(campaign).strength,authored+5);assert.equal(campaign.operativeState[110].strength,authored+5);assert.equal(campaign.operativeState[110].trainedStats.strength,1);campaign=restore(campaign);assert.equal(op(campaign).strength,authored+5);
 campaign=order(campaign,{type:'assignCare',operativeId:110,assignment:'active'});campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(actor(pair.battle).strength,authored+5);
});

test('strength study and a real XP level increase agree on visit, attack and defense after save and deployment',()=>{
 let campaign=hire();const baseline=op(campaign).strength;
 // Veteran fixture: the next ordinary retreat crosses the level threshold.
 campaign.operativeState[110].xp=95;
 campaign=order(campaign,{type:'assignWork',operativeId:110,assignment:'practice',skill:'strength'});
 Object.assign(campaign.operativeState[110],{skillPractice:{strength:39},trainingCredit:999});
 campaign=order(campaign,{type:'wait',hours:1});campaign=order(campaign,{type:'assignCare',operativeId:110,assignment:'active'});
 assert.equal(op(campaign).strength,baseline+1);assert.equal(campaign.operativeState[110].strength,baseline+1);
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const request=campaign.pendingBattle,width=64,height=48;
 // An open arrival boundary preserves the actual issued force and ammunition
 // while permitting a paid withdrawal without fabricating a battle result.
 let battle=createBattle(request.squad.map(u=>({...u,x:31,y:0,facing:4})),{...request,width,height,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),props:[],npcs:[],
  enemies:request.enemies.map((u,i)=>({...u,x:50,y:35+i,overwatch:false,patrol:false}))});
 const ap=actor(battle).ap;battle=act(battle,{type:'exit',unitIds:['110'],exitId:battle.exits.find(e=>e.destination==='retiro').id});
 assert.ok(actor(battle).ap<ap);assert.equal(battle.status,'retreat');
 campaign=order(campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(op(campaign).xp,105);assert.equal(op(campaign).level,2);assert.equal(op(campaign).strength,baseline+3);assert.equal(campaign.operativeState[110].trainedStats.strength,1);
 // The old actual value remains a legitimate saved legacy floor, not the
 // authority for a newly computed level bonus.
 assert.equal(campaign.operativeState[110].strength,baseline+1);campaign=restore(campaign);
 for(const path of ['visit','attack','defense']){
  let next=restore(campaign);
  if(path==='defense'){
   const group=launchEnemyGroup(next,'coast','retiro',{immediate:true});assert.ok(group);
   next=order(next,{type:'wait',hours:1});assert.equal(next.pendingEncounter.groupId,group.id);
   next=order(next,{type:'respondToEncounter',groupId:group.id,choice:'tactical'});
  }else next=order(next,path==='visit'?{type:'visitSector'}:{type:'attack',sector:'buenos_aires'});
  assert.equal(next.pendingBattle.squad.find(u=>u.id===110).strength,baseline+3,`${path} request`);
  next=restore(next);let pair=prepareCampaignBattle(next);assert.equal(pair.error,null,pair.error);
  assert.equal(actor(pair.battle).strength,baseline+3,`${path} actual deployment`);pair=save(pair.campaign,pair.battle);
  assert.equal(actor(pair.battle).strength,baseline+3,`${path} saved battle`);assert.equal(actor(pair.battle).trainedStats.strength,1);
 }
});

test('a field health gain passes the medical return boundary without healing its existing wound deficit',()=>{
 let campaign=hire();campaign.operativeState[110].hp-=5;campaign.operativeState[110].bandaged=5;campaign=order(campaign,{type:'visitSector'});
 let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);const unit=actor(pair.battle),maximum=unit.maxHp,health=unit.hp;
 // Isolated credit fixture for the shared field-practice/return boundary;
 // this does not claim that an idle visit itself earns health practice.
 assert.equal(practice(unit,'maxHp',40),1);assert.equal(unit.maxHp,maximum+1);assert.equal(unit.hp,health+1);assert.equal(unit.maxHp-unit.hp,5);assert.equal(unit.bandaged,5);
 pair=save(pair.campaign,pair.battle);campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});campaign=restore(campaign);
 assert.equal(op(campaign).maxHp,maximum+1);assert.equal(campaign.operativeState[110].maxHp,maximum+1);assert.equal(campaign.operativeState[110].hp,health+1);assert.equal(campaign.operativeState[110].bandaged,5);
 campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(actor(pair.battle).maxHp,maximum+1);assert.equal(actor(pair.battle).hp,health+1);save(pair.campaign,pair.battle);
});

test('new attribute records retain the ten-point cap and reject values that could bypass it',()=>{
 for(const skill of ['strength','dexterity','leadership','explosives','maxHp']){
  const unit={side:'player',hp:70,[skill]:80,trainedStats:{[skill]:9},skillPractice:{[skill]:39}};assert.equal(practice(unit,skill,81),1);assert.equal(unit[skill],81);assert.equal(unit.trainedStats[skill],10);assert.doesNotThrow(()=>validateTraining(unit));const before=structuredClone(unit);assert.equal(practice(unit,skill,40),0);assert.deepEqual(unit,before);
  assert.throws(()=>validateTraining({trainedStats:{[skill]:11}}));assert.throws(()=>validateTraining({skillPractice:{[skill]:40}}));
 }
});
