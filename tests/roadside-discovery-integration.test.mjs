import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {cellTravelPlan} from '../game/world-cells.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,lookPreview,canSee,containerLootPreview} from '../game/tactical.js';
import {ammoCount} from '../game/ammo-types.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {heldTool} from '../game/environment-interactions.js';
import {fieldDressingsSource} from '../game/field-dressings.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {ROADSIDE_DISCOVERY_CHEST,ROADSIDE_CROWBAR_ID,ROADSIDE_SHIRT_ID} from '../game/roadside-discoveries.js';

const CELL='cell-24-27',CARRIER=100,OTHER=110;
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const stamp=state=>state.hour*3600+(state.secondOfHour??0);
const actor=(pair,id=CARRIER)=>pair.battle.units.find(unit=>unit.id===String(id));
const chest=pair=>pair.battle.props.find(prop=>prop.id===ROADSIDE_DISCOVERY_CHEST);
const keyFor=(unit,id)=>Object.entries(unit.inventory).find(([,record])=>record.instanceId===id)?.[0];
const owned=(unit,id)=>[unit.outfit,...Object.values(unit.inventory)].find(record=>record?.instanceId===id);
const payload=stack=>{const record=structuredClone(stack);delete record.item;return record;};
const ammunition=unit=>({loaded:unit.loaded,ammunition:structuredClone(unit.ammunition),rounds:unit.loaded+ammoCount(unit),condition:unit.condition});
const campaignAmmunition=(pair,id)=>ammunition(carriedAmmunition(rosterFor(pair.campaign).find(op=>op.id===id),pair.campaign.operativeState[id]));
const health=pair=>[CARRIER,OTHER].map(id=>({id,hp:pair.campaign.operativeState[id].hp,bleeding:pair.campaign.operativeState[id].bleeding}));
function rejectedWithoutCost(before,after,message){
 assert.ok(after.lastError,message);
 const {lastError:oldError,log:oldLog,...original}=before,{lastError,log,...rejected}=after;
 assert.deepEqual(rejected,original,message);assert.deepEqual(log.slice(0,oldLog.length),oldLog);
}

function campaignOrder(pair,action,history){
 const before=structuredClone(pair),campaign=dispatchCampaign(pair.campaign,action);
 assert.equal(campaign.lastError,null,`${action.type}: ${campaign.lastError}`);assert.deepEqual(pair,before);
 history?.push({kind:'campaign',action:structuredClone(action)});
 return saved({campaign});
}
function visit(pair,history){
 const campaign=dispatchCampaign(pair.campaign,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 const result=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location])});
 history?.push({kind:'visit'});return result;
}
function issue(pair,action,history){
 const before=structuredClone(pair),battle=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
 assert.equal(battle.lastError,null,`${action.type}: ${battle.lastError}`);
 assert.deepEqual(presented.state,battle,'ordinary and presented actions have the same authoritative result');
 assert.deepEqual(pair,before,'a real order must not mutate its submitted checkpoint');
 const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);
 history?.push({kind:'battle',action:structuredClone(action)});
 return saved({campaign:synced.campaign,battle:synced.battle});
}
function leave(pair,history){
 const campaign=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,
  sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
 assert.equal(campaign.lastError,null,campaign.lastError);history?.push({kind:'leave'});
 return saved({campaign});
}
function approach(pair,id,history){
 const unitId=String(id),distance=()=>Math.abs(actor(pair,id).x-chest(pair).x)+Math.abs(actor(pair,id).y-chest(pair).y);
 for(let attempt=0;distance()>1&&attempt<8;attempt++){
  const target=chest(pair),point=getReachable(pair.battle,actor(pair,id)).filter(cell=>Math.abs(cell.x-target.x)+Math.abs(cell.y-target.y)===1)
   .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  assert.ok(point,'the real rural chest has a reachable adjacent ground cell');
  const before={x:actor(pair,id).x,y:actor(pair,id).y};
  pair=issue(pair,{type:'move',unitId,x:point.x,y:point.y},history);
  assert.notDeepEqual({x:actor(pair,id).x,y:actor(pair,id).y},before);
 }
 assert.ok(distance()<=1);
 if(lookPreview(pair.battle,actor(pair,id),chest(pair)).valid)
  pair=issue(pair,{type:'look',unitId,x:chest(pair).x,y:chest(pair).y},history);
 assert.equal(canSee(pair.battle,actor(pair,id),chest(pair)),true,'actual approach and sight admit the cache');
 return pair;
}
function replay(initial,history){
 let pair=saved(initial);
 for(const event of history){
  if(event.kind==='campaign')pair=campaignOrder(pair,event.action);
  else if(event.kind==='visit')pair=visit(pair);
  else if(event.kind==='battle')pair=issue(pair,event.action);
  else pair=leave(pair);
 }
 return pair;
}

test('fresh paid squads discover one finite roadside cache and retain its worn items through official replay, return and shared reentry',t=>{
 // This is a real new default campaign. No territory, actor, equipment,
 // health, placement, time, seed or outcome is assigned after admission.
 const initial=saved({campaign:initialCampaign(45,defaultContentPackage())}),history=[];
 let pair=initial;const cash=pair.campaign.resources.treasury;
 const quotes=[CARRIER,OTHER].map(id=>({id,...contractQuote(pair.campaign,rosterFor(pair.campaign).find(op=>op.id===id),'week')}));
 for(const quote of quotes){
  assert.ok(quote.available&&quote.price>0);
  pair=campaignOrder(pair,{type:'recruitCivic',id:quote.id,term:'week',destination:'retiro'},history);
 }
 assert.equal(pair.campaign.resources.treasury,cash-quotes.reduce((n,quote)=>n+quote.price,0));
 assert.deepEqual(pair.campaign.hiringArrivals.map(arrival=>[arrival.operativeId,arrival.dueAt]),[[CARRIER,6],[OTHER,6]]);
 pair=campaignOrder(pair,{type:'wait',hours:6},history);
 assert.ok([CARRIER,OTHER].every(id=>pair.campaign.recruited.includes(id)));
 const paidCash=pair.campaign.resources.treasury,contracts=structuredClone(pair.campaign.contracts);
 for(const id of [CARRIER,OTHER])assert.equal(pair.campaign.contracts[id].started,6);
 const plan=cellTravelPlan(pair.campaign,CELL),departed=stamp(pair.campaign);
 assert.equal(plan.reason,null);assert.ok(plan.hours>0);assert.ok(plan.path.every(id=>id!==null));
 pair=campaignOrder(pair,{type:'travel',sector:CELL},history);
 assert.equal(pair.campaign.location,CELL);assert.equal(stamp(pair.campaign)-departed,plan.hours*3600);
 pair=campaignOrder(pair,{type:'createSquad',ids:[OTHER],name:'Segunda exploración'},history);
 const secondSquad=pair.campaign.activeSquadId;
 pair=campaignOrder(pair,{type:'selectSquad',id:'squad-1'},history);
 pair=visit(pair,history);assert.equal(pair.battle.sectorId,CELL);assert.equal(pair.battle.sourceMapId,CELL);
 assert.equal(pair.battle.units.some(unit=>unit.side==='enemy'),false);
 assert.equal(chest(pair).open,false);assert.equal(chest(pair).contents.length,2);
 const source=structuredClone(chest(pair).contents),initialKit=ammunition(actor(pair)),originalInventory=structuredClone(actor(pair).inventory),originalOutfit=structuredClone(actor(pair).outfit);
 assert.deepEqual(source.map(stack=>[stack.instanceId,stack.condition,stack.count]),[[ROADSIDE_CROWBAR_ID,60,1],[ROADSIDE_SHIRT_ID,75,1]]);
 assert.equal(initialKit.rounds,10);
 pair=approach(pair,CARRIER,history);
 pair=issue(pair,{type:'useItem',unitId:String(CARRIER),environment:{kind:'container',id:ROADSIDE_DISCOVERY_CHEST,verb:'open'}},history);
 const stale=containerLootPreview(pair.battle,actor(pair),{id:ROADSIDE_DISCOVERY_CHEST},0,1).action;
 assert.ok(stale.expectedSource,'the pickup binds the observed exact stack');
 pair=issue(pair,stale,history);assert.equal(chest(pair).contents.length,1);
 // A save between pickups retains depletion and the exact remaining shirt.
 pair=saved(pair);const repeated=actBattle(pair.battle,stale);
 rejectedWithoutCost(pair.battle,repeated,'a shifted source cannot consume the remaining shirt');
 const shirtIndex=chest(pair).contents.findIndex(stack=>stack.instanceId===ROADSIDE_SHIRT_ID);
 pair=issue(pair,containerLootPreview(pair.battle,actor(pair),{id:ROADSIDE_DISCOVERY_CHEST},shirtIndex,1).action,history);
 assert.deepEqual(chest(pair).contents,[]);
 for(const stack of source)assert.deepEqual(owned(actor(pair),stack.instanceId),payload(stack));
 for(const [key,record]of Object.entries(originalInventory))assert.deepEqual(actor(pair).inventory[key],record,'the acquisition keeps every original pocket record');
 assert.equal(Object.keys(actor(pair).inventory).length,Object.keys(originalInventory).length+source.length);
 assert.deepEqual(ammunition(actor(pair)),initialKit);
 const acquired=saved(pair),acquiredHistory=[...history];

 // The same actually acquired checkpoint permits a separate finite choice.
 // This branch is not merged back into the worn-shirt custody continuation.
 const craftHistory=[],dressings=actor(acquired).medkits,shirtKey=keyFor(actor(acquired),ROADSIDE_SHIRT_ID);
 let crafted=issue(acquired,{type:'craftDressings',unitId:String(CARRIER),inventoryKey:shirtKey,
  expectedSource:fieldDressingsSource(actor(acquired),shirtKey)},craftHistory);
 assert.equal(actor(crafted).medkits,dressings+3);assert.equal(owned(actor(crafted),ROADSIDE_SHIRT_ID),undefined);
 const consumedInventory=structuredClone(actor(acquired).inventory);delete consumedInventory[shirtKey];
 assert.deepEqual(actor(crafted).inventory,consumedInventory,'crafting consumes only the actual acquired shirt');
 assert.deepEqual(actor(crafted).outfit,originalOutfit);assert.equal(actor(crafted).hp,actor(acquired).hp);assert.equal(actor(crafted).bleeding,actor(acquired).bleeding);
 assert.deepEqual(owned(actor(crafted),ROADSIDE_CROWBAR_ID),payload(source[0]));
 assert.equal(stamp(crafted.campaign)-stamp(acquired.campaign),2);assert.deepEqual(ammunition(actor(crafted)),initialKit);
 crafted=leave(crafted,craftHistory);crafted=visit(crafted,craftHistory);
 assert.deepEqual(chest(crafted).contents,[]);assert.equal(actor(crafted).medkits,dressings+3);
 assert.equal(owned(actor(crafted),ROADSIDE_SHIRT_ID),undefined);assert.deepEqual(replay(acquired,craftHistory),crafted);

 pair=issue(pair,{type:'equipLoot',unitId:String(CARRIER),inventoryKey:shirtKey,slot:'outfit'},history);
 assert.deepEqual(actor(pair).outfit,payload(source[1]));
 assert.deepEqual(Object.values(actor(pair).inventory).filter(record=>record.kind==='outfit'&&record.outfit===originalOutfit.outfit),[originalOutfit]);
 const toolKey=keyFor(actor(pair),ROADSIDE_CROWBAR_ID);
 pair=issue(pair,{type:'weapon',unitId:String(CARRIER),slot:'tool',toolKey:`inventory:${toolKey}`},history);
 assert.equal(heldTool(actor(pair)).condition,60);
 pair=leave(pair,history);
 assert.deepEqual(pair.campaign.operativeState[CARRIER].outfit,payload(source[1]));
 assert.deepEqual(owned(pair.campaign.operativeState[CARRIER],ROADSIDE_CROWBAR_ID),payload(source[0]));
 pair=campaignOrder(pair,{type:'selectSquad',id:secondSquad},history);pair=visit(pair,history);
 assert.deepEqual(pair.battle.units.filter(unit=>unit.side==='player').map(unit=>unit.id),[String(OTHER)]);
 assert.equal(chest(pair).open,true);assert.deepEqual(chest(pair).contents,[]);
 const otherKit=ammunition(actor(pair,OTHER));assert.equal(otherKit.rounds,10);
 assert.equal(owned(actor(pair,OTHER),ROADSIDE_CROWBAR_ID),undefined);assert.equal(owned(actor(pair,OTHER),ROADSIDE_SHIRT_ID),undefined);
 pair=approach(pair,OTHER,history);
 const missing=actBattle(pair.battle,{type:'containerLoot',unitId:String(OTHER),kind:'container',id:ROADSIDE_DISCOVERY_CHEST,index:0,count:1});
 rejectedWithoutCost(pair.battle,missing,'the other squad cannot duplicate an exhausted item');
 pair=leave(pair,history);assert.deepEqual(campaignAmmunition(pair,OTHER),otherKit);
 pair=campaignOrder(pair,{type:'selectSquad',id:'squad-1'},history);
 const returnPlan=cellTravelPlan(pair.campaign,'retiro'),returnAt=stamp(pair.campaign);
 pair=campaignOrder(pair,{type:'travel',sector:'retiro'},history);
 assert.equal(pair.campaign.location,'retiro');assert.equal(stamp(pair.campaign)-returnAt,returnPlan.hours*3600);
 const restAt=stamp(pair.campaign),healthBeforeRest=health(pair),restCash=pair.campaign.resources.treasury;
 if(pair.campaign.operativeState[CARRIER].fatigue>0){
  if(!pair.campaign.operativeState[CARRIER].asleep)pair=campaignOrder(pair,{type:'setSleep',operativeId:CARRIER,asleep:true},history);
  for(let hour=0;pair.campaign.operativeState[CARRIER].asleep&&hour<16;hour++)pair=campaignOrder(pair,{type:'wait',hours:1},history);
  assert.equal(pair.campaign.operativeState[CARRIER].asleep,false,'actual finite rest completes before another march');
 }
 const sleepSeconds=stamp(pair.campaign)-restAt,healthAfterRest=health(pair);
 assert.deepEqual(healthAfterRest,healthBeforeRest);assert.equal(pair.campaign.resources.treasury,restCash);
 pair=campaignOrder(pair,{type:'travel',sector:CELL},history);pair=visit(pair,history);
 assert.deepEqual(chest(pair).contents,[]);assert.equal(chest(pair).open,true);
 assert.deepEqual(actor(pair).outfit,payload(source[1]));assert.deepEqual(owned(actor(pair),ROADSIDE_CROWBAR_ID),payload(source[0]));
 assert.deepEqual(ammunition(actor(pair)),initialKit);assert.equal(heldTool(actor(pair)).condition,60);
 assert.deepEqual(campaignAmmunition(pair,OTHER),otherKit);
 for(const [key,record]of Object.entries(originalInventory))assert.deepEqual(actor(pair).inventory[key],record);
 assert.deepEqual(Object.values(actor(pair).inventory).filter(record=>record.kind==='outfit'&&record.outfit===originalOutfit.outfit),[originalOutfit]);
 assert.equal(pair.campaign.resources.treasury,paidCash);assert.deepEqual(pair.campaign.contracts,contracts);
 const dead=pair.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0).map(unit=>Number(unit.id)).sort((a,b)=>a-b);
 assert.deepEqual(dead,[CARRIER].filter(id=>!pair.campaign.operativeState[id].alive));
 assert.deepEqual(replay(initial,history),pair,'all ordinary paid orders reproduce the full saved campaign and current scene');
 assert.deepEqual(replay(initial,acquiredHistory),acquired);
 t.diagnostic(JSON.stringify({scenario:'fresh pinned default campaign; actual paid arrival and field marches; no granted resources or outcomes',
  hires:quotes.map(({id,price})=>({id,price})),treasury:paidCash,arrivalHour:6,outboundHours:plan.hours,returnHours:returnPlan.hours,
  finalHour:pair.campaign.hour,finalSecond:pair.campaign.secondOfHour,orderCount:history.length,actionSeconds:stamp(pair.campaign)-stamp(initial.campaign),
  sleepSeconds,sleepHours:sleepSeconds/3600,healthBeforeRest,healthAfterRest,
  rounds:[{id:CARRIER,count:actor(pair).loaded+ammoCount(actor(pair))},{id:OTHER,count:otherKit.rounds}],hp:health(pair),
  crowbar:owned(actor(pair),ROADSIDE_CROWBAR_ID),shirt:actor(pair).outfit,remaining:chest(pair).contents.length,craftChoiceDressings:dressings+3,dead}));
});
