import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {militiaCourse} from '../game/militia.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
test('militia needs a present instructor and actual hours; assigned instructors cannot depart',()=>{
 let s=initialCampaign();assert.ok(dispatchCampaign(s,{type:'militia',sector:'ensenada',trainerId:4}).lastError);s=order(s,{type:'militia',rank:0,trainerId:4});const duration=s.militiaTraining[0].duration;assert.equal(s.sectors.retiro.militia[0],0);assert.equal(s.resources.treasury,3140);assert.ok(dispatchCampaign(s,{type:'travel',sector:'buenos_aires'}).lastError);assert.ok(dispatchCampaign(s,{type:'visitSector'}).lastError);assert.ok(dispatchCampaign(s,{type:'militia',trainerId:3}).lastError);s=order(s,{type:'wait',hours:duration-1});assert.equal(s.sectors.retiro.militia[0],0);s=order(s,{type:'wait',hours:1});assert.equal(s.sectors.retiro.militia[0],3);assert.equal(s.militiaTraining.length,0);
});
test('promotion conserves personnel, cancellation releases reserved trainees, supply pauses',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[3,0,0];s=order(s,{type:'militia',rank:1,trainerId:4});assert.deepEqual(s.sectors.retiro.militia,[0,0,0]);s=order(s,{type:'cancelMilitia',sector:'retiro'});assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);assert.equal(s.resources.treasury,3080);s=order(s,{type:'militia',rank:1,trainerId:4});s=order(s,{type:'wait',hours:s.militiaTraining[0].duration});assert.deepEqual(s.sectors.retiro.militia,[0,3,0]);assert.ok(dispatchCampaign(s,{type:'militia',rank:1,trainerId:4}).lastError);
});
test('leadership and tactician training bonuses are substantive; garrison cap and saves validated',()=>{
 assert.ok(militiaCourse({id:3,leadership:80},0).hours<militiaCourse({id:3,leadership:30},0).hours);assert.ok(militiaCourse({id:1000,leadership:80,traits:['guerrilla_tactician']},0).hours<militiaCourse({id:3,leadership:80},0).hours);
 let s=initialCampaign();s.sectors.retiro.militia=[60,0,0];assert.ok(dispatchCampaign(s,{type:'militia',trainerId:4}).lastError);s.sectors.retiro.militia=[0,0,0];s=order(s,{type:'militia',trainerId:4});assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);s.militiaTraining[0].remaining=-1;assert.throws(()=>restoreCampaign(serializeCampaign(s)));const old=initialCampaign();delete old.militiaTraining;assert.deepEqual(restoreCampaign(serializeCampaign(old)).militiaTraining,[]);
});
test('supply loss pauses a course and recapture disperses trainees',()=>{
 let s=initialCampaign();s.sectors.cordoba.owner='patriot';s.sectors.tucuman.owner='patriot';s.sectors.tucuman.loyalty=65;s=order(s,{type:'travel',sector:'tucuman'});s=order(s,{type:'militia',trainerId:4});const remaining=s.militiaTraining[0].remaining;s.sectors.cordoba.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.militiaTraining[0].remaining,remaining);s.sectors.tucuman.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.militiaTraining.length,0);assert.equal(s.sectors.tucuman.militia[0],0);
});
