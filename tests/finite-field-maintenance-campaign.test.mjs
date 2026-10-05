import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {actBattle,presentedActBattle,firearmMaintenancePreview} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {ammoCount} from '../game/ammo-types.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {battleFromRequest} from '../game/battle-handoff.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const ID=110,KIT='cache:retiro:repair-kit',CACHE='retiro:armory-cache';
const actor=pair=>pair.battle.units.find(unit=>unit.id===String(ID));
const kit=unit=>Object.values(unit.inventory??{}).find(item=>item.instanceId===KIT);
const chest=pair=>pair.battle.props.find(prop=>prop.id===CACHE);
const rounds=unit=>unit.loaded+ammoCount(unit);
const clock=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);

function event(pair,action,history){
 const before=structuredClone(pair);let next;
 if(action.kind==='campaign')next=saved({campaign:order(pair.campaign,action.order)});
 else if(action.kind==='visit')next=visit(pair.campaign);
 else if(action.kind==='cache')next=takeFiniteCache(pair,ID,[{kind:'repair-kit'}]);
 else if(action.kind==='sync')next=sync(pair);
 else if(action.kind==='leave')next=saved({campaign:leave(pair)});
 else{
  const battle=actBattle(pair.battle,action.order);assert.equal(battle.lastError,null,battle.lastError);
  assert.deepEqual(presentedActBattle(pair.battle,action.order).state,battle,'presentation preserves the entire ordinary order result');
  next=saved(sync({campaign:pair.campaign,battle}));
 }
 assert.deepEqual(pair,before,'ordinary route helpers preserve their input');
 history?.push(structuredClone(action));return next;
}
const tactical=(pair,action,history)=>event(pair,{kind:'tactical',order:{unitId:String(ID),...action}},history);

function paidArrival(){
 const start=saved({campaign:initialCampaign(45,defaultContentPackage())}),quote=contractQuote(start.campaign,rosterFor(start.campaign).find(op=>op.id===ID),'week'),history=[];
 assert.ok(quote.available&&quote.price>0);
 let pair=event(start,{kind:'campaign',order:{type:'recruitCivic',id:ID,term:'week'}},history);
 assert.equal(pair.campaign.recruited.includes(ID),false,'booking does not bypass the real arrival');
 pair=event(pair,{kind:'campaign',order:{type:'wait',hours:6}},history);
 assert.ok(pair.campaign.recruited.includes(ID));assert.equal(pair.campaign.contracts[ID].paid,quote.price);
 assert.equal(pair.campaign.resources.treasury,3200-quote.price);assert.equal(pair.campaign.operativeState[ID].hp,85);
 return {start,pair,quote,history};
}

function acquireKit(pair,history){
 pair=event(pair,{kind:'visit'},history);
 assert.ok(chest(pair).contents.some(item=>item.instanceId===KIT&&item.repairPoints===100));
 pair=event(pair,{kind:'cache'},history);
 assert.equal(kit(actor(pair)).repairPoints,100);assert.equal(kit(actor(pair)).count,1);
 assert.equal(chest(pair).contents.some(item=>item.instanceId===KIT),false);
 return pair;
}

function discharge(pair,history){
 const before=structuredClone(pair),point={x:25,y:16},risk=firearmBystanderRisk(pair.battle,actor(pair),point);
 assert.deepEqual(risk,{direct:[],scatter:[]},'the actual observed empty-ground order threatens no known person');
 for(let attempt=0;rounds(actor(pair))===rounds(actor(before))&&attempt<6;attempt++){
  if(actor(pair).jammed)pair=tactical(pair,{type:'reprime'},history);
  if(!actor(pair).loaded)pair=tactical(pair,{type:'reload'},history);
  pair=tactical(pair,{type:'firePoint',...point},history);
 }
 assert.equal(rounds(actor(pair)),rounds(actor(before))-1,'one actual finite cartridge discharged');
 assert.equal(actor(pair).condition,actor(before).condition-1);
 assert.equal(actor(pair).hp,actor(before).hp);assert.equal(actor(pair).bleeding,actor(before).bleeding);
 assert.deepEqual(pair.battle.npcs.map(n=>({id:n.id,hp:n.hp})),before.battle.npcs.map(n=>({id:n.id,hp:n.hp})));
 return pair;
}

function maintain(pair,history){
 const before=structuredClone(pair),preview=firearmMaintenancePreview(pair.battle,actor(pair));
 assert.ok(preview.valid,preview.reason);assert.ok(preview.gain>0&&preview.materialCost>0);
 pair=tactical(pair,{type:'repair'},history);
 assert.equal(actor(pair).condition,actor(before).condition+preview.gain);
 assert.equal(repairMaterialPoints(actor(pair)),repairMaterialPoints(actor(before))-preview.materialCost);
 assert.equal(rounds(actor(pair)),rounds(actor(before)));
 for(const field of ['hp','bleeding','bandaged','loaded','ammo','rations','medkits','torches','weapon','weaponInstanceId','weaponFittings','outfit','headwear','legwear'])assert.deepEqual(actor(pair)[field],actor(before)[field],field);
 assert.equal(actor(pair).ap,actor(before).ap,'a real exploration order pays time instead of turn AP');
 assert.equal(pair.battle.elapsedSeconds-before.battle.elapsedSeconds,Math.max(1,Math.ceil(preview.pa*.06)));
 assert.equal(clock(pair.campaign)-clock(before.campaign),pair.battle.elapsedSeconds-before.battle.elapsedSeconds);
 assert.equal(pair.battle.seed,before.battle.seed,'maintenance creates no ballistic random draws');
 assert.equal(pair.campaign.resources.treasury,before.campaign.resources.treasury);
 assert.deepEqual(pair.campaign.contracts,before.campaign.contracts);
 return pair;
}

function replay(start,history,expected){let pair=saved(start);for(const action of history)pair=event(pair,action);assert.deepEqual(pair,expected,'the complete official saved route reproduces custody and every ordinary order');}

test('a real paid native hire acquires the finite Retiro toolkit, repairs actual firearm wear and retains the spent kit through saved return and reentry',t=>{
 const paid=paidArrival();let pair=acquireKit(paid.pair,paid.history);
 const initial=structuredClone(actor(pair)),cash=pair.campaign.resources.treasury,startSeconds=pair.battle.elapsedSeconds;
 assert.equal(initial.condition,100);assert.equal(initial.toolkitPoints,0);assert.equal(rounds(initial),10);
 for(let shot=0;shot<3;shot++)pair=discharge(pair,paid.history);
 assert.equal(actor(pair).condition,97);assert.equal(rounds(actor(pair)),7);
 const beforeRepair=pair.battle.elapsedSeconds;pair=maintain(pair,paid.history);
 assert.equal(actor(pair).condition,100);assert.deepEqual(kit(actor(pair)),{...kit(initial),repairPoints:97});
 const final=structuredClone(actor(pair)),seconds=pair.battle.elapsedSeconds-startSeconds,repairSeconds=pair.battle.elapsedSeconds-beforeRepair;
 pair=event(pair,{kind:'leave'},paid.history);
 assert.equal(pair.campaign.operativeState[ID].condition,100);assert.equal(pair.campaign.operativeState[ID].toolkitPoints,0);
 assert.deepEqual(kit(pair.campaign.operativeState[ID]),kit(final));
 pair=event(pair,{kind:'visit'},paid.history);
 assert.deepEqual(kit(actor(pair)),kit(final));assert.equal(actor(pair).condition,100);assert.equal(rounds(actor(pair)),7);
 assert.equal(actor(pair).hp,initial.hp);assert.equal(actor(pair).bleeding,initial.bleeding);assert.equal(pair.campaign.resources.treasury,cash);
 assert.equal(chest(pair).contents.some(item=>item.instanceId===KIT),false);
 replay(paid.start,paid.history,pair);
 t.diagnostic(JSON.stringify({fixture:'fresh default seed45, native Acosta hire and real Retiro chest; wear earned through actual empty-ground fire, no prepared outcome',operative:ID,price:paid.quote.price,treasury:cash,hour:pair.campaign.hour,second:pair.campaign.secondOfHour,events:paid.history.length,fieldSeconds:seconds,maintenanceSeconds:repairSeconds,condition:[100,97,actor(pair).condition],materials:[100,repairMaterialPoints(actor(pair))],rounds:[10,rounds(actor(pair))],hp:actor(pair).hp,bleeding:actor(pair).bleeding,kitInstance:kit(actor(pair)).instanceId,chestKits:chest(pair).contents.filter(item=>item.instanceId===KIT).length}));
});

test('a declared older worn-gun reserve spends its real numeric and cache materials, rejects forged resumes and never restores exhausted stock on return',t=>{
 const paid=paidArrival();
 // Declared older checkpoint, before its first official admission/visit:
 // the actual paid native gun is worn to zero and owns two legacy tool points.
 // Cash, health, kit issue, ammunition, terms and seed remain native and finite.
 const prepared=structuredClone(paid.pair.campaign);
 prepared.operativeState[ID].condition=0;prepared.operativeState[ID].toolkitPoints=2;
 const start=saved({campaign:prepared}),history=[];let pair=acquireKit(start,history);
 assert.equal(actor(pair).condition,0);assert.equal(actor(pair).toolkitPoints,2);assert.equal(repairMaterialPoints(actor(pair)),102);
 for(const value of [3,-1,undefined]){
  const forged=structuredClone(pair.battle),u=forged.units.find(unit=>unit.id===String(ID));
  if(value===undefined)delete u.toolkitPoints;else u.toolkitPoints=value;
  assert.throws(()=>decodeSave(encodeSave(pair.campaign,forged)),/herramientas|reparaci[oó]n/);
  const timed=syncBattleTime(pair.campaign,forged);assert.ok(timed.error,'even unchanged elapsed time cannot admit a forged or missing issued reserve');
  assert.deepEqual(timed.campaign,pair.campaign);assert.deepEqual(timed.battle,forged);
  const refused=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:forged,survivors:forged.units.filter(unit=>unit.side==='player')});
  assert.ok(refused.lastError);assert.deepEqual(refused.operativeState,pair.campaign.operativeState);assert.deepEqual(refused.resources,pair.campaign.resources);assert.equal(clock(refused),clock(pair.campaign));
 }
 // A separate stored continuation must be checked even when the live scene
 // still owns the valid two points and the requested clock does not advance.
 const forgedResume=structuredClone(pair.campaign);
 forgedResume.pendingBattle.resumeSnapshot=structuredClone(pair.battle);
 forgedResume.pendingBattle.resumeSnapshot.units.find(unit=>unit.id===String(ID)).toolkitPoints=3;
 const priorResume=structuredClone(forgedResume);
 assert.throws(()=>decodeSave(encodeSave(forgedResume,pair.battle)),/herramientas|reparaci[oó]n/);
 assert.throws(()=>battleFromRequest(forgedResume.pendingBattle,forgedResume),/herramientas|reparaci[oó]n/);
 const resumedTime=syncBattleTime(forgedResume,pair.battle);assert.ok(resumedTime.error);
 assert.deepEqual(resumedTime.campaign,forgedResume);assert.deepEqual(resumedTime.battle,pair.battle);
 const discardedResume=dispatchCampaign(forgedResume,{type:'syncTacticalTime',battleId:forgedResume.pendingBattle.id,elapsedSeconds:pair.battle.elapsedSeconds});
 assert.ok(discardedResume.lastError);assert.deepEqual({...discardedResume,lastError:forgedResume.lastError},forgedResume);
 assert.deepEqual(forgedResume,priorResume,'a rejected stored continuation cannot mutate its input');
 const before=structuredClone(pair),cash=pair.campaign.resources.treasury,startSeconds=pair.battle.elapsedSeconds;
 pair=maintain(pair,history);assert.equal(actor(pair).toolkitPoints,0);assert.equal(kit(actor(pair)).repairPoints,72);
 // Establish the normal trusted clock path after the accepted spend. One
 // forged point is within the original two-point issue but must not reappear.
 pair=event(pair,{kind:'sync'},history);
 const spent=structuredClone(pair),forged=structuredClone(pair.battle);
 forged.units.find(unit=>unit.id===String(ID)).toolkitPoints=1;
 assert.throws(()=>decodeSave(encodeSave(pair.campaign,forged)),/herramientas|reparaci[oó]n/);
 const timed=syncBattleTime(pair.campaign,forged);assert.ok(timed.error,'the trusted unchanged clock rejects restoration of an already spent point');
 assert.deepEqual(timed.campaign,pair.campaign);assert.deepEqual(timed.battle,forged);
 for(const action of [
  {type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:forged.elapsedSeconds,sectorState:forged},
  {type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:forged,survivors:forged.units.filter(unit=>unit.side==='player')},
 ]){
  const rejected=dispatchCampaign(pair.campaign,action);assert.ok(rejected.lastError);
  assert.deepEqual({...rejected,lastError:pair.campaign.lastError,log:pair.campaign.log},pair.campaign,'failed admission preserves the whole campaign apart from its error notice');
 }
 assert.deepEqual(pair,spent,'forged successors cannot mutate the accepted spent checkpoint');
 for(let work=0;work<3;work++)pair=maintain(pair,history);
 assert.equal(actor(pair).condition,100);assert.equal(kit(actor(pair)).repairPoints,2);
 for(let shot=0;shot<2;shot++){pair=discharge(pair,history);pair=maintain(pair,history);}
 assert.equal(actor(pair).toolkitPoints,0);assert.equal(kit(actor(pair)),undefined);assert.equal(repairMaterialPoints(actor(pair)),0);
 pair=discharge(pair,history);assert.equal(actor(pair).condition,99);assert.equal(rounds(actor(pair)),7);
 const preview=firearmMaintenancePreview(pair.battle,actor(pair));assert.equal(preview.valid,false);
 const refused=actBattle(pair.battle,{type:'repair',unitId:String(ID)});assert.ok(refused.lastError);
 assert.deepEqual({...refused,lastError:null,log:pair.battle.log},pair.battle,'the refusal only adds its normal error and log entry');
 const final=structuredClone(actor(pair)),seconds=pair.battle.elapsedSeconds-startSeconds;
 pair=event(pair,{kind:'leave'},history);assert.equal(pair.campaign.operativeState[ID].toolkitPoints,0);assert.equal(kit(pair.campaign.operativeState[ID]),undefined);
 pair=event(pair,{kind:'visit'},history);assert.equal(actor(pair).toolkitPoints,0);assert.equal(repairMaterialPoints(actor(pair)),0);assert.equal(actor(pair).condition,99);
 assert.deepEqual(actor(pair).inventory,final.inventory);assert.equal(rounds(actor(pair)),7);assert.equal(actor(pair).hp,actor(before).hp);assert.equal(actor(pair).bleeding,actor(before).bleeding);
 assert.equal(chest(pair).contents.some(item=>item.instanceId===KIT),false);assert.equal(pair.campaign.resources.treasury,cash);
 replay(start,history,pair);
 t.diagnostic(JSON.stringify({fixture:'declared old checkpoint after real native paid arrival, before first admission: gun condition0 and legacy reserve2; kit100 physically acquired thereafter; no later resource assignments',operative:ID,price:paid.quote.price,treasury:cash,events:history.length,seconds,condition:[0,100,actor(pair).condition],materials:[102,repairMaterialPoints(actor(pair))],numericReserve:actor(pair).toolkitPoints,kitRemaining:kit(actor(pair))??null,chestKits:chest(pair).contents.filter(item=>item.instanceId===KIT).length,rounds:[rounds(actor(before)),rounds(actor(pair))],hp:actor(pair).hp,bleeding:actor(pair).bleeding}));
});
