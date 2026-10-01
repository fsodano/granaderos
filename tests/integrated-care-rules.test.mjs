import test from 'node:test';
import assert from 'node:assert/strict';
import {assignMedicalCare,advanceMedicalCare,advanceMilitaryWounds,careAssignmentReason,validateMedicalCare,migrateMedicalCare} from '../game/medical-care.js';
import {prepareGarrison,materializeGarrisonRank,returnGarrison,validGarrisons,advanceMilitiaWounds} from '../game/garrison.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {maximumEnergy} from '../game/fatigue.js';
const doctor={id:901,name:'Médico',maxHp:80,medical:40},patient={id:902,name:'Paciente',maxHp:80,medical:0};
function fixture(rules={}){
 const s={hour:10,location:'retiro',recruited:[901,902],squad:[901,902],operativeState:{901:{alive:true,hp:80,energy:100,medkits:3,fatigue:0},902:{alive:true,hp:40,bleeding:4,energy:60,fatigue:20}},sectors:{retiro:{owner:'patriot',militia:[0,0,0]},buenos_aires:{owner:'patriot',militia:[0,0,0]}},militiaTraining:[],garrisons:{},nextMilitiaId:20000,resources:{treasury:500},log:[],contentCampaign:{package:{careRules:{...DEFAULT_CARE_RULES,...rules}}}};
 migrateMedicalCare(s,[doctor,patient]);return s;
}

test('configured care uses one physical dressing per hour and the separate wound pass cannot charge a treated wound',()=>{
 const s=fixture({minimumSkill:40,baseHealing:5,skillStep:40,energyCost:7,fatigueCost:9});
 assignMedicalCare(s,doctor,'doctor');assignMedicalCare(s,patient,'patient');
 advanceMedicalCare(s,[doctor,patient]);assert.equal(s.operativeState[902].bleeding,0);assert.equal(s.operativeState[902].hp,40);
 assert.deepEqual(advanceMilitaryWounds(s,[doctor,patient]),[]);assert.equal(s.operativeState[902].hp,40);
 advanceMedicalCare(s,[doctor,patient]);assert.equal(s.operativeState[902].hp,46);assert.equal(s.operativeState[901].medkits,1);assert.equal(s.operativeState[901].fatigue,18);
 assert.ok(s.operativeState[901].energy<=maximumEnergy(s.operativeState[901]));validateMedicalCare(s,[doctor,patient]);
 const blocked=fixture({minimumSkill:41});assert.match(careAssignmentReason(blocked,doctor,'doctor'),/41/);
});

test('configured wounds affect unloaded personnel once, exempt deployed and captured people, and zero damage remains zero',()=>{
 const s=fixture({bleedingDamagePercent:50});advanceMedicalCare(s,[doctor,patient]);assert.equal(s.operativeState[902].hp,40);
 advanceMilitaryWounds(s,[doctor,patient]);assert.equal(s.operativeState[902].hp,38);
 s.pendingBattle={sector:'retiro',squad:[{id:902}]};advanceMilitaryWounds(s,[doctor,patient]);assert.equal(s.operativeState[902].hp,38);
 delete s.pendingBattle;s.operativeState[902].captured=true;advanceMilitaryWounds(s,[doctor,patient]);assert.equal(s.operativeState[902].hp,38);
 const zero=fixture({bleedingDamagePercent:0});advanceMilitaryWounds(zero,[doctor,patient]);assert.equal(zero.operativeState[902].hp,40);
});

test('rest preserves a configured long interval across serialization and respects permanent injury and the breath limit',()=>{
 const s=fixture({restHealingHours:9,restEnergy:0,restFatigue:0});Object.assign(s.operativeState[902],{bleeding:0,maxHp:50,bandaged:10});
 assignMedicalCare(s,patient,'rest');for(let i=0;i<8;i++)advanceMedicalCare(s,[doctor,patient]);validateMedicalCare(s,[doctor,patient]);
 const restored=JSON.parse(JSON.stringify(s));advanceMedicalCare(restored,[doctor,patient]);assert.equal(restored.operativeState[902].hp,41);assert.equal(restored.operativeState[902].recoveryHours,0);assert.equal(restored.operativeState[902].energy,60);
 Object.assign(restored.operativeState[902],{hp:50,bandaged:0});for(let i=0;i<9;i++)advanceMedicalCare(restored,[doctor,patient]);assert.equal(restored.operativeState[902].hp,50);
 assert.match(careAssignmentReason({...s,squads:[{members:[901],location:'retiro',journey:{status:'moving'}}]},doctor,'doctor'),/camino/);
});

test('paid militia retain authored arms and physical rounds, including reserves beyond the field limit',()=>{
 const s=fixture();s.sectors.retiro.militia=[61,0,0];s.contentCampaign.package.rules={militiaCartridges:8};
 const w={id:'militia-rifle',template:1804,name:'Fusil de milicia',damage:25,fireAP:20,aimAP:2,readyAP:4,reloadAP:30,range:20,capacity:3,weight:2,price:30,art:'/art/test.png',ammunitionFamily:'ammoRifle'};
 s.contentCampaign.package.weapons=[w];s.contentCampaign.package.militiaEquipment={green:w.id,regular:null,veteran:null};
 materializeGarrisonRank(s,'retiro',0,61);const ids=s.garrisons.retiro.map(u=>u.id),soldier=s.garrisons.retiro[0];
 assert.deepEqual(soldier.weaponMetadata.contentWeapon,compileWeaponDefinition(w));assert.equal(soldier.loaded,3);assert.equal(ammunitionByType(soldier).rifle_62,5);
 const deployed=prepareGarrison(s,'retiro');assert.equal(deployed.length,60);assert.deepEqual(s.garrisons.retiro.map(u=>u.id),ids);assert.equal(validGarrisons(s),true);
 assert.deepEqual(s.resources,{treasury:500});
});

test('a departing militia member keeps identity and wounds and is counted only at the arrival sector',()=>{
 const s=fixture();s.sectors.retiro.militia=[1,0,0];const [issued]=prepareGarrison(s,'retiro');
 const actual={...structuredClone(issued),id:String(issued.id),side:'player',hp:50,bleeding:2,departure:{},militiaArrival:{from:'buenos_aires',to:'retiro'}};
 returnGarrison(s,{sector:'retiro',garrison:[issued]},{units:[actual]},[{unitId:String(issued.id),kind:'departed',sector:'buenos_aires',departure:{entryEdge:'N',entryAnchor:{x:4,y:0}}}]);
 assert.equal(s.garrisons.retiro.length,0);assert.equal(s.sectors.retiro.militia[0],0);assert.equal(s.sectors.buenos_aires.militia[0],1);
 assert.equal(s.garrisons.buenos_aires[0].id,issued.id);assert.equal(s.garrisons.buenos_aires[0].hp,50);assert.equal(validGarrisons(s),true);
 advanceMilitiaWounds(s);assert.equal(s.garrisons.buenos_aires[0].hp,49);
});


test('automatic sleep and explicit rest each recover breath once per campaign hour',async()=>{
 const {finishSleepHour}=await import('../game/sleep.js');
 for(const assignment of ['active','rest']){
  const s=fixture();Object.assign(s.operativeState[901],{assignment,asleep:true,energy:20,fatigue:40});
  advanceMedicalCare(s,[doctor,patient]);finishSleepHour(s,[doctor,patient]);
  assert.equal(s.operativeState[901].energy,32);assert.equal(s.operativeState[901].fatigue,32);
 }
});
