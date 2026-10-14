import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {completeNorthernRoadArrival} from './recovery-road-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);return n;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};

// These are fresh declared campaign documents, not captured road/failed input.
// Ownership, six named roles, eight finite cartridges per issued musket, and
// the optional three-person invasion are authored before initialCampaign.
// Health, morale, clock, terms, encounters and journeys are never edited.
function setup({raid=false}={}){
 const d=scaffoldDocuments('declared-road-arrival'),guide=d.content.characters[0];
 d.content.startingTerritory['watch-post'].owner='patriot';
 d.world.arrivalFacilities['watch-post']=['barracks'];
 d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 const musket=defaultContentPackage().weapons.find(w=>w.template===1800);assert.ok(musket);
 d.content.weapons.push({...structuredClone(musket),id:'road-musket',name:'Mosquete de la guardia',art:guide.portrait});
 d.content.rules.deploymentCartridges=8;
 d.content.characters=Array.from({length:6},(_,i)=>({...structuredClone(guide),id:'road-'+i,name:'Guardia '+i,nickname:'Guardia '+i,weapon:'road-musket',attributes:{...guide.attributes,marksmanship:80}}));
 if(raid)d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:['watch-post']}}};
 const declared=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let c=initialCampaign(42,definition);const ids=rosterFor(c).map(o=>o.id),fees=[];
 assert.equal(ids.length,6);
 for(const [i,id]of ids.entries()){
  const op=rosterFor(c).find(o=>o.id===id),q=contractQuote(c,op,'day'),cash=c.resources.treasury;
  assert.equal(q.available,true,q.reason);c=order(c,{type:'recruitCivic',id,term:'day',destination:i<2?'camp':'watch-post'});
  assert.equal(c.resources.treasury,cash-q.total);assert.ok(c.recruited.includes(id));fees.push(q.total);
 }
 c=order(c,{type:'createSquad',ids:ids.slice(2),sector:'watch-post',name:'Guardia local'});const guard=c.activeSquadId;
 const home=c.squads.find(q=>q.location==='camp'&&q.members.includes(ids[0]));assert.ok(home);
 c=order(c,{type:'selectSquad',id:home.id});c=order(c,{type:'squad',ids:ids.slice(0,2)});
 assert.deepEqual(d,declared);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 assert.equal(c.resources.treasury,1000-fees.reduce((a,b)=>a+b,0));
 return {campaign:saved(c),ids,party:ids.slice(0,2),guard};
}
function retainPhysical(before,after){
 for(const id of before.recruited){
  assert.equal(after.operativeState[id].alive,before.operativeState[id].alive);
  for(const k of ['hp','maxHp','bleeding','bandaged','medkits','weaponDropped','inventory','outfit','headwear','legwear','carriedLoaded','carriedLoading','carriedReprime','carriedJammed','ammunitionByType'])assert.deepEqual(after.operativeState[id][k],before.operativeState[id][k],String(id)+': '+k);
  const ammo=(c,id)=>unitAmmunitionByType({...rosterFor(c).find(o=>o.id===id),...c.operativeState[id],loaded:c.operativeState[id].carriedLoaded??0});
  assert.deepEqual(ammo(after,id),ammo(before,id));
 }
}

test('a genuine clear arrived party needs no road order, renewal, defense or second watch',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),events=[];
 const result=completeNorthernRoadArrival(start,{target:'camp',keepServing:[...start.recruited],report:e=>events.push(e)});
 assert.deepEqual(start,before);assert.deepEqual(result,{campaign:start,defendedTarget:false});
 assert.equal(events.some(e=>e.action||e.event==='battleFinished'),false);assert.deepEqual(saved(result.campaign),start);
});

test('an actual mandatory encounter during immediate travel wins and replays before the same party reaches the care locality',()=>{
 const {campaign:base,party,guard}=setup({raid:true}),start=order(base,{type:'travel',sector:'watch-post'}),before=structuredClone(start),events=[];
 assert.ok(start.pendingEncounter);assert.equal(start.pendingEncounter.sector,'watch-post');assert.equal(start.lastError,null);
 assert.notEqual(start.location,'watch-post');assert.equal(start.squads.find(q=>q.id===start.activeSquadId).journey?.path.at(-1),'watch-post');
 const refused=dispatchCampaign(start,{type:'assignCare',operativeId:party[0],assignment:'rest'});assert.match(refused.lastError,/encuentro/);
 for(const k of ['hour','secondOfHour','resources','squads','operativeState','contracts','pendingEncounter'])assert.deepEqual(refused[k],start[k]);
 const run=input=>{const tape=[];const result=completeNorthernRoadArrival(input,{target:'watch-post',keepServing:[...input.recruited],report:e=>tape.push(e)});return {result,tape};};
 const first=run(start),again=run(saved(start));assert.deepEqual(again,first);events.push(...first.tape);assert.deepEqual(start,before);
 const c=first.result.campaign,prepared=events.find(e=>e.event==='northernHandoverDefenseInput'),defense=events.find(e=>e.event==='northernHandoverDefenseReplay');
 assert.ok(prepared&&defense);assert.equal(first.result.defendedTarget,true);assert.equal(defense.status,'victory');assert.equal(defense.exactSavedReplay,true);
 assert.equal(prepared.campaign.activeSquadId,guard);assert.ok(prepared.campaign.pendingBattle.squad.every(o=>!party.includes(o.id)),'travelling people are not inserted into the local defense');
 assert.equal(c.location,'watch-post');assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.squads.find(q=>q.id===c.activeSquadId).journey,undefined);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 assert.deepEqual(c.squad,party);for(const id of party){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);}
 assert.equal(c.enemyGroups.find(g=>g.id===defense.groupId).status,'defeated');assert.equal(c.enemyReserves.remaining.frontier,0);
 let pair={campaign:structuredClone(prepared.campaign),battle:enterSector(prepared.campaign.pendingBattle,prepared.campaign.sectorStates['watch-post'])};
 for(const [i,action]of defense.orders.entries()){
  const b=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(b.lastError,null);
  const n=syncBattleTime(pair.campaign,b);assert.equal(n.error,null);pair={campaign:n.campaign,battle:n.battle};
  if(i===Math.floor(defense.orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 }
 const request=prepared.campaign.pendingBattle;
 let returned=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 returned=order(returned,{type:'selectSquad',id:start.activeSquadId});assert.deepEqual(returned,defense.campaign);
 for(const u of defense.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(c.operativeState[Number(u.id)].alive,false);
 for(const u of defense.units.filter(u=>u.side==='player'&&u.hp>0)){assert.ok(c.operativeState[Number(u.id)].hp>=15);assert.equal(c.operativeState[Number(u.id)].bleeding,0);}
 assert.deepEqual(saved(c),c);assert.equal(events.filter(e=>e.event==='battleFinished').length,1);
});

test('remaining journey steps retain the actual paid cohort by second-aware quotes and replay every fee and ordinary wait',()=>{
 let {campaign:c,ids}=setup();for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 const deadline=23*3600;let zero=0;
 for(let n=0;clock(c)<deadline&&n<30;n++){const from=clock(c);c=order(c,{type:'wait',hours:Math.ceil((deadline-from)/3600)});zero=clock(c)===from?zero+1:0;assert.ok(zero<3);}
 assert.equal(clock(c),deadline);for(const id of c.squad)c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});
 c=order(c,{type:'travel',sector:'watch-post',queue:true});const start=saved(c),before=structuredClone(start),events=[];
 const {campaign:finished,defendedTarget}=completeNorthernRoadArrival(start,{target:'watch-post',keepServing:ids,report:e=>events.push(e)});
 assert.equal(defendedTarget,false);assert.deepEqual(start,before);assert.equal(finished.pendingEncounter,null);assert.equal(finished.location,'watch-post');assert.equal(finished.squads.find(q=>q.id===start.activeSquadId).journey,undefined);
 let replay=structuredClone(start),fees=0;
 for(const event of events){
  if(event.event==='northernHandoverRenewal'){
   const op=rosterFor(replay).find(o=>o.id===event.action.id),q=contractRenewalQuote(replay,op,'day'),expiry=contractExpiresSeconds(replay.contracts[op.id]);
   assert.deepEqual(q,event.quote);assert.equal(event.cost,q.price);assert.equal(q.available,true);const cash=replay.resources.treasury;
   replay=order(replay,event.action);assert.equal(replay.resources.treasury,cash-q.price);assert.equal(contractExpiresSeconds(replay.contracts[op.id]),expiry+86400);fees+=q.price;
  }else if(event.event==='northernHandoverOrder')replay=order(replay,event.action);
 }
 assert.ok(fees>0);assert.deepEqual(replay,finished);assert.equal(finished.resources.treasury,start.resources.treasury-fees);
 assert.ok(ids.every(id=>finished.recruited.includes(id)&&contractExpiresSeconds(finished.contracts[id])>clock(finished)));
 retainPhysical(start,finished);assert.deepEqual(saved(finished),finished);
 assert.deepEqual(completeNorthernRoadArrival(saved(start),{target:'watch-post',keepServing:ids}).campaign,finished);
});
