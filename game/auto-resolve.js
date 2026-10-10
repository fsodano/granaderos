import {enterSector} from './world.js';
import {completedTacticalVictory,actBattle,endTurn,interruptAvailable,getReachable,exitPreview} from './tactical.js';
import {automaticOrder} from './autonomous-orders.js';
import {boundaryPassable} from './tactical-exits.js';
const able=u=>u.hp>=15&&!u.unconscious&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled;


function withdrawalOrder(b,u){
 if(!able(u)||!interruptAvailable(b,u))return null;
 for(const exit of b.exits??[])if(exitPreview(b,{unitIds:[u.id],exitId:exit.id}).available)return {type:'exit',unitIds:[u.id],exitId:exit.id};
 if(u.knockedDown)return {type:'stance',unitId:u.id,stance:'standing'};
 if(u.entangled)return {type:'free',unitId:u.id};
 // Read beyond the current turn's budget to choose a real boundary route.
 // Only an affordable prefix is ever sent to the ordinary movement reducer.
 const routes=getReachable({...b,mode:'exploration'},u).flatMap(point=>(b.exits??[]).filter(exit=>boundaryPassable(b,point,exit.edge)).map(exit=>({...point,exit})));
 routes.sort((a,c)=>a.cost-c.cost||a.exit.id.localeCompare(c.exit.id)||a.y-c.y||a.x-c.x);
 const route=routes[0];if(!route?.path.length)return null;
 const reachable=getReachable(b,u),step=[...route.path].reverse().map(point=>reachable.find(p=>p.x===point.x&&p.y===point.y)).find(p=>p?.path.length);
 return step?{type:'move',unitId:u.id,x:step.x,y:step.y}:null;
}

/** Bounded legal evacuation. Failure keeps the unfinished encounter intact. */
export function withdrawAutomatically(state,{maxRounds=8}={}){
 if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>8)throw Error('La retirada automática admite de 1 a 8 turnos.');
 let battle=state,rounds=0,windows=0;
 const orders=[];
 if(!battle.exits?.length||battle.status!=='active')return {battle,orders,rounds};
 const startTurn=battle.turn;
 while(battle.status==='active'&&rounds<maxRounds&&windows++<128){
  const ids=battle.units.filter(u=>u.side==='player'&&!u.militia&&able(u)).map(u=>u.id);
  for(const id of ids)for(let attempt=0;attempt<6&&battle.status==='active';attempt++){
   const unit=battle.units.find(u=>u.id===id),action=withdrawalOrder(battle,unit);if(!action)break;
   const next=actBattle(battle,action);if(next.lastError)break;
   orders.push(action);battle=next;
   if(battle.phase==='interrupt')break;
  }
  if(battle.status!=='active'||battle.mode==='exploration')break;
  const next=endTurn(battle);if(next.lastError)break;
  orders.push({type:'endTurn'});battle=next;rounds=battle.turn-startTurn;
 }
 return {battle,orders,rounds};
}

// This runs ordinary orders through the same engine as manual combat. It does
// not invent hits, restore ammunition, or turn a timeout into a victory.
export function autoResolve(request,previous=null,{maxRounds=80}={}){
 if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>80)throw Error('El límite de resolución debe ser de 1 a 80 turnos.');
 let battle=enterSector(request,previous),actions=0,windows=0;
 while(battle.status==='active'&&!completedTacticalVictory(battle)&&battle.turn<=maxRounds&&windows++<600){
  const ids=battle.units.filter(u=>u.side==='player'&&!u.militia).sort((a,b)=>(b.marksmanship??0)-(a.marksmanship??0)||String(a.id).localeCompare(String(b.id))).map(u=>u.id);
  for(const id of ids)for(let attempts=0;attempts<16&&battle.status==='active'&&!completedTacticalVictory(battle);attempts++){
   const unit=battle.units.find(u=>u.id===id);if(!interruptAvailable(battle,unit)||unit.ap<3)break;
   const action=automaticOrder(battle,unit);if(!action)break;
   const next=actBattle(battle,action);if(next.lastError)break;battle=next;actions++;
  }
  if(battle.status==='active'&&!completedTacticalVictory(battle)){const next=endTurn(battle);if(next.lastError)break;battle=next;}
 }
 const timedOut=battle.status==='active'&&!completedTacticalVictory(battle);
 const withdrawal=timedOut?withdrawAutomatically(battle):{battle,orders:[],rounds:0};
 battle=withdrawal.battle;actions+=withdrawal.orders.filter(order=>order.type!=='endTurn').length;
 return {battle,outcome:completedTacticalVictory(battle)?'victory':battle.status==='active'?null:battle.status,actions,rounds:Math.min(battle.turn,maxRounds),timedOut,withdrawalRounds:withdrawal.rounds};
}
