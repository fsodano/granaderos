import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {worldOwner} from '../game/world-cells.js';
import {operativeLocation} from '../game/squads.js';
import {tooTiredToMarch} from '../game/march-fatigue.js';
import {careRules} from '../game/campaign-care-rules.js';
import {restNorthernSurvivors,queueNorthernSurvivorReturn} from './northern-survivor-return.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const canonical=c=>{const n=structuredClone(c);for(const key of ['sectorStates','sceneStates'])for(const id of Object.keys(n[key]??{}))n[key][id]=expandCellScene(n[key][id]);return n;};
const saved=pair=>{const n=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(canonical(n.campaign),canonical(pair.campaign));assert.deepEqual(n.battle,pair.battle??null);return n;};
const order=(c,action)=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);return n;};
const unit=(b,id)=>b.units.find(u=>u.id===String(id));
function step(pair,action){
 const before=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,JSON.parse(JSON.stringify(action))).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,before);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return saved(next);
}
const leave=pair=>order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});

// Every person, stable wound, starting condition, finite kit and physical map
// is declared before the factory. Location changes use real paid travel/exits.
function setup({rural=true,tired=false}={}){
 const d=scaffoldDocuments('northern-neutral-survivor-return');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=0;
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.expansion.buildingTargets={cordoba:0,'watch-post':0};
 d.world.exitLinks=[['cordoba','E',19,8,'watch-post','W',0,8]];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.characters=Array.from({length:2},(_,i)=>({...structuredClone(base),id:'survivor-'+i,name:'Superviviente '+i,nickname:'Superviviente '+i,monthlyPay:30,arrivalHours:0,
  startingSupplies:{rations:0,torches:0,medkits:2,boleadoras:0},
  startingCondition:{hp:i===0?60:70,bleeding:0,bandaged:i===0?10:0,energy:i===0&&tired?20:100,fatigue:i===0&&tired?80:0}}));
 d.maps.cordoba.spawns=[{id:'entry',x:18,y:8,side:'player'},{id:'opposition',x:1,y:8,side:'enemy'}];
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const [survivor,guard]=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of [survivor,guard]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.equal(quote.available,true);assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id,term:'week'});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 c=order(c,{type:'createSquad',sector:'cordoba',ids:[guard],name:'Guardia local'});const local=c.activeSquadId;
 c=order(c,{type:'createSquad',sector:'cordoba',ids:[survivor],name:'Superviviente de regreso'});let group=c.activeSquadId,exit=null,tacticalOrders=[];
 if(rural){
  c=order(c,{type:'visitSector'});let pair=saved({campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.cordoba)});const initial=saved(pair);
  exit=pair.battle.exits.find(e=>e.edge==='E'&&worldOwner(c,e.destination)==='neutral');assert.ok(exit);
  const actor=unit(pair.battle,survivor),point=getReachable(pair.battle,actor).filter(p=>boundaryMatches(pair.battle,p,exit.edge)).sort((a,b)=>a.cost-b.cost||a.y-b.y)[0];assert.ok(point);
  if(!boundaryMatches(pair.battle,actor,exit.edge)){const action={type:'move',unitId:String(survivor),x:point.x,y:point.y};pair=step(pair,action);tacticalOrders.push(action);}
  assert.ok(boundaryMatches(pair.battle,unit(pair.battle,survivor),exit.edge));const action={type:'exit',unitIds:[String(survivor)],exitId:exit.id},quote=exitPreview(pair.battle,action);assert.equal(quote.available,true,quote.reason);
  pair=step(pair,action);tacticalOrders.push(action);assert.equal(unit(pair.battle,survivor).departure.destination,exit.destination);
  let replay=saved(initial);for(const action of tacticalOrders)replay=step(replay,action);assert.deepEqual(replay,pair);c=leave(pair);assert.deepEqual(canonical(leave(replay)),canonical(c));
  assert.equal(operativeLocation(c,survivor),exit.destination);assert.equal(c.operativeState[survivor].arrival.fromSector,'cordoba');assert.equal(worldOwner(c,exit.destination),'neutral');
  group=c.squads.find(q=>q.members.includes(survivor)).id;
 }else{
  c=order(c,{type:'transport',mode:'posta'});const before=clock(c);c=order(c,{type:'travel',sector:'watch-post',mode:'posta'});assert.ok(clock(c)>before);assert.equal(operativeLocation(c,survivor),'watch-post');assert.ok(c.operativeState[survivor].fatigue>0);
 }
 assert.equal(c.operativeState[survivor].hp,60);assert.equal(c.operativeState[survivor].bleeding,0);assert.equal(c.operativeState[survivor].medkits,2);assert.equal(operativeLocation(c,guard),'cordoba');
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,survivor,guard,group,local,hires,exit,tacticalOrders};
}

function retained(start){
 let campaign=start;const orders=[];
 const issueOrder=action=>{
  if(action.type==='wait')for(const id of campaign.recruited){const contract=campaign.contracts[id];if(campaign.operativeState[id].alive&&!campaign.operativeState[id].captured&&contract?.expiresAt!==null&&contract?.expiresAt<=campaign.hour+action.hours){
   const renew={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt};campaign=order(campaign,renew);orders.push(renew);
  }}
  const next=dispatchCampaign(campaign,action);campaign=next;orders.push(structuredClone(action));
  if(next.lastError){const error=Error(next.lastError);error.campaign=next;throw error;}return campaign;
 };
 return {issueOrder,orders,current:()=>campaign};
}
function arrive(run,group){
 for(let h=0;h<48&&run.current().squads.find(q=>q.id===group)?.journey;h++){assert.equal(run.current().pendingEncounter,null);run.issueOrder({type:'wait',hours:1});}
 assert.equal(run.current().squads.find(q=>q.id===group).location,'cordoba');assert.equal(run.current().squads.find(q=>q.id===group).journey,undefined);
}
function replay(start,orders,end){let c=saved({campaign:start}).campaign;for(const [i,action]of orders.entries()){c=order(c,action);if(i===Math.floor(orders.length/2))c=saved({campaign:c}).campaign;}assert.deepEqual(canonical(saved({campaign:c}).campaign),canonical(end));}
const kit=r=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','medkits','inventory','condition','weaponDropped','captured','alive'].map(key=>[key,structuredClone(r[key])]));

test('a real neutral departure defers both rest call sites, earns its paid return, then starts Native clinical recovery only in Córdoba',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start);assert.equal(tooTiredToMarch(start.operativeState[s.survivor]),false);
 const refusal=dispatchCampaign(saved({campaign:start}).campaign,{type:'assignCare',operativeId:s.survivor,assignment:'rest'});assert.equal(refusal.lastError,'La atención y el descanso necesitan un sector seguro.');assert.deepEqual(refusal.operativeState,start.operativeState);
 // The terminal refusal above is plain evidence only. All progress below uses
 // an independent official copy of the successful, freshly earned rural start.
 const run=retained(saved({campaign:start}).campaign),initial=restNorthernSurvivors(run.current(),[s.survivor],{issueOrder:run.issueOrder});
 assert.deepEqual(initial.receipt.rested,[]);assert.deepEqual(initial.receipt.deferred,[s.survivor]);assert.deepEqual(run.orders,[]);assert.deepEqual(initial.campaign,start);
 const queued=queueNorthernSurvivorReturn(run.current(),s.group,{issueOrder:run.issueOrder});assert.deepEqual(queued.receipt.rest.deferred,[s.survivor]);assert.ok(!run.orders.some(a=>a.type==='wait'||a.type==='setSleep'||a.assignment==='rest'));assert.equal(operativeLocation(queued.campaign,s.survivor),s.exit.destination);assert.equal(queued.campaign.squads.find(q=>q.id===s.group).journey.status,'moving');
 const began=clock(run.current());arrive(run,s.group);assert.ok(clock(run.current())>began&&clock(run.current())-began<=48*3600);assert.deepEqual(kit(run.current().operativeState[s.survivor]),kit(start.operativeState[s.survivor]));
 assert.equal(worldOwner(run.current(),operativeLocation(run.current(),s.survivor)),'patriot');const rested=restNorthernSurvivors(run.current(),[s.survivor],{issueOrder:run.issueOrder});assert.deepEqual(rested.receipt.rested,[s.survivor]);assert.deepEqual(rested.receipt.deferred,[]);
 const hp=run.current().operativeState[s.survivor].hp,until=clock(run.current())+careRules(run.current()).restHealingHours*3600;
 for(let n=0;clock(run.current())<until&&n<32;n++)run.issueOrder({type:'wait',hours:1});assert.equal(clock(run.current()),until);assert.equal(run.current().operativeState[s.survivor].hp,hp+1);assert.equal(run.current().operativeState[s.survivor].medkits,2);
 assert.equal(operativeLocation(run.current(),s.guard),'cordoba');assert.equal(run.current().operativeState[s.guard].hp,70);assert.deepEqual(run.current().contracts,start.contracts);assert.equal(run.current().resources.treasury,start.resources.treasury);for(const id of [s.survivor,s.guard])assert.ok(contractExpiresSeconds(run.current().contracts[id])>clock(run.current()));
 replay(start,run.orders,run.current());assert.deepEqual(start,before);
});

test('an already safe remote party keeps its actual pre-return rest and paid waits before the unchanged march',()=>{
 const s=setup({rural:false}),start=s.campaign,before=structuredClone(start),run=retained(saved({campaign:start}).campaign),began=clock(start);
 const result=queueNorthernSurvivorReturn(run.current(),s.group,{issueOrder:run.issueOrder});assert.deepEqual(result.receipt.rest.rested,[s.survivor]);assert.deepEqual(result.receipt.rest.deferred,[]);assert.ok(run.orders.some(a=>a.type==='wait'));assert.ok(clock(run.current())>began&&clock(run.current())-began<=48*3600);
 const travel=run.orders.findIndex(a=>a.type==='travel');assert.ok(run.orders.findIndex(a=>a.type==='assignCare'&&a.assignment==='rest')<travel);assert.ok(run.orders.findIndex(a=>a.type==='wait')<travel);assert.equal(run.current().operativeState[s.survivor].energy,100);assert.equal(run.current().operativeState[s.survivor].fatigue,0);
 arrive(run,s.group);assert.equal(operativeLocation(run.current(),s.survivor),'cordoba');assert.equal(run.current().operativeState[s.survivor].bleeding,0);assert.equal(run.current().operativeState[s.survivor].medkits,2);assert.ok(run.current().operativeState[s.survivor].hp>=start.operativeState[s.survivor].hp);assert.equal(run.current().resources.treasury,start.resources.treasury);
 replay(start,run.orders,run.current());assert.deepEqual(start,before);
});

test('a genuinely exhausted neutral departure retains the actual Native march refusal without invented rest or readiness',()=>{
 const s=setup({tired:true}),start=s.campaign,before=structuredClone(start);assert.equal(worldOwner(start,operativeLocation(start,s.survivor)),'neutral');assert.equal(tooTiredToMarch(start.operativeState[s.survivor]),true);
 const run=retained(saved({campaign:start}).campaign);let failure;try{queueNorthernSurvivorReturn(run.current(),s.group,{issueOrder:run.issueOrder});}catch(error){failure=error;}
 assert.equal(failure?.message,'La escuadra necesita descansar.');assert.equal(failure.campaign.lastError,failure.message);assert.deepEqual(failure.northernSurvivorReturn.rest.deferred,[s.survivor]);assert.ok(run.orders.some(a=>a.type==='travel'));assert.ok(!run.orders.some(a=>a.type==='wait'||a.type==='setSleep'||a.assignment==='rest'));
 assert.equal(clock(failure.campaign),clock(start));assert.equal(failure.campaign.resources.treasury,start.resources.treasury);assert.equal(failure.campaign.operativeState[s.survivor].location,s.exit.destination);assert.deepEqual(failure.campaign.operativeState,start.operativeState);assert.deepEqual(failure.campaign.contracts,start.contracts);assert.ok(!failure.campaign.squads.find(q=>q.members.includes(s.survivor)).journey);assert.deepEqual(start,before);
 // Do not query, save, replay or resume the failed campaign.
});
