import test from 'node:test';
import assert from 'node:assert/strict';
import {runOpeningCampaign} from './opening-campaign.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {dailyTownIncome} from '../game/town-income.js';

test('the established southern opening records its actual port meeting before departure',()=>{
 const stop=Symbol('port checkpoint');let before,agreed;const events=[];
 assert.throws(()=>runOpeningCampaign({report:event=>events.push(event),onCheckpoint:(stage,campaign)=>{
  if(stage==='opening-before-port')before=campaign;
  if(stage==='opening-port-agreement'){agreed=campaign;throw stop;}
 }}),error=>error===stop);
 assert.ok(before&&agreed);assert.equal(before.location,'buenos_aires');assert.equal(agreed.location,'buenos_aires');
 assert.equal(dailyTownIncome(before),0);assert.equal(dailyTownIncome(agreed),8000);
 assert.equal(agreed.resources.treasury,before.resources.treasury,'The meeting does not grant an immediate or retroactive payment.');
 const activation=agreed.townIncome.activations.buenos_aires,conversation=agreed.conversations['local-buenos_aires'];
 assert.deepEqual(activation,conversation.incomeActivation);assert.equal(activation.hour,agreed.hour);assert.equal(activation.secondOfHour,agreed.secondOfHour);
 assert.equal(activation.approach,'direct');assert.equal(conversation.met,true);assert.equal(conversation.sector,'buenos_aires');
 assert.equal(events.filter(event=>event.event==='townIncomeActivated').length,1);assert.equal(events.find(event=>event.event==='townIncomeActivated').operativeId,1000);
 assert.ok(agreed.hour*3600+(agreed.secondOfHour??0)>before.hour*3600+(before.secondOfHour??0),'The actual approach spends tactical time.');
 assert.equal(agreed.pendingBattle,null);assert.equal(agreed.pendingEncounter,null);assert.deepEqual(decodeSave(encodeSave(agreed)).campaign,agreed);
 // Pay only the next real midnight, then verify that save/reload cannot pay it again.
 let continued=decodeSave(encodeSave(agreed)).campaign;
 for(let attempt=0;continued.hour<24&&attempt<48;attempt++){
  continued=dispatchCampaign(continued,{type:'wait',hours:1});assert.equal(continued.lastError,null);assert.equal(continued.pendingEncounter,null);
 }
 assert.equal(continued.hour,24);assert.equal(continued.townIncome.lastPaidDay,1);
 assert.equal(continued.resources.treasury,agreed.resources.treasury+8000);
 const restored=decodeSave(encodeSave(continued)).campaign,next=dispatchCampaign(restored,{type:'wait',hours:1});
 assert.equal(next.lastError,null);assert.equal(next.townIncome.lastPaidDay,1);assert.equal(next.resources.treasury,continued.resources.treasury);
});
