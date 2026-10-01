import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign,OPERATIVES} from '../game/campaign.js';
import {advanceAssignments,studyRate,repairRate,TOOLKIT_PRICE,TOOLKIT_POINTS,workStatus} from '../game/assignments.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const next=dispatch(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const job=(s,id,assignment,extra={})=>order(s,{type:'assignWork',operativeId:id,assignment,...extra});
const studentTeam=()=>{let s=initialCampaign();s=job(s,10,'instructor',{skill:'mechanical'});return job(s,3,'student',{skill:'mechanical',instructorId:10});};
const repairTeam=()=>{let s=initialCampaign();s.operativeState[4].condition=40;s=order(s,{type:'purchaseToolkits',operativeId:10});return job(s,10,'repair',{targetId:4});};

test('self-practice requires real hours, advances earned stats and keeps authored profiles unchanged',()=>{
 const authored=JSON.stringify(OPERATIVES);let s=job(initialCampaign(),3,'practice',{skill:'mechanical'});const base=rosterFor(s).find(o=>o.id===3).mechanical;
 assert.equal(s.operativeState[3].trainedStats?.mechanical??0,0);s=order(s,{type:'wait',hours:22});assert.equal(s.operativeState[3].trainedStats.mechanical,1);assert.equal(rosterFor(s).find(o=>o.id===3).mechanical,base+1);assert.equal(JSON.stringify(OPERATIVES),authored);assert.ok(s.operativeState[3].energy<100);
});

test('a paired better instructor teaches faster and both staff spend the working hour',()=>{
 let paired=studentTeam(),solo=job(initialCampaign(),3,'practice',{skill:'mechanical'});
 paired=order(paired,{type:'wait',hours:8});solo=order(solo,{type:'wait',hours:8});assert.ok(paired.operativeState[3].skillPractice.mechanical>solo.operativeState[3].skillPractice.mechanical);assert.equal(paired.operativeState[10].energy,76);assert.equal(paired.operativeState[3].energy,76);
 assert.ok(studyRate({mechanical:40,wisdom:90},'mechanical')>studyRate({mechanical:40,wisdom:40},'mechanical'));assert.ok(studyRate({mechanical:75,wisdom:70},'mechanical')<studyRate({mechanical:40,wisdom:70},'mechanical'));
});

test('student pairing rejects wrong skill, weaker teacher and an occupied instructor',()=>{
 let s=studentTeam();assert.ok(dispatch(s,{type:'assignWork',operativeId:4,assignment:'student',skill:'mechanical',instructorId:10}).lastError);assert.ok(dispatch(s,{type:'assignWork',operativeId:4,assignment:'student',skill:'marksmanship',instructorId:10}).lastError);
 s=job(initialCampaign(),3,'instructor',{skill:'marksmanship'});assert.ok(dispatch(s,{type:'assignWork',operativeId:4,assignment:'student',skill:'marksmanship',instructorId:3}).lastError);
});

test('separation, reassignment and exhausted staff pause paired practice',()=>{
 let s=studentTeam();s=order(s,{type:'assignCare',operativeId:10,assignment:'rest'});s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[3].skillPractice?.mechanical??0,0);
 s=studentTeam();s=order(s,{type:'createSquad',name:'Otra escuadra',ids:[10]});s=order(s,{type:'assignCare',operativeId:10,assignment:'active'});s=order(s,{type:'travel',sector:'ensenada'});s=job(s,10,'instructor',{skill:'mechanical'});s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[3].skillPractice?.mechanical??0,0);assert.match(workStatus(s,rosterFor(s).find(o=>o.id===3),rosterFor(s)),/mismo sector/);
 s=studentTeam();s.operativeState[10].energy=10;s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[3].skillPractice?.mechanical??0,0);
});

test('zero skills and capped growth cannot be improved through strategic practice',()=>{
 let s=initialCampaign();assert.ok(dispatch(s,{type:'assignWork',operativeId:3,assignment:'practice',skill:'stealth'}).lastError);assert.ok(dispatch(s,{type:'assignWork',operativeId:3,assignment:'practice',skill:'treasury'}).lastError);
 s.operativeState[3].trainedStats={mechanical:10};assert.ok(dispatch(s,{type:'assignWork',operativeId:3,assignment:'practice',skill:'mechanical'}).lastError);
 s=job(initialCampaign(),3,'practice',{skill:'mechanical'});s.operativeState[3].trainedStats={mechanical:9};s.operativeState[3].skillPractice={mechanical:39};s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[3].trainedStats.mechanical,10);
});

test('repair restores the actual equipped gun over hours with finite paid toolkit points',()=>{
 let s=repairTeam();const rate=repairRate(rosterFor(s).find(o=>o.id===10));assert.equal(s.resources.treasury,3200-TOOLKIT_PRICE);assert.equal(s.operativeState[10].toolkitPoints,TOOLKIT_POINTS);assert.equal(s.operativeState[4].condition,40);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[4].condition,40+rate);assert.equal(s.operativeState[10].toolkitPoints,TOOLKIT_POINTS-rate);assert.equal(s.operativeState[10].skillPractice.mechanical,1);
 s=order(s,{type:'wait',hours:20});assert.equal(s.operativeState[4].condition,100);assert.equal(s.operativeState[10].toolkitPoints,40);const after=structuredClone(s.operativeState);s=order(s,{type:'wait',hours:1});assert.deepEqual(s.operativeState,after);
});

test('repair stops when tools run out, the target leaves, or its equipped gun changes',()=>{
 let s=repairTeam();s.operativeState[10].toolkitPoints=2;s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[4].condition,42);assert.equal(s.operativeState[10].toolkitPoints,0);
 s=repairTeam();s=order(s,{type:'purchaseEquipment',item:1803});s=order(s,{type:'equip',operativeId:4,slot:'weapon',itemId:1803});const tools=s.operativeState[10].toolkitPoints;s=order(s,{type:'wait',hours:4});assert.equal(s.operativeState[4].condition,100);assert.ok(s.armoryItems.some(item=>item.item===1808&&item.condition===40));assert.equal(s.operativeState[10].toolkitPoints,tools);assert.match(workStatus(s,rosterFor(s).find(o=>o.id===10),rosterFor(s)),/ya no está equipada/);
 s=repairTeam();s=order(s,{type:'createSquad',name:'Otra escuadra',ids:[4]});s=order(s,{type:'travel',sector:'ensenada'});assert.equal(s.operativeState[4].condition,40);
});

test('work excludes movement, militia and simultaneous medical recovery',()=>{
 let s=job(initialCampaign(),3,'practice',{skill:'medical'});s.operativeState[3].hp=40;assert.ok(dispatch(s,{type:'travel',sector:'ensenada'}).lastError);assert.ok(dispatch(s,{type:'visitSector'}).lastError);s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[3].hp,40);
 s=repairTeam();s=order(s,{type:'assignCare',operativeId:10,assignment:'rest'});s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[4].condition,40);
 s=studentTeam();const before=structuredClone(s.operativeState);advanceAssignments(s,rosterFor(s),{traveling:[3,10]});assert.deepEqual(s.operativeState,before);
 s=order(initialCampaign(),{type:'visitSector'});assert.ok(dispatch(s,{type:'assignWork',operativeId:3,assignment:'practice',skill:'medical'}).lastError);
 s=initialCampaign();s.militiaTraining=[{trainerId:3,sector:'retiro',rank:0,count:3,duration:8,remaining:8,started:0}];assert.ok(dispatch(s,{type:'assignWork',operativeId:3,assignment:'practice',skill:'medical'}).lastError);
});

test('toolkits are finite, local workshop purchases and are preserved through deployment reports',()=>{
 let s=order(initialCampaign(),{type:'purchaseToolkits',operativeId:10});s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===10).toolkitPoints,TOOLKIT_POINTS);const b=enterSector(s.pendingBattle);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.operativeState[10].toolkitPoints,TOOLKIT_POINTS);s=order(s,{type:'travel',sector:'ensenada'});assert.ok(dispatch(s,{type:'purchaseToolkits',operativeId:10}).lastError);
});

test('saved paired training and repair resume without granting duplicate practice or tools',()=>{
 for(let s of [studentTeam(),repairTeam()]){s=order(s,{type:'wait',hours:3});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);assert.deepEqual(order(restoreCampaign(serializeCampaign(s)),{type:'wait',hours:3}),order(s,{type:'wait',hours:3}));}
 const old=initialCampaign();for(const r of Object.values(old.operativeState)){delete r.trainingCredit;delete r.toolkitPoints;}const restored=restoreCampaign(serializeCampaign(old));assert.equal(restored.operativeState[10].toolkitPoints,0);assert.equal(restored.operativeState[3].trainingCredit,0);
});

test('malformed work data, zero-skill forged training and duplicate pairings reject',()=>{
 for(const [key,value] of [['toolkitPoints',-1],['toolkitPoints',1.5],['toolkitPoints',null],['trainingCredit',1000],['trainingSkill','money'],['instructorId',9999],['repairTargetId',9999],['repairWeaponId',1809]]){const s=initialCampaign();s.operativeState[3][key]=value;assert.throws(()=>restoreCampaign(serializeCampaign(s)),key);}
 let s=initialCampaign();Object.assign(s.operativeState[3],{assignment:'practice',trainingSkill:'stealth'});assert.throws(()=>restoreCampaign(serializeCampaign(s)));
 s=studentTeam();Object.assign(s.operativeState[4],{assignment:'student',trainingSkill:'mechanical',instructorId:10});assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});
