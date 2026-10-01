import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};

// A user must request time again after an assignment/sleep notice. Fixtures
// that need elapsed time do the same, retaining every hourly event and cost.
export function advanceCampaignHours(state,hours){
 const until=state.hour+hours;let s=state;
 for(let attempt=0;s.hour<until&&attempt<240;attempt++){
  assert.ok(!s.pendingBattle&&!s.pendingEncounter,'Resolve the actual encounter before strategic waiting.');
  s=order(s,{type:'wait',hours:Math.min(24,until-s.hour)});
 }
 assert.equal(s.hour,until,'Requested campaign time must actually elapse');return s;
}
export function finishMilitiaTraining(state,{remaining=0}={}){
 const course=state.militiaTraining[0];assert.ok(course,'A paid course must exist.');let s=state;
 for(let attempt=0;attempt<240;attempt++){
  const current=s.militiaTraining.find(c=>c.sector===course.sector&&c.started===course.started);
  if(!current||current.remaining<=remaining)return s;
  s=advanceCampaignHours(s,1);
 }
 assert.fail('The paid militia course did not finish after 240 real hours.');
}
