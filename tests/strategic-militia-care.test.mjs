import {restForMarch} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {militiaCarePatients} from '../game/garrison.js';
import {careStatus} from '../game/medical-care.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,visit,tactical,leave} from './local-contract-fixture.mjs';
import {stageFiniteDressings,collectFiniteDressings} from './care-supply-source.mjs';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import {woundedGarrison,MILITIA_DOCTOR as D,SECOND_MILITIA_DOCTOR as D2} from './militia-care-fixture.mjs';
const patient=(s,id)=>s.garrisons.retiro.find(u=>u.id===id);
const doctor=s=>rosterFor(s).find(o=>o.id===D);

test('a paid local militia doctor stops a real wound and restores the same soldier with finite dressings across saves and reentry',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({medicalKits:12});s=stageFiniteDressings(s,D,10);const before=structuredClone(patient(s,id)),ids=s.garrisons.retiro.map(u=>u.id),counts=[...s.sectors.retiro.militia];s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).bleeding,0);assert.equal(patient(s,id).hp,before.hp);assert.equal(s.operativeState[D].medkits,1);assert.equal(s.operativeState[D].energy,97);assert.equal(s.operativeState[D].fatigue,2);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(patient(s,id).hp,Math.min(before.maxHp,before.hp+6));assert.equal(s.operativeState[D].medkits,0);const hp=patient(s,id).hp;s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).hp,hp);
 const money=s.resources.treasury;s=collectFiniteDressings(s,D,10);assert.equal(s.resources.treasury,money);s=order(s,{type:'wait',hours:Math.ceil((before.maxHp-hp)/6)});assert.equal(patient(s,id).hp,before.maxHp);const stock=s.operativeState[D].medkits;s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[D].medkits,stock);assert.match(careStatus(s,doctor(s),rosterFor(s)),/Sin milicianos heridos/);
 assert.deepEqual(s.garrisons.retiro.map(u=>u.id),ids);assert.deepEqual(s.sectors.retiro.militia,counts);for(const key of ['ammo','loaded','priming','flints','medkits','torches','inventory','weapon','blade'])assert.deepEqual(patient(s,id)[key],before[key],key);
 s=order(saved({campaign:s}).campaign,{type:'assignCare',id:D,assignment:'active'});const p=visit(s),field=p.battle.units.find(u=>Number(u.id)===id);assert.equal(field.hp,before.maxHp);assert.equal(field.bleeding,0);assert.equal(field.unconscious,false);assert.ok(field.ap>0);assert.deepEqual(p.campaign.pendingBattle.garrison.map(u=>u.id),ids);assert.ok(saved({campaign:leave(p)}));
});

test('two militia doctors cannot spend two dressings on one patient in the same hour and use authored care costs',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({twoDoctors:true,careRules:{...DEFAULT_CARE_RULES,baseHealing:5,skillStep:40,energyCost:7,fatigueCost:9,dressingPrice:17}});const hp=patient(s,id).hp,energy=s.operativeState[D].energy,fatigue=s.operativeState[D].fatigue;
 for(const id of [D,D2])s=order(s,{type:'assignCare',id,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[D].medkits+s.operativeState[D2].medkits,3);assert.equal(s.operativeState[D].energy,Math.min(energy-7,Math.max(10,100-fatigue-9)));assert.equal(s.operativeState[D].fatigue,fatigue+9);assert.equal(s.operativeState[D2].energy??100,100);assert.equal(patient(s,id).hp,hp);
 s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).hp,Math.min(patient(s,id).maxHp,hp+7));assert.equal(s.operativeState[D2].medkits,2);const money=s.resources.treasury;assertTradeRejected(s,{type:'purchaseMedicalSupplies',id:D,quantity:2});assert.equal(s.resources.treasury,money);assert.ok(saved({campaign:s}));
});

test('militia medical work requires the exact location and blocks deployment or simultaneous training',()=>{
 let {campaign:s,patientId:id}=woundedGarrison();s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});
 for(const action of [{type:'visitSector'},{type:'travel',sector:'buenos_aires'},{type:'militia',trainerId:D,rank:0}])assert.match(dispatchCampaign(s,action).lastError,/servicio/);
 s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).bleeding,0);
 s=order(s,{type:'assignCare',id:D,assignment:'active'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});const stock=s.operativeState[D].medkits,hp=patient(s,id).hp;s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[D].medkits,stock);assert.equal(patient(s,id).hp,hp);assert.deepEqual(militiaCarePatients(s,'buenos_aires'),[]);assert.match(careStatus(s,doctor(s),rosterFor(s)),/Sin milicianos heridos/);assert.ok(saved({campaign:s}));
 s=order(s,{type:'assignCare',id:D,assignment:'active'});s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'createSquad',name:'Patrulla de Isabel',ids:[1000]});s=order(s,{type:'selectSquad',id:s.squads.find(q=>q.members.includes(1000)).id});s=order(restForMarch(s),{type:'travel',sector:'buenos_aires'});assert.equal(patient(s,id).hp,Math.min(patient(s,id).maxHp,hp+6),'the remaining dressing heals the soldier after earlier local stabilization');assert.equal(s.operativeState[D].medkits,0);assert.ok(saved({campaign:s}));
});

test('a deployed garrison owns its tactical wounds and receives no remote medical duplication',()=>{
 let {campaign:s,patientId:id}=woundedGarrison();s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'createSquad',name:'Isabel en el campo',ids:[1000]});let p=visit(s),hp=patient(p.campaign,id).hp,stock=p.campaign.operativeState[D].medkits,start=p.campaign.hour;
 while(p.campaign.hour===start)p=tactical(p,{type:'rest',seconds:600});assert.equal(patient(p.campaign,id).hp,hp);assert.equal(p.campaign.operativeState[D].medkits,stock);assert.equal(p.battle.units.find(u=>Number(u.id)===id).hp,0);s=leave(p);assert.equal(patient(s,id),undefined);assert.equal(s.sectors.retiro.militia[0],2);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[D].medkits,stock);assert.ok(saved({campaign:s}));
});

test('real militia casualties cannot become patients or return as healed reinforcements',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({casualty:true});assert.equal(patient(s,id),undefined);const counts=[...s.sectors.retiro.militia],stock=s.operativeState[D].medkits;s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[D].medkits,stock);assert.deepEqual(s.sectors.retiro.militia,counts);s=order(saved({campaign:s}).campaign,{type:'assignCare',id:D,assignment:'active'});const p=visit(s);assert.equal(p.battle.units.find(u=>Number(u.id)===id).hp,0);assert.ok(saved(p));
});

test('saved militia health and medical eligibility reject malformed records before care can normalize them',()=>{
 const {campaign:s,patientId:id}=woundedGarrison();for(const values of [{hp:101},{hp:61,maxHp:60},{bleeding:11},{bleeding:-1},{bandaged:1000},{energy:101},{fatigue:-1}]){const wire=JSON.parse(encodeSave(s));Object.assign(wire.campaign.garrisons.retiro.find(u=>u.id===id),values);assert.throws(()=>decodeSave(JSON.stringify(wire)),/guarniciones|heridas|físico/);}
 const unqualified=woundedGarrison({careRules:{...DEFAULT_CARE_RULES,minimumSkill:90}}).campaign;assert.match(dispatchCampaign(unqualified,{type:'assignCare',id:D,assignment:'militia_doctor'}).lastError,/medicina/);
 const wire=JSON.parse(encodeSave(s));wire.campaign.operativeState[110].assignment='militia_doctor';assert.throws(()=>decodeSave(JSON.stringify(wire)),/asignaci[oó]n/);assert.ok(saved({campaign:s}));
});
