import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {enterSector} from '../game/world.js';
import {endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {dailyIncome} from '../game/economy.js';
import {TOWN_INCOME_SOURCES} from '../game/town-income.js';
import {approachNPC} from './approach-npc.mjs';
import {recordTownAgreement} from './town-income-fixture.mjs';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));
function localCampaign(source,{complete=true}={}){
 const content=defaultContentPackage();content.headquarters=source.sectorId;content.startingTerritory=defaultStartingTerritory(source.sectorId);
 if(complete)for(const id of source.requiredSectors)content.startingTerritory[id]={owner:'patriot',loyalty:65};
 return order(initialCampaign(8,content),{type:'createOfficer',name:'Testigo del puerto',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
}
function visitRepresentative(campaign,source){
 campaign=order(campaign,{type:'visitSector'});let battle=enterSector(campaign.pendingBattle);
 battle=approachNPC(battle,'1000',source.representative.npcId);
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);return pair;
}
const talk=(pair,source,approach='friendly')=>order(pair.campaign,{type:'talkNPC',unitId:1000,npcId:source.representative.npcId,approach,sectorState:pair.battle});
function beforeMidnight(state){state=order(state,{type:'wait',hours:23});state=order(state,{type:'advanceStrategicTime',seconds:3599});assert.equal(state.hour,23);assert.equal(state.secondOfHour,3599);return state;}

test('every port activates through an actual adjacent conversation and preserves the exact agreement through a full save',()=>{
 for(const source of TOWN_INCOME_SOURCES){
  let campaign=localCampaign(source);assert.equal(dailyIncome(campaign),0);const pair=visitRepresentative(campaign,source),before=structuredClone(pair.campaign);
  const far=structuredClone(pair.battle);const actor=far.units.find(unit=>unit.id==='1000');actor.x=far.width-1;actor.y=far.height-1;
  const denied=dispatchCampaign(pair.campaign,{type:'talkNPC',unitId:1000,npcId:source.representative.npcId,approach:'friendly',sectorState:far});
  assert.ok(denied.lastError);assert.deepEqual(denied.townIncome,before.townIncome);assert.equal(dailyIncome(denied),0);
  campaign=talk(pair,source);assert.equal(campaign.lastConversation.outcome,'incomeActivated');assert.equal(dailyIncome(campaign),source.dailyAmount);
  const receipt=campaign.townIncome.activations[source.id];assert.equal(receipt.hour,campaign.hour);assert.equal(receipt.secondOfHour,campaign.secondOfHour??0);
  assert.deepEqual(campaign.conversations[source.representative.npcId].incomeActivation,receipt);
  const restored=saved(campaign,pair.battle);assert.deepEqual(restored,{campaign,battle:pair.battle});
  const repeated=talk(restored,source,'direct');assert.deepEqual(repeated.townIncome,campaign.townIncome);assert.equal(dailyIncome(repeated),source.dailyAmount);
 }
});

test('Buenos Aires cannot activate with its other required sector occupied, and later control alone grants no agreement',()=>{
 const source=TOWN_INCOME_SOURCES[0],pair=visitRepresentative(localCampaign(source,{complete:false}),source);
 const met=talk(pair,source);assert.equal(met.sectors.retiro.owner,'royalist');assert.equal(dailyIncome(met),0);assert.deepEqual(met.townIncome.activations,{});
 // Explicit later territorial setup; no tactical victory is claimed here.
 met.sectors.retiro.owner='patriot';assert.equal(dailyIncome(met),0);
 const activated=talk({campaign:met,battle:pair.battle},source);assert.equal(dailyIncome(activated),8000);assert.equal(activated.lastConversation.outcome,'incomeActivated');
});

test('official save migration preserves possessions without auto-activating old control or dialogue flags and rejects orphan receipts',()=>{
 const source=TOWN_INCOME_SOURCES[0],state=order(localCampaign(source),{type:'wait',hours:72});delete state.townIncome;assert.equal(state.hour,72);
 const npcId=source.representative.npcId;state.conversations[npcId]={met:true,hour:0,lastApproach:'friendly',sector:'buenos_aires',text:'El puerto recibe el parte.'};
 const possessions=structuredClone({resources:state.resources,armory:state.armory,operativeState:state.operativeState,contracts:state.contracts});
 const migrated=saved(state).campaign;assert.equal(dailyIncome(migrated),0);assert.deepEqual(migrated.townIncome,{version:1,activations:{},lastPaidDay:3});
 for(const [key,value]of Object.entries(possessions))assert.deepEqual(migrated[key],value);
 const active=recordTownAgreement(localCampaign(source),'buenos_aires'),wire=JSON.parse(encodeSave(active));delete wire.campaign.townIncome;
 assert.throws(()=>decodeSave(JSON.stringify(wire)),/acuerdo/);
 for(const mutate of [s=>{s.townIncome.activations.buenos_aires.secondOfHour=1;},s=>{s.townIncome.activations.buenos_aires.npcId='brown';},s=>{delete s.conversations[npcId].incomeActivation;}]){
  const bad=JSON.parse(encodeSave(active));mutate(bad.campaign);assert.throws(()=>decodeSave(JSON.stringify(bad)),/acuerdo/);
 }
});

test('continuous clock and official save continuation pay once at the exact midnight',()=>{
 let state=beforeMidnight(recordTownAgreement(localCampaign(TOWN_INCOME_SOURCES[0]),'buenos_aires'));
 const restored=saved(state).campaign,treasury=state.resources.treasury;
 state=order(state,{type:'advanceStrategicTime',seconds:1});assert.equal(state.hour,24);assert.equal(state.secondOfHour,0);assert.equal(state.resources.treasury,treasury+8000);
 assert.deepEqual(order(restored,{type:'advanceStrategicTime',seconds:1}),state);
 const paid=saved(state).campaign,next=order(paid,{type:'advanceStrategicTime',seconds:1});assert.equal(next.resources.treasury,state.resources.treasury);
});

test('a fractional explicit wait settles the crossed midnight at its real timestamp',()=>{
 const state=beforeMidnight(recordTownAgreement(localCampaign(TOWN_INCOME_SOURCES[0]),'buenos_aires'));
 const treasury=state.resources.treasury,next=order(saved(state).campaign,{type:'wait',hours:1});
 assert.equal(next.hour,24);assert.equal(next.secondOfHour,3599);assert.equal(next.resources.treasury,treasury+8000);assert.equal(next.townIncome.lastPaidDay,1);
});

test('ordinary tactical rest crosses midnight and repeated synchronization cannot duplicate the agreement payment',()=>{
 let campaign=beforeMidnight(recordTownAgreement(localCampaign(TOWN_INCOME_SOURCES[0]),'buenos_aires'));
 campaign=order(campaign,{type:'visitSector'});const battle=endTurn(enterSector(campaign.pendingBattle));assert.equal(battle.lastError,null);
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);assert.equal(pair.campaign.resources.treasury,campaign.resources.treasury+8000);assert.equal(pair.campaign.townIncome.lastPaidDay,1);
 const restored=saved(pair.campaign,pair.battle),same=syncBattleTime(restored.campaign,restored.battle);assert.equal(same.error,null);assert.deepEqual(same.campaign,restored.campaign);
});
