import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rosterFor} from '../game/campaign.js';
import {hasWorkshop} from '../game/campaign-headquarters.js';
import {assignMedicalCare,advanceMedicalCare,doctorRate,careAssignmentIssue} from '../game/medical-care.js';
import {assignWork,advanceAssignments,workAssignmentIssue} from '../game/assignments.js';

// Declared remote staff and wounds isolate work admission from travel/combat.
function remoteTeam(){
 const s=initialCampaign();s.location='salta';s.squads[0].location='salta';
 s.sectors.salta.owner='patriot';s.sectors.salta.loyalty=65;
 for(const id of s.recruited)s.operativeState[id].location='salta';
 assert.equal(hasWorkshop(s,'salta'),false);
 assert.equal(s.sectors.tucuman.owner,'royalist','the column has no friendly road to headquarters');
 return s;
}
const operative=(s,id)=>rosterFor(s).find(op=>op.id===id);
const noNetwork={isSupplied:()=>{throw Error('Strategic supply must not gate carried-item work.');}};

test('a qualified remote medic treats actual wounds with carried dressings and stops when they run out',()=>{
 const s=remoteTeam(),doctor=operative(s,10),patient=s.operativeState[3];
 Object.assign(patient,{hp:30,bleeding:2,bandaged:0});s.operativeState[10].medkits=2;
 const money=s.resources.treasury,ammo=s.operativeState[10].ammo;
 assignMedicalCare(s,doctor,'doctor');assignMedicalCare(s,operative(s,3),'patient');
 advanceMedicalCare(s,rosterFor(s),noNetwork);
 assert.equal(patient.bleeding,0);assert.equal(patient.hp,30);assert.equal(s.operativeState[10].medkits,1);
 advanceMedicalCare(s,rosterFor(s),noNetwork);
 assert.equal(patient.hp,30+doctorRate(doctor,s));assert.equal(s.operativeState[10].medkits,0);
 const hp=patient.hp;advanceMedicalCare(s,rosterFor(s),noNetwork);
 assert.equal(patient.hp,hp);assert.equal(careAssignmentIssue(s,doctor,'doctor').code,'no_medkits');
 assert.equal(s.operativeState[10].energy,94);assert.equal(s.operativeState[10].fatigue,4);
 assert.equal(s.resources.treasury,money);assert.equal(s.operativeState[10].ammo,ammo);
});

test('a qualified remote repairer uses finite carried tools without a workshop or supply route',()=>{
 const s=remoteTeam(),repairer=operative(s,10),target=s.operativeState[4];
 target.condition=40;s.operativeState[10].toolkitPoints=2;
 const money=s.resources.treasury,ammo=target.ammo,loaded=target.loaded;
 assignWork(s,repairer,{assignment:'repair',targetId:4},rosterFor(s));
 advanceAssignments(s,rosterFor(s),noNetwork);
 assert.equal(target.condition,42);assert.equal(s.operativeState[10].toolkitPoints,0);
 const before=structuredClone(s);advanceAssignments(s,rosterFor(s),noNetwork);assert.deepEqual(s,before);
 assert.equal(workAssignmentIssue(s,repairer,'repair',{},rosterFor(s)).code,'no_tools');
 assert.equal(s.operativeState[10].energy,97);assert.equal(s.operativeState[10].fatigue,2);
 assert.equal(s.resources.treasury,money);assert.equal(target.ammo,ammo);assert.equal(target.loaded,loaded);
});
