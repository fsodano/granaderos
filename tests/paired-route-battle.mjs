import assert from 'node:assert/strict';
import {actBattle,endTurn} from '../packages/game/tactical.js';
import {sectorDeploymentAction} from '../packages/game/sector-deployment.js';
import {enterSector} from '../packages/game/world.js';
import {syncBattleTime} from '../packages/game/time.js';
import {encodeSave,decodeSave} from '../packages/game/save.js';
import {fight} from './opening-driver.mjs';

const nativeOrder=(battle,action)=>['placeDeployment','confirmDeployment'].includes(action.type)?sectorDeploymentAction(battle,action):action.type==='endTurn'?endTurn(battle):actBattle(battle,action);
const synchronized=(campaign,battle)=>{
 const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);
 return {campaign:next.campaign,battle:next.battle};
};

// Entry matches prepareCampaignBattle; top-level orders match commitBattle,
// without character speech or internal presentation frames. Each reducer
// receives BOTH actual returned states, including zero-order visits.
export function createPairedRouteOrders(campaign,battle=null){
 let pair=battle?synchronized(campaign,battle):null;const orders=[];
 const admitBattle=current=>{assert.equal(pair,null);pair=synchronized(campaign,current);return pair.battle;};
 const executeOrder=(current,action)=>{
  assert.ok(pair,'Admit both native states before the first public order.');
  assert.equal(current,pair.battle,'An actual order must continue the current synchronized battle.');
  const next=nativeOrder(current,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  pair=synchronized(pair.campaign,next);orders.push(structuredClone(action));return pair.battle;
 };
 return {admitBattle,executeOrder,orders,get pair(){return pair;}};
}

export function replayPairedRouteOrders(campaign,request,previous,orders,{placement=false}={}){
 let replay=synchronized(campaign,enterSector(request,previous,{placement}));
 for(const [index,action]of orders.entries()){
  const next=nativeOrder(replay.battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  replay=synchronized(replay.campaign,next);
  if(index===Math.floor(orders.length/2))replay=decodeSave(encodeSave(replay.campaign,replay.battle));
 }
 return replay;
}

// Opt-in route execution reuses the unchanged ordinary policy and native
// 600-window/80-turn/16-pass bounds. Default fight has no paired bridge.
export function fightPairedRouteBattle(campaign,request,previous,{controller,sharedFallback,deploy,observeOrder=null,onNativeResult=()=>{},onExecution=()=>{}}={}){
 const before=structuredClone(campaign),oldScene=structuredClone(previous),bridge=createPairedRouteOrders(campaign);
 const executeOrder=observeOrder?(current,action)=>{
  const after=bridge.executeOrder(current,action);observeOrder({before:current,after,action,index:bridge.orders.length-1});return after;
 }:bridge.executeOrder;
 const deployment=deploy?battle=>{
  const next=deploy(battle,executeOrder);assert.equal(next,bridge.pair?.battle,'Deployment must return the actual last public order result.');return next;
 }:undefined;
 const native=fight(request,previous,{controller,sharedFallback,deploy:deployment,executeOrder,admitBattle:bridge.admitBattle});
 const pair=bridge.pair,result={...native,orders:bridge.orders,pair};
 // A passive opt-in can retain the COMPLETE actual result and tape before
 // any pair identity or replay assertion throws. It issues no further order.
 onNativeResult({result});
 assert.ok(pair);assert.equal(native.battle,pair.battle);
 const replay=replayPairedRouteOrders(campaign,request,previous,result.orders,{placement:Boolean(deploy)});
 onExecution({result,replay});
 assert.deepEqual(replay,pair,'Every actual deployment, boundary crossing and combat order replays through the official midpoint save.');
 assert.deepEqual(campaign,before,'Paired native execution preserves its original campaign input.');assert.deepEqual(previous,oldScene);
 return result;
}
