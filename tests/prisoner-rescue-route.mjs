import assert from 'node:assert/strict';
import {start,sync,order} from './prisoner-rescue-fixture.mjs';
import {actBattle,endTurn,getReachable,teamCanSee,prisonerReleasePreview,exitPreview,interruptAvailable,stanceCost,firearmShotOptions,actionCosts} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {combatOrder} from './opening-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {encodeSave,decodeSave} from '../game/save.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function runPrisonerRescue(){
let {campaign,battle}=start({custodySupplies:2}),orders=[],seen=new Map(),savedDepartures=0;
const riskChoices=[];
const initial=structuredClone({campaign,battle});
// Keep each canonical gun with a profile-sized crew and a lateral infantry
// screen. Replacements use actual survivors; no paid bodies or gear change.
const batteryOrder=coastalBatteryController(initial.battle,{sharedArtillerySight:true});
function toward(b,u,predicate){
 if(u.stance!=='standing')return b.mode==='exploration'||u.ap>=stanceCost(u,'standing')?{type:'stance',unitId:u.id,stance:'standing'}:null;
 const route=getReachable({...b,mode:'exploration'},u,{stopAt:predicate})[0];if(!route?.path.length)return null;
 const reachable=getReachable(b,u),point=[...route.path].reverse().map(p=>reachable.find(q=>q.x===p.x&&q.y===p.y&&q.tacticalLevel===p.tacticalLevel)).find(p=>p?.path.length&&(b.mode==='exploration'||p.cost<=u.ap));
 return point?{type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0}:null;
}
function riskAwareBatteryOrder(b,u){
 const action=batteryOrder(b,u);if(action?.type!=='fire')return action;
 const target=b.units.find(v=>v.id===action.targetId),risk=firearmBystanderRisk(b,u,target,action.hitLocation??'torso');
 const direct=risk.direct.some(v=>v.kind==='npc');if(!direct&&!risk.scatter.some(v=>v.kind==='npc'))return action;
 const proposed=firearmShotOptions(b,u,target,action.aim??0).find(o=>o.aim===(action.aim??0)&&o.hitLocation===(action.hitLocation??'torso'));
 // Prefer the best affordable known safe shot, even when it has less force
 // than the proposed shot. Waiting for comparable damage can expose the
 // scout while a scattered pellet can reach a prisoner beyond the guard.
 const shots=[];
 for(const t of b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.departure&&!v.unconscious&&!v.surrendered&&teamCanSee(b,'player',v))){
  const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
  for(const o of firearmShotOptions(b,u,t,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim)))){
   const score=o.chance*o.damageFactor;if(o.chance<5||o.damageFactor<=0)continue;
   const knownRisk=firearmBystanderRisk(b,u,t,o.hitLocation);if([...knownRisk.direct,...knownRisk.scatter].some(v=>v.kind==='npc'))continue;
   shots.push({score,preview:o,risk:knownRisk,action:{type:'fire',unitId:u.id,targetId:t.id,aim:o.aim,hitLocation:o.hitLocation}});
  }
 }
 const selected=shots.sort((a,c)=>c.score-a.score)[0];
 if(selected){riskChoices.push({orderIndex:orders.length,turn:b.turn,proposed:{action,preview:proposed,risk},selected});return selected.action;}
 return null;
}
function rescueOrder(b,u){
 // Clear the guards with the paid gun and its infantry screen before moving
 // prisoners. This route verifies a guarded rescue, not an unseen escape.
 if(!b.sectorCleared)return riskAwareBatteryOrder(b,u);
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
 if(!prisoner)return toward(b,u,p=>Math.hypot(p.x-Math.floor(b.width*.65),p.y-Math.floor(b.height*.5))<=2);
 if(prisoner&&distance(u,prisoner)<=1.5&&u.stance==='prone')return {type:'stance',unitId:u.id,stance:'standing'};
 const fighting=combatOrder(b,u);if(fighting&&['fire','reprime','reload','heal','useItem'].includes(fighting.type))return fighting;
 const target=prisoner??{x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 return toward(b,u,p=>distance(p,target)<=1.5);
}
for(let window=0;window<400&&battle.turn<65&&!['defeat','retreat'].includes(battle.status);window++){
 if(battle.status==='victory'){orders.push({type:'explore',turn:battle.turn,battleMode:battle.mode});battle=actBattle(battle,{type:'explore'});assert.equal(battle.lastError,null);}
 for(let pass=0;pass<12&&battle.status==='active';pass++){
  let acted=false;
  // Let the strongest marksmen act first after contact. Exploration keeps
  // the original crew approach; every selected order still pays its cost.
  const actorIds=battle.mode==='combat'?battle.units.filter(u=>u.side==='player').sort((a,c)=>c.marksmanship-a.marksmanship||String(a.id).localeCompare(String(c.id))).map(u=>u.id):['112','123','115','110','114','113'];
  for(const id of actorIds){
   const u=battle.units.find(u=>u.id===id);if(!interruptAvailable(battle,u)||battle.mode!=='exploration'&&u.ap<3)continue;
   const action=rescueOrder(battle,u);if(!action)continue;
   const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
   orders.push({turn:battle.turn,battleMode:battle.mode,...action});battle=next;acted=true;
   if(action.type==='exit'){const pair=sync(campaign,battle);({campaign,battle}=decodeSave(encodeSave(pair.campaign,pair.battle)));savedDepartures++;}
   if(battle.status!=='active')break;
  }
  if(!acted)break;
 }
 if(battle.status==='active'){orders.push({type:'endTurn',turn:battle.turn,battleMode:battle.mode});battle=endTurn(battle);assert.equal(battle.lastError,null);}
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
return {initial,campaign,battle,orders,savedDepartures,riskChoices};
}
