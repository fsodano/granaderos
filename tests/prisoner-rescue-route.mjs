import assert from 'node:assert/strict';
import {start,sync,order} from './prisoner-rescue-fixture.mjs';
import {actBattle,endTurn,getReachable,teamCanSee,prisonerReleasePreview,exitPreview,interruptAvailable,stanceCost} from '../game/tactical.js';
import {automaticOrder} from '../game/autonomous-orders.js';
import {combatOrder} from './opening-driver.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function runPrisonerRescue(){
let {campaign,battle}=start({custodySupplies:2}),orders=[],seen=new Map(),savedDepartures=0;
const initial=structuredClone({campaign,battle});
function toward(b,u,predicate){
 if(u.stance!=='standing')return b.mode==='exploration'||u.ap>=stanceCost(u,'standing')?{type:'stance',unitId:u.id,stance:'standing'}:null;
 const route=getReachable({...b,mode:'exploration'},u,{stopAt:predicate})[0];if(!route?.path.length)return null;
 const reachable=getReachable(b,u),point=[...route.path].reverse().map(p=>reachable.find(q=>q.x===p.x&&q.y===p.y&&q.tacticalLevel===p.tacticalLevel)).find(p=>p?.path.length&&(b.mode==='exploration'||p.cost<=u.ap));
 return point?{type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0}:null;
}
function rescueOrder(b,u){
 // Clear the guards with the paid gun and its infantry screen before moving
 // prisoners. This route verifies a guarded rescue, not an unseen escape.
 if(!b.sectorCleared)return mountainBatteryOrder(b,u,{leaderId:'112',helperId:'none',screenDistance:3});
 for(const n of b.npcs.filter(n=>n.detention&&(teamCanSee(b,'player',n)||n.detention.freed)))seen.set(n.id,structuredClone(n));
 const following=b.npcs.find(n=>n.detention?.freed&&!n.departure&&n.escort?.leaderId===u.id&&n.hp>=15&&!n.unconscious);
 if(following){
  const preview=exitPreview(b,{unitIds:[u.id],exitId:'humahuaca:jujuy'});
  if(preview.available&&preview.prisoners.some(n=>n.id===following.id&&n.ready))return {type:'exit',unitIds:[u.id],exitId:'humahuaca:jujuy'};
  if(distance(u,following)>1.5)return null;
  if(u.x===b.width-1)return toward(b,u,p=>p.x===b.width-1&&Math.abs(p.y-u.y)===2);
  return toward(b,u,p=>p.x===b.width-1);
 }
 const remaining=[...seen.values()].filter(n=>!n.detention.freed&&n.hp>=15&&!n.unconscious),known=remaining.sort((a,c)=>distance(u,a)-distance(u,c))[0],prisoner=known&&b.npcs.find(n=>n.id===known.id);
 if(prisoner&&prisonerReleasePreview(b,u,prisoner).valid)return {type:'free',unitId:u.id,targetKind:'npc',targetId:prisoner.id};
 if(seen.size===initial.campaign.pendingBattle.detainedPrisoners.length&&!remaining.length){
  if(exitPreview(b,{unitIds:[u.id],exitId:'humahuaca:jujuy'}).available)return {type:'exit',unitIds:[u.id],exitId:'humahuaca:jujuy'};
  return toward(b,u,p=>p.x===b.width-1);
 }
 if(!prisoner)return combatOrder(b,u)??automaticOrder(b,u);
 if(distance(u,prisoner)>6&&!b.npcs.some(n=>n.detentionEscape))return combatOrder(b,u)??automaticOrder(b,u);
 if(prisoner&&distance(u,prisoner)<=1.5&&u.stance==='prone')return {type:'stance',unitId:u.id,stance:'standing'};
 const fighting=combatOrder(b,u);if(fighting&&['fire','reprime','reload','heal','useItem'].includes(fighting.type))return fighting;
 const target=prisoner??{x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 return toward(b,u,p=>distance(p,target)<=1.5);
}
for(let window=0;window<400&&battle.turn<65&&!['defeat','retreat'].includes(battle.status);window++){
 if(battle.status==='victory'){orders.push({type:'explore',turn:battle.turn,mode:battle.mode});battle=actBattle(battle,{type:'explore'});assert.equal(battle.lastError,null);}
 for(let pass=0;pass<12&&battle.status==='active';pass++){
  let acted=false;
  for(const id of ['123','115','110','114','113','112']){
   const u=battle.units.find(u=>u.id===id);if(!interruptAvailable(battle,u)||battle.mode!=='exploration'&&u.ap<3)continue;
   const action=rescueOrder(battle,u);if(!action)continue;
   const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
   orders.push({turn:battle.turn,mode:battle.mode,...action});battle=next;acted=true;
   if(action.type==='exit'){const pair=sync(campaign,battle);({campaign,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));savedDepartures++;}
   if(battle.status!=='active')break;
  }
  if(!acted)break;
 }
 if(battle.status==='active'){orders.push({type:'endTurn',turn:battle.turn,mode:battle.mode});battle=endTurn(battle);assert.equal(battle.lastError,null);}
}
assert.equal(battle.status,'retreat','the entire relief force must physically leave or fall');
// Morale can also end a battle in retreat. That outcome alone does not prove
// that the prisoners were released or that anyone reached the physical exit.
for(const original of initial.battle.npcs.filter(n=>n.detention)){
 const prisoner=battle.npcs.find(n=>n.id===original.id);
 assert.ok(prisoner?.hp>0&&prisoner.detention.freed&&prisoner.departure?.destination==='jujuy',`${original.name} must leave alive through the Jujuy exit`);
}
assert.ok(savedDepartures>0,'the rescue must record physical evacuation orders');
const paired=sync(campaign,battle),restored=decodeSave(encodeSave(paired.campaign,paired.battle));
campaign=order(restored.campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
return {initial,campaign,battle,orders,savedDepartures};
}
