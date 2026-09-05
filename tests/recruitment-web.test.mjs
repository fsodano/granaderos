import {marchToFront,meetLocalRecruit} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign as dispatch,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {OFFICER_TRAITS,OFFICER_QUESTIONS,CIVIC_RECRUITS} from '../game/recruitment.js';
const order=(s,a)=>{const n=meetLocalRecruit(s,a)??dispatch(marchToFront(s,a),a);assert.equal(n.lastError,null,n.lastError);return n;};
const officer=(doctrine='cavalry_commander')=>({type:'createOfficer',name:'María del Valle',answers:{origin:'estancia',doctrine,crisis:'rally'}});
test('Cabildo questionnaire creates one bounded officer with each tactical trait',()=>{
 assert.equal(OFFICER_TRAITS.length,4);assert.equal(OFFICER_QUESTIONS.length,3);
 for(const t of OFFICER_TRAITS){const s=order(initialCampaign(),officer(t.id)),op=rosterFor(s).find(o=>o.id===1000);assert.deepEqual(op.traits,[t.id]);assert.equal(op.name,'María del Valle');assert.ok(s.recruited.includes(1000));assert.equal(s.resources.treasury,2900);assert.ok(dispatch(s,officer()).lastError);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);}
});
test('incomplete examination and markup names roll back',()=>{
 for(const action of [{...officer(),name:'<img>'},{...officer(),answers:{origin:'estancia'}},{...officer(),name:'A'}]){const s=dispatch(initialCampaign(),action);assert.ok(s.lastError);assert.equal(s.resources.treasury,3200);assert.equal(s.officer,null);}
});
test('civic bulletin offers prepaid recruits without regional ownership gates',()=>{
 let s=initialCampaign();assert.equal(dispatch(s,{type:'recruitCivic',id:101}).lastError,null);s=order(s,{type:'recruitCivic',id:100});assert.equal(s.resources.treasury,3194);assert.ok(s.squad.includes(100));assert.ok(dispatch(s,{type:'recruitCivic',id:100}).lastError);assert.ok(CIVIC_RECRUITS.filter(o=>o.id<=102).every(o=>o.monthlyPay<=220));
});
test('civic combat experience actually improves battle statistics and persists',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'month'});s=order(s,{type:'squad',ids:[3,100]});const original=rosterFor(s).find(o=>o.id===100).marksmanship;
 for(const sector of ['san_nicolas','cordoba']){s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle.squad.find(o=>o.id===100));s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',survivors:s.pendingBattle.squad.map(o=>({id:o.id,hp:o.hp,loaded:o.loaded,ammo:o.ammo,priming:20,flints:2,rations:1,condition:80,fatigue:10}))});}
 const trained=rosterFor(s).find(o=>o.id===100);assert.equal(trained.xp,120);assert.equal(trained.level,2);assert.equal(trained.marksmanship,original+4);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,68);
 s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'attack',sector:'santa_fe'});const soldier=s.pendingBattle.squad.find(o=>o.id===100);assert.equal(soldier.marksmanship,original+4);assert.equal(soldier.priming,20);assert.equal(soldier.flints,2);assert.equal(soldier.rations,1);assert.equal(soldier.condition,80);
});
test('legacy version1 saves migrate without losing historical stats',()=>{
 const old=initialCampaign();delete old.officer;for(const id of [100,101,102])delete old.operativeState[id];for(const op of Object.values(old.operativeState)){delete op.xp;delete op.priming;delete op.flints;delete op.rations;delete op.condition;}
 const s=restoreCampaign(JSON.stringify(old));assert.equal(s.officer,null);assert.equal(s.operativeState[100].xp,0);assert.equal(s.operativeState[3].priming,50);assert.equal(rosterFor(s).find(o=>o.id===57).leadership,99);
});

test('fictional foreign volunteers have finite contracts and persist in legacy-compatible saves',()=>{
 let s=initialCampaign();
 for(const o of CIVIC_RECRUITS.filter(o=>o.foreign)){const before=s.resources.treasury;s=dispatch(s,{type:'recruitCivic',id:o.id});assert.equal(s.lastError,null);assert.ok(s.recruited.includes(o.id));assert.equal(s.resources.treasury,before-Math.ceil(o.monthlyPay/30));s=restoreCampaign(serializeCampaign(s));assert.ok(s.recruited.includes(o.id));const paid=s.resources.treasury;s=dispatch(s,{type:'recruitCivic',id:o.id});assert.ok(s.lastError);assert.equal(s.resources.treasury,paid);}
});
