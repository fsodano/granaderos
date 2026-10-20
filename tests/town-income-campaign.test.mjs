import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {contractQuote} from '../game/contracts.js';
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
function beforeMidnight(state){state=order(state,{type:'wait',hours:23-state.hour});state=order(state,{type:'advanceStrategicTime',seconds:3599});assert.equal(state.hour,23);assert.equal(state.secondOfHour,3599);return state;}

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
 const source=TOWN_INCOME_SOURCES[0],start=localCampaign(source),state=order(start,{type:'wait',hours:72-start.hour});delete state.townIncome;assert.equal(state.hour,72);
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

test('an authored representative activates only the selected campaign amount through a real saved conversation and exact midnight payment',()=>{
 const stock=structuredClone(TOWN_INCOME_SOURCES),clock=c=>c.hour*3600+(c.secondOfHour??0),results=[];
 for(const amount of [137,911]){
  // Both independent campaigns deliberately use the same local NPC/source
  // identity. All resources, reception, placement and rates precede factories.
  const d=scaffoldDocuments(`income-context-${amount}`),base=d.content.characters[0],resident={...structuredClone(base),id:'representative',name:'Representante propio',nickname:'Representante',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,
   encounter:{recruitable:false,greeting:'El acuerdo de esta campaña.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}};
  delete resident.arrivalHours;
  d.content.characters=[{...structuredClone(base),id:'visitor',name:'Visitante',nickname:'Visitante',monthlyPay:30,arrivalHours:0,weapon:null},resident];
  d.content.placements=[{id:'representative-post',character:'representative',mode:'fixed',sectors:['camp'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
  d.content.rules.startingTreasury=1000;d.content.rules.deploymentCartridges=0;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
  d.world.expansion.buildingTargets.camp=0;
  d.maps.camp.spawns=d.maps.camp.spawns.map(spawn=>spawn.side==='player'?{...spawn,x:12,y:8}:spawn);
  const source={id:'own-income',name:'Acuerdo propio',source:'Acuerdo local',sectorId:'camp',requiredSectors:['camp'],dailyAmount:amount,representative:{npcId:'authored-representative',name:'Representante propio',sectorId:'camp'}};
  d.world.incomeSources=[source];
  const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
  let campaign=initialCampaign(42,content);assert.equal(campaign.resources.treasury,1000);assert.equal(dailyIncome(campaign),0);assert.deepEqual(campaign.townIncome.activations,{});
  const visitor=rosterFor(campaign).find(op=>op.contentId==='visitor'),quote=contractQuote(campaign,visitor,'month');
  campaign=order(campaign,{type:'recruitCivic',id:visitor.id,term:'month',destination:'camp'});assert.equal(campaign.resources.treasury,1000-quote.total);
  const beforeVisit=structuredClone(campaign),cash=campaign.resources.treasury;campaign=order(campaign,{type:'visitSector'});
  let battle=enterSector(campaign.pendingBattle);battle=approachNPC(battle,String(visitor.id),source.representative.npcId);
  const near=syncBattleTime(campaign,battle);assert.equal(near.error,null);assert.ok(clock(near.campaign)>clock(beforeVisit),'The physical meeting consumes actual tactical time.');
  const action={type:'talkNPC',unitId:visitor.id,npcId:source.representative.npcId,approach:'direct',sectorState:near.battle};
  campaign=order(near.campaign,action);assert.equal(campaign.lastConversation.outcome,'incomeActivated');assert.equal(campaign.resources.treasury,cash,'Conversation records an agreement without an advance payment.');
  assert.equal(dailyIncome(campaign),amount);assert.deepEqual(Object.keys(campaign.townIncome.activations),[source.id]);
  const receipt=campaign.townIncome.activations[source.id];assert.equal(receipt.npcId,source.representative.npcId);assert.equal(receipt.sectorId,'camp');assert.equal(receipt.hour,campaign.hour);assert.equal(receipt.secondOfHour,campaign.secondOfHour??0);
  assert.deepEqual(campaign.conversations[source.representative.npcId].incomeActivation,receipt);
  const contact=saved(near.campaign,near.battle),replayed=order(contact.campaign,{...action,sectorState:contact.battle});assert.deepEqual(replayed,campaign);
  const pair=saved(campaign,near.battle);assert.deepEqual(pair,{campaign,battle:near.battle});
  campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
  assert.equal(campaign.resources.treasury,cash);const boundary=(Math.floor(clock(campaign)/86400)+1)*86400;
  for(let n=0;clock(campaign)<boundary-1&&n<32;n++)campaign=order(campaign,{type:'advanceStrategicTime',seconds:Math.min(3600,boundary-1-clock(campaign))});
  assert.equal(clock(campaign),boundary-1);assert.equal(campaign.resources.treasury,cash);
  const beforePayment=saved(campaign).campaign,paid=order(campaign,{type:'advanceStrategicTime',seconds:1});
  assert.equal(clock(paid),boundary);assert.equal(paid.resources.treasury,cash+amount);assert.equal(paid.townIncome.lastPaidDay,Math.floor(boundary/86400));assert.deepEqual(order(beforePayment,{type:'advanceStrategicTime',seconds:1}),paid);
  const continued=order(saved(paid).campaign,{type:'advanceStrategicTime',seconds:1});assert.equal(continued.resources.treasury,cash+amount);assert.deepEqual(continued.townIncome.activations,campaign.townIncome.activations);
  assert.deepEqual(d,declaration);assert.deepEqual(TOWN_INCOME_SOURCES,stock);results.push({amount,cash,paid:paid.resources.treasury});
 }
 assert.deepEqual(results.map(row=>row.paid-row.cash),[137,911],'The shared NPC/source IDs cannot use another campaign rate or a stock port amount.');
});
