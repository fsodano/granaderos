import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {questPackage} from './content-quest-fixture.mjs';
import {readyLocal,talk,leave} from './local-contract-fixture.mjs';
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null);return next;};

test('continuous time stops on the exact campaign victory boundary and a new postgame order can continue',()=>{
 const content=defaultContentPackage();content.campaignStory={...defaultCampaignStory(),chapters:[{id:'day-two',name:'Segundo día',objective:'Esperar hasta el segundo día.',conditions:[{type:'day',min:2,max:null}]}]};
 let state=initialCampaign(42,content);state=order(state,{type:'wait',hours:23});state=order(state,{type:'advanceStrategicTime',seconds:3570});
 assert.equal(state.completed,false);assert.equal(state.hour*3600+state.secondOfHour,24*3600-30);
 state=order(state,{type:'advanceStrategicTime',seconds:60});
 assert.equal(state.completed,true);assert.equal(state.hour*3600+state.secondOfHour,24*3600);
 assert.deepEqual(state.campaignProgress.outcome,{type:'victory',hour:24,secondOfHour:0});
 state=decodeSave(encodeSave(state)).campaign;state=order(state,{type:'advanceStrategicTime',seconds:60});
 assert.equal(state.hour*3600+state.secondOfHour,24*3600+60);assert.equal(state.completed,true);
});

test('continuous time stops at a fractional quest deadline that defeats the campaign',()=>{
 const content=questPackage();content.quests[0].deadlineHours=1;
 content.campaignStory={...defaultCampaignStory(),chapters:[{id:'late',name:'Después',objective:'Esperar.',conditions:[{type:'day',min:50,max:null}]}],failureConditions:[{type:'quest',quest:'river-post',status:'failed'}]};
 let visit=readyLocal(undefined,content);visit={...visit,campaign:order(visit.campaign,{...talk(visit,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'accept'})};
 const accepted=visit.campaign.contentQuestEvents.at(-1),deadline=accepted.hour*3600+(accepted.secondOfHour??0)+3600;
 let state=leave(visit),now=()=>state.hour*3600+(state.secondOfHour??0);
 assert.notEqual(deadline%3600,0,'the actual conversation establishes a fractional deadline');
 while(deadline-now()>30)state=order(state,{type:'advanceStrategicTime',seconds:Math.min(3600,deadline-now()-30)});
 assert.equal(state.defeated,false);state=order(state,{type:'advanceStrategicTime',seconds:60});
 assert.equal(state.defeated,true);assert.equal(now(),deadline);
 assert.deepEqual(state.campaignProgress.outcome,{type:'defeat',hour:Math.floor(deadline/3600),secondOfHour:deadline%3600});
 assert.equal(decodeSave(encodeSave(state)).campaign.defeated,true);
});
