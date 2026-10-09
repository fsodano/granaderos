import {ammoCount,ammunitionLoadsFor} from './ammo-types.js';
import {chooseArtilleryAction,holdsArtilleryPost} from './tactical-ai-artillery.js';
import {chooseGrenadeThrow} from './tactical-ai-grenades.js';
import {sameSurface,spaceKey,surfaceAt,tacticalLevel} from './tactical-space.js';
import {atHand,moveOrder,planningPoint} from './tactical-planning-space.js';
import {chooseSupplySharingAction} from './tactical-ai-sharing.js';
import {chooseGroundDressingRecovery} from './tactical-ai-medical-recovery.js';
import {choosePackedGunHandover} from './tactical-ai-gun-handover.js';
import {chooseScavengingAction} from './tactical-ai-scavenging.js';
import {chooseOwnedFirearmRepair} from './tactical-ai-repair.js';
import {directionTo,facingAllowsSight,turnAPCost} from './tactical-awareness.js';
import {getReachable, hasFirearm, canSee, hasLineOfSight, shotChance, firearmShotOptions, actionCosts, stanceCost, weaponFor, bladeFor, planEquipLoot, planSwapHands, swapHandsPreview, maxActionPoints, AP_CARRY_LIMIT, movementStepCost, climbPreview,knifeThrowPreview,meleePreview} from './tactical.js';
import {heldThrowingKnife,knifeThrowDamage} from './thrown-knife.js';
import {availableAmmunition} from './ammunition-types.js';
import {planFitBayonet} from './tactical-inventory.js';
import {shotLocationEffects,shotLocationsFor} from './targeted-combat.js';
import {reprimePlan,reloadPlan} from './tactical.js';
import {criticalFirstAidNeeded} from './first-aid.js';
import {contentWeaponOf} from './weapon-definition.js';
import {firearmServiceable} from './firearm-serviceability.js';

// Decisions use only this soldier's sight and the last place an opponent was seen.
// No randomness or state changes occur here; tactical.js applies the returned order.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const active = u => u.hp > 0 && !u.departure && !u.surrendered && !u.routed && !u.unconscious;
const compareId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
// Opponent condition is private. Threat estimates use observed held equipment.
const observedGun = u => weaponFor(u).capacity > 0 && u.loaded > 0 && !u.jammed;
const readyGun = u => observedGun(u) && firearmServiceable(u);
const observedShotChance = (state, opponent, point) => shotChance(state, {...opponent, condition:100,
  ...(opponent.offHand?{offHand:{...opponent.offHand,condition:100}}:{})}, point);

export function choosePatrolAction(state,unit) {
  if(unit.knockedDown||unit.entangled||!unit.patrolOrigin||unit.patrol===false||unit.patrolTurn===state.turn||state.turn-(unit.lastInvestigatedTurn??-10)<=1||!active(unit)||state.phase==='interrupt'||state.reactionStack?.length||holdsArtilleryPost(state,unit))return null;
  const anchor=unit.patrolOrigin;
  // Patrol one short bound per round, retaining most AP for contact. A fixed
  // post and a rotating waypoint prevent aimless drift across the whole map.
  const directions=[[0,-4],[4,0],[0,4],[-4,0]];
  const offset=[...String(unit.id)].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  if(unit.assaultPatrol){
    // Invaders search the sector rather than orbiting their arrival post.
    // These waypoints depend only on terrain dimensions and the turn clock.
    const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]];
    const corner=corners[(Math.floor((state.turn-1)/12)+offset)%corners.length];
    const goal={...planningPoint(anchor),x:Math.floor(state.width*corner[0]),y:Math.floor(state.height*corner[1])};
    const perceived={...state,units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
    const cells=getReachable(perceived,unit).filter(p=>sameSurface(p,anchor)&&p.cost>0&&p.cost<=24&&p.path.length<=3&&distance(p,goal)<distance(unit,goal));
    cells.sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost||a.y-b.y||a.x-b.x);
    return cells[0]?moveOrder(state,unit,cells[0],{patrol:true}):null;
  }
  const [dx,dy]=directions[(state.turn+offset)%4],goal={...planningPoint(anchor),x:anchor.x+dx,y:anchor.y+dy};
  const perceived={...state,units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
  const cells=getReachable(perceived,unit).filter(p=>sameSurface(p,anchor)&&p.cost>0&&p.cost<=24&&p.path.length<=3&&distance(p,anchor)<=6);
  cells.sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost||a.y-b.y||a.x-b.x);
  const next=cells[0];
  return next&&distance(next,goal)<distance(unit,goal)?moveOrder(state,unit,next,{patrol:true}):null;
}

function bestShot(state, unit, targets, budget = unit.ap) {
  if (!readyGun(unit)) return null;
  let best = null;
  for (const target of targets) {
    if (!hasLineOfSight(state, unit, target)) continue;
    const costs = actionCosts(state, unit, target);
    if (costs.fire > budget) continue;
    const maxAim = Math.min(4, Math.floor((budget - costs.fire) / costs.aim));
    for (const {aim,hitLocation,physicalHitLocation,chance,damageFactor,shots,interveningFriendly,shotLoad,expectedDamage:loadDamage} of firearmShotOptions(state,unit,target,maxAim)) {
      // One paired order discharges both hands. Never accept a known friendly
      // before or beyond the selected target on either potential ball ray.
      if(interveningFriendly||shots?.some(shot=>shot.interveningFriendly))continue;
      if(!(shots?.some(shot=>shot.chance>0)??chance))continue;
      const cost = costs.fire + aim * costs.aim;
      const base=weaponFor(unit).damage,effect=shotLocationEffects(physicalHitLocation??hitLocation,base*damageFactor,target);
      // Visible posture and mounted state can make balance loss useful. Do not
      // inspect a target's hidden AP, energy, supplies or future intentions.
      const secondary=target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0)+(effect.unhorse?20:0);
      const value=Math.min(target.hp,effect.damage)+secondary;
      let effectiveness=(shotLoad?100*Math.min(target.hp,loadDamage):chance*value)/Math.max(1,Math.min(target.hp,base));
      if(shots){
        let expectedDamage=0,expectedSecondary=0;
        for(const shot of shots){
          const impact=shotLocationEffects(shot.physicalHitLocation??hitLocation,shot.damage*shot.damageFactor,target),probability=shot.chance/100;
          expectedDamage+=shot.shotLoad?shot.expectedDamage:impact.damage*probability;
          if(!shot.shotLoad)expectedSecondary+=(target.hp-impact.damage<15?0:impact.breathLoss*.15+(impact.knockedDown?10:0)+(impact.unhorse?20:0))*probability;
        }
        effectiveness=100*(Math.min(target.hp,expectedDamage)+(expectedDamage>=target.hp?0:expectedSecondary))/Math.max(1,Math.min(target.hp,base));
      }
      const score=effectiveness-cost*.2;
      // Torso comes first on an exact tie; equal aim values preserve AP.
      if (!best || score > best.score) best = {target, chance, aim, hitLocation, cost, score, effectiveness};
    }
  }
  return best;
}

// A visible contact may offer no useful standing shot or better movement cell.
// Pay for a posture only when it leaves a useful shot this turn. This fallback
// prevents mutual idle turns without wasting finite ammunition on blind fire.
function firingPosture(state,unit,targets,currentShot){
 if(!readyGun(unit)||unit.mounted||currentShot?.effectiveness>=25||targets.some(target=>sameSurface(unit,target)&&distance(unit,target)<=2.5))return null;
 let best=null;
 for(const stance of ['crouched','prone','standing']){
  if(stance===unit.stance)continue;
  const cost=stanceCost(unit,stance);if(cost>=unit.ap)continue;
  const position={...unit,stance,weaponReady:false};
  const visible=targets.filter(target=>canSee(state,position,target));
  const shot=bestShot(state,position,visible,unit.ap-cost);
  if(!shot||shot.effectiveness<25)continue;
  const score=shot.score-cost*.2;
  if(!best||score>best.score)best={stance,score};
 }
 return best?{type:'stance',unitId:unit.id,stance:best.stance}:null;
}

export function chooseKnifeThrow(state,unit,targets){
  const knife=heldThrowingKnife(unit);if(!knife)return null;
  let best=null;
  for(const target of targets){
    if(target.side===unit.side||!active(target)||!canSee(state,unit,target))continue;
    for(const hitLocation of shotLocationsFor(target))for(let aim=0;aim<=4;aim++){
      const plan=knifeThrowPreview(state,unit,target,{aim,hitLocation});
      // Spend a finite knife only inside its useful range, with a good clear
      // chance. Known friendly bodies and cover cancel the attempt. Unknown
      // bodies remain a real risk, as they do for the player's cursor.
      if(!plan.valid||plan.chance<65||distance(unit,target)>plan.range.nominal||plan.flight.victimId!==target.id)continue;
      const effect=shotLocationEffects(hitLocation,knifeThrowDamage(unit,knife),target);
      const score=(Math.min(target.hp,effect.damage)+effect.breathLoss*.15)*plan.chance/100-plan.pa*.35;
      if(!best||score>best.score)best={target,aim,hitLocation,plan,score};
    }
  }
  if(!best)return null;
  if(best.plan.costs.stance)return {type:'stance',unitId:unit.id,stance:'standing'};
  if(best.plan.costs.turn)return {type:'look',unitId:unit.id,x:best.target.x,y:best.target.y,tacticalLevel:tacticalLevel(best.target)};
  return {type:'throwKnife',unitId:unit.id,targetId:best.target.id,aim:best.aim,hitLocation:best.hitLocation};
}

function maintenance(state, unit, costs, allowSecondary=false, maintenanceContext=null) {
  if (weaponFor(unit).capacity <= 0) return null;
  const priming=reprimePlan(unit,state);
  if (unit.jammed && firearmServiceable(unit)) return priming.hands.length ? {type: 'reprime', unitId: unit.id} : null;
  if (firearmServiceable(unit) && unit.loaded === 0 && availableAmmunition(unit,unit) > 0 && costs.reload > 0) {
    if (unit.ap >= costs.reload) return {type: 'reload', unitId: unit.id};
    // Muzzle-loading while prone can exceed a soldier's entire turn budget.
    // Pay for kneeling only when the complete reload then fits this turn.
    if (unit.stance === 'prone') {
      const kneeling = {...unit, stance: 'crouched'};
      if (unit.ap >= stanceCost(unit, 'crouched') + actionCosts(state, kneeling).reload)
        return {type: 'stance', unitId: unit.id, stance: 'crouched'};
    }
    // Keep remaining AP for reactions when next turn can finish the job.
    // Begin multi-turn work when injury prevents that, or resume work already paid.
    if (unit.ap > 0 && (unit.reloadProgress > 0 || costs.reload > maxActionPoints(state, unit) + AP_CARRY_LIMIT))
      return {type: 'reload', unitId: unit.id};
  }
  if(!firearmServiceable(unit)){
    if(priming.hands.length)return {type:'reprime',unitId:unit.id};
    const loading=reloadPlan(unit,state);
    if(loading.hands?.some(hand=>hand.hand==='offhand'&&hand.pa>0))return {type:'reload',unitId:unit.id};
  }
  return chooseOwnedFirearmRepair(state,unit,maintenanceContext) ?? (allowSecondary&&priming.hands.length ? {type:'reprime',unitId:unit.id} : null);
}

function fieldAid(state, unit, costs, targets, paths) {
  if (!(unit.medkits > 0 && unit.medical > 0)) return null;
  const prepare = unit.activeSlot === 'medical' ? 0 : costs.weapon;
  if (unit.ap < prepare + costs.heal || unit.knockedDown && prepare) return null;
  const patients = state.units.filter(other => other.side === unit.side && other.hp > 0 && (other.bleeding > 0 || criticalFirstAidNeeded(other)) &&
    !other.departure && !other.fled && !other.routed && !other.surrendered && distance(unit, other) <= 5 &&
    (other.id === unit.id || atHand(unit,other) && hasLineOfSight(state, unit, other) || canSee(state, unit, other)));
  // First stop the medic's own bleeding. For others, prefer the shortest
  // estimated time to blood loss; ties are stable across unit-array ordering.
  patients.sort((a, b) => Number(b.id === unit.id) - Number(a.id === unit.id) ||
    a.hp / a.bleeding - b.hp / b.bleeding || a.hp - b.hp || compareId(a, b));
  for (const patient of patients) {
    if (!atHand(unit,patient) || !hasLineOfSight(state, unit, patient)) continue;
    return prepare ? {type: 'weapon', unitId: unit.id, slot: 'medical'} : {type: 'useItem', unitId: unit.id, targetId: patient.id};
  }
  // A reaction can bind an adjacent wound, but does not start a rescue trip.
  if (unit.knockedDown || unit.entangled || state.phase === 'interrupt' || state.reactionStack?.length || !patients.length) return null;
  const budget = Math.min(24, unit.ap - prepare - costs.heal);
  if (budget <= 0 || targets.some(target => distance(unit, target) <= 2.5)) return null;
  const threats = targets.filter(observedGun);
  const exposure = point => threats.reduce((sum, enemy) => sum + (canSee(state, enemy, point) ? observedShotChance(state, enemy, {...unit, ...point}) : 0), 0);
  const currentExposure = exposure(unit);
  const choices = paths().filter(cell => cell.cost > 0 && cell.cost <= budget && cell.path.length <= 3 &&
    cell.path.every(point => !targets.some(target => distance(point, target) <= 2.5) && exposure(point) <= currentExposure));
  for (const patient of patients) {
    const destinations = choices.filter(cell => atHand(cell,patient) && hasLineOfSight(state, cell, patient));
    destinations.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
    if (destinations.length) return moveOrder(state,unit,destinations[0]);
  }
  return null;
}

function backupWeapon(state, unit, costs, targets) {
  if (readyGun(unit)) return null;
  const blade = bladeFor(unit);
  if (blade.usable !== false && blade.id !== 0 && targets.some(target => atHand(unit,target,blade.reach) && hasLineOfSight(state, unit, target))) return null;
  const held = weaponFor(unit);
  const serviceable = held.capacity > 0 && firearmServiceable(unit) && (unit.jammed || unit.loaded > 0 || availableAmmunition(unit,unit) > 0);
  // Do not unpack guns just to stand idle. With contact, a prepared spare can
  // permit a shot this turn when the held weapon needs a long reload.
  if (!targets.length && (serviceable || held.capacity === 0 && blade.usable !== false && blade.id !== 0)) return null;
  const candidates = [];
  if (unit.offHand?.count === 1) {
    const ownTurn = {...state, phase: unit.side === 'enemy' ? 'enemy' : 'player'};
    const swap = swapHandsPreview(ownTurn, unit);
    if (swap.valid) {
      try {
        const next = planSwapHands(unit);
        if (firearmServiceable(next))
          candidates.push({next, cost: swap.pa, order: {type: 'swapHands', unitId: unit.id}});
      } catch { /* The owned other hand must pass the same capacity and item checks. */ }
    }
  }
  if (unit.activeSlot !== 'primary' && unit.weapon && !unit.weaponDropped)
    candidates.push({next: {...unit, activeSlot: 'primary'}, cost: costs.weapon, order: {type: 'weapon', unitId: unit.id, slot: 'primary'}});
  for (const key of Object.keys(unit.inventory ?? {}).sort()) {
    try { candidates.push({next: planEquipLoot(unit, key), cost: costs.equipLoot, order: {type: 'equipLoot', unitId: unit.id, inventoryKey: key}}); }
    catch { /* Unsupported objects or a full pack cannot supply a legal swap. */ }
  }
  let best = null;
  for (const candidate of candidates) {
    if (!readyGun(candidate.next) || candidate.cost > unit.ap) continue;
    const next = {...candidate.next, ap: unit.ap - candidate.cost};
    const shot = targets.length ? bestShot(state, next, targets) : null;
    if (targets.length && (!shot || shot.effectiveness < 25)) continue;
    const score = (shot?.score ?? weaponFor(next).damage * (next.condition ?? 100) / 100) - candidate.cost * .2;
    if (!best || score > best.score) best = {...candidate, score};
  }
  return best?.order ?? null;
}

function authoredSecondary(state,unit,costs,targets){
  if((unit.activeSlot??'primary')!=='primary'||!hasFirearm(unit)||!contentWeaponOf(unit,'blade')||unit.ap<costs.weapon)return null;
  // A prone gunner keeps useful cover. Switching is a paid order; the next
  // decision uses the real hand and remaining AP, without issuing equipment.
  if(unit.stance==='prone'&&readyGun(unit))return null;
  const next={...unit,activeSlot:'blade',ap:unit.ap-costs.weapon},ownTurn={...state,phase:unit.side==='enemy'?'enemy':'player'};
  if(targets.some(target=>meleePreview(ownTurn,next,target).valid))return {type:'weapon',unitId:unit.id,slot:'blade'};
  return null;
}

function investigate(state, unit, known, costs, paths) {
  const reacting = state.phase === 'interrupt' || Boolean(state.reactionStack?.length);
  // Search in short bounds and leave a useful attack available after contact.
  // These are local AI limits, not extra movement rules or stored turn state.
  const reserve = readyGun(unit) ? costs.fire + costs.aim * 2 : costs.melee;
  const budget = Math.min(reacting ? 16 : 24, unit.ap - reserve);
  const maxSteps = reacting ? 1 : 3;
  const facing = directionTo(unit, known), turnCost = turnAPCost(unit, facing);
  if (!facingAllowsSight(unit, known, {peripheralRange: 0}) && turnCost > 0) {
    return turnCost <= unit.ap - (readyGun(unit) ? costs.fire : 0)
      ? {type: 'look', unitId: unit.id, x: known.x, y: known.y} : null;
  }
  if (atHand(unit,known,1) || budget <= 0) return null;
  const reachable = paths();
  const coverAt = point => surfaceAt(state,point)?.cover ?? 0;
  const currentDistance = distance(unit, known), currentCover = coverAt(unit);
  const currentSight = hasLineOfSight(state, unit, known);
  // A path toward the nearest reachable part of the search area permits short
  // detours around a wall, even when the first step is farther from the area.
  const goal = [...reachable].sort((a, b) => distance(a, known) - distance(b, known) || a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
  const detour = new Map((goal?.path ?? []).map((point, index) => [spaceKey(point), index + 1]));
  const choices = reachable.filter(cell => cell.cost > 0 && cell.cost <= budget && cell.path.length <= maxSteps).map(cell => {
    const cover = coverAt(cell), sight = hasLineOfSight(state, cell, known);
    const progress = currentDistance - distance(cell, known), routeProgress = detour.get(spaceKey(cell)) ?? 0;
    if (progress <= 0 && !routeProgress && cover <= currentCover) return null;
    // An interrupt is a chance to react, not a new long pursuit. Do not leave
    // cover or enter open ground exposed to the remembered area in that window.
    if (reacting && (cover < currentCover || sight && cover === 0)) return null;
    // Stop at the first view around an obstruction and reassess actual contact.
    if (!currentSight && cell.path.slice(0, -1).some(point => hasLineOfSight(state, point, known))) return null;
    const exposedSteps = cell.path.filter(point => coverAt(point) === 0 && hasLineOfSight(state, point, known)).length;
    const score = Math.max(0, progress) * 6 + Math.min(routeProgress, maxSteps) * 3
      + (cover - currentCover) * .8 + (!currentSight && sight ? 6 : 0) - exposedSteps * 3 - cell.cost * .2;
    return {cell, score};
  }).filter(choice => choice && choice.score > 0);
  choices.sort((a, b) => b.score - a.score || a.cell.cost - b.cell.cost || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
  return choices.length ? moveOrder(state,unit,choices[0].cell) : null;
}

// A remembered or observed position can justify a route through public access
// links. The unlimited search is read-only geometry planning; the next order
// remains bounded by this turn's AP and is revalidated by the reducer.
function verticalPursuit(state,unit,target,costs){
 if(!state.climbLinks?.length||unit.mounted||state.phase==='interrupt'||state.reactionStack?.length)return null;
 const stand=unit.stance!=='standing',standCost=stand?stanceCost(unit,'standing'):0;
 const reserve=readyGun(unit)?costs.fire:costs.melee-costs.meleeStance,budget=Math.min(24,unit.ap-standCost-reserve);
 if(budget<=0)return null;
 const upright=stand?{...unit,stance:'standing',movementMode:'walk'}:unit;
 const perceived={...state,mode:'exploration',units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
 const goal=getReachable(perceived,upright,{stopAt:point=>atHand(point,target)})[0];
 if(!goal?.path.length||!goal.path.some(step=>step.kind==='climb'))return null;
 const prefix=[];let spent=0,from=upright;
 for(const step of goal.path){
  if(prefix.length&&step.kind==='climb')break;
  const cost=movementStepCost(perceived,upright,from,step);if(spent+cost>budget||prefix.length>=3)break;
  spent+=cost;prefix.push(step);from=step;if(step.kind==='climb')break;
 }
 if(!prefix.length)return null;
 if(stand)return {type:'stance',unitId:unit.id,stance:'standing'};
 if(prefix[0].kind==='climb')return climbPreview({...perceived,mode:state.mode},unit,{linkId:prefix[0].linkId}).valid?{type:'climb',unitId:unit.id,linkId:prefix[0].linkId}:null;
 return moveOrder(state,unit,prefix.at(-1));
}

export function chooseEnemyAction(state, unit, {maintenanceContext=null}={}) {
  if (!unit || !active(unit) || state.status !== 'active' || unit.ap <= 0) return null;
  const costs = actionCosts(state, unit);
  const targets = state.units.filter(other => other.side !== unit.side && other.hp > 0 && !other.departure && !other.surrendered && !other.unconscious && canSee(state, unit, other)).sort(compareId);
  // Share the same perceived path search across aid, pursuit and cover choices.
  let reachable;
  const perceived={...state,units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
  const paths = () => reachable ??= getReachable(perceived, unit);
  if (unit.bleeding > 0 && unit.medkits > 0 && unit.medical > 0 && unit.activeSlot === 'medical' && unit.ap >= costs.heal) return {type: 'useItem', unitId: unit.id, targetId: unit.id};
  if (unit.knockedDown) return unit.ap >= (costs.standing ?? 12) ? {type: 'stance', unitId: unit.id, stance: 'standing'} : null;
  if (unit.entangled) return unit.ap >= (costs.free ?? 15) ? {type: 'free', unitId: unit.id} : null;
  if (unit.bleeding > 0 && unit.medkits > 0 && unit.medical > 0 && unit.ap >= costs.heal + costs.weapon) return {type: 'weapon', unitId: unit.id, slot: 'medical'};
  const aid = fieldAid(state, unit, costs, targets, paths);
  if (aid) return aid;
  const dressing=chooseGroundDressingRecovery(state,unit);
  if(dressing)return dressing;
  const cannon=chooseArtilleryAction(state,unit,targets,paths);
  if(cannon)return cannon;
  // Keep the operator at the emplacement while its helpers approach or recover AP.
  // A close threat still requires personal defence.
  if(holdsArtilleryPost(state,unit)&&!targets.some(target=>sameSurface(unit,target)&&distance(unit,target)<=2.5))return null;
  const grenade=chooseGrenadeThrow(state,unit,targets);
  if(grenade)return grenade;
  if(hasFirearm(unit)&&firearmServiceable(unit)&&!unit.loaded&&!unit.reloadProgress&&!ammoCount(unit)){const load=ammunitionLoadsFor(unit).find(load=>ammoCount(unit,load.family)>0);if(load)return {type:'selectAmmunitionLoad',unitId:unit.id,family:load.family};}
  const secondary=authoredSecondary(state,unit,costs,targets);
  if(secondary)return secondary;
  const backup = backupWeapon(state, unit, costs, targets);
  if (backup) return backup;
  if (['medical','tool','supply','item'].includes(unit.activeSlot)) {
    const slot = !unit.weaponDropped && unit.weapon ? 'primary' : unit.blade ? 'blade' : 'unarmed';
    return slot && unit.ap >= (costs.weapon ?? 4) ? {type: 'weapon', unitId: unit.id, slot} : null;
  }

  if(unit.activeSlot==='unarmed'&&unit.ap>=costs.weapon){
    const slot=!unit.weaponDropped&&unit.weapon?'primary':unit.blade?'blade':null;
    if(slot)return {type:'weapon',unitId:unit.id,slot};
  }

  const upkeep = maintenance(state, unit, costs, !targets.length, maintenanceContext);
  const move = cell => cell.path?.[0]?.kind==='climb' ? (climbPreview(perceived,unit,{linkId:cell.path[0].linkId}).valid?{type:'climb',unitId:unit.id,linkId:cell.path[0].linkId}:null) : moveOrder(state,unit,cell);

  if (!targets.length) {
    if (upkeep) return upkeep;
    const sharing = chooseSupplySharingAction(state, unit, targets, paths);
    if (sharing) return sharing;
    const scavenge = chooseScavengingAction(state, unit, targets, paths);
    if (scavenge) return scavenge;
    const known = unit.lastKnownEnemy || (unit.lastHeardNoise?{...unit.lastHeardNoise,tacticalLevel:tacticalLevel(unit)}:null);
    const age = state.turn - (known?.turn ?? -Infinity);
    if (!known || !Number.isInteger(known.x) || !Number.isInteger(known.y) || known.x < 0 || known.y < 0 || known.x >= state.width || known.y >= state.height || age < 0 || age > 3) return choosePatrolAction(state,unit);
    if(!sameSurface(unit,known))return verticalPursuit(state,unit,known,costs);
    return investigate(state, unit, known, costs, paths)||verticalPursuit(state,unit,known,costs);
  }

  const blade = bladeFor(unit);
  // A useful owned fitting is a paid inventory action, followed by a fresh
  // decision. Never fabricate a bayonet or mutate equipment while scoring.
  if (!unit.weaponFittings?.bayonet && (unit.activeSlot??'primary')==='primary' &&
      unit.ap>=costs.fitBayonet+16+costs.meleeStance && targets.some(target=>atHand(unit,target,2)&&hasLineOfSight(state,unit,target))) {
    for (const item of ['blade',...Object.keys(unit.inventory??{}).sort().map(key=>`inventory:${key}`)]) {
      try {planFitBayonet(unit,item);return {type:'fitBayonet',unitId:unit.id,item};} catch { /* Try the next owned item. */ }
    }
  }
  // The chooser also scores snapshots between turns. Actual execution retains
  // the live phase guard; planning evaluates this actor's own action window.
  const meleeState={...state,phase:unit.side==='enemy'?'enemy':'player'};
  const adjacent = targets.filter(target => meleePreview(meleeState,unit,target).valid);
  adjacent.sort((a, b) => a.hp - b.hp || distance(unit, a) - distance(unit, b) || compareId(a, b));
  // A useful shot keeps a prone rifleman behind cover. Do not force him upright
  // just because an adjacent opponent is an affordable gun-stock target.
  const proneShot=adjacent.length&&unit.stance==='prone'&&unit.weaponMode!=='melee'&&readyGun(unit)?bestShot(state,unit,targets):null;
  if(proneShot?.effectiveness>=45)return {type:'fire',unitId:unit.id,targetId:proneShot.target.id,aim:proneShot.aim,hitLocation:proneShot.hitLocation};
  if (adjacent.length && unit.ap >= costs.melee) return {type: 'melee', unitId: unit.id, targetId: adjacent[0].id};

  const knifeThrow=chooseKnifeThrow(state,unit,targets);
  if(knifeThrow)return knifeThrow;

  const shot = proneShot??bestShot(state, unit, targets);
  const support = state.units.filter(other => other.side === unit.side && active(other) && distance(unit, other) <= 8).length;
  const threats = targets.filter(observedGun);
  const outgunned = threats.length > support;
  if (shot?.effectiveness >= 45 && !outgunned) return {type: 'fire', unitId: unit.id, targetId: shot.target.id, aim: shot.aim,hitLocation:shot.hitLocation};
  if (upkeep) return upkeep;
  const sharing = chooseSupplySharingAction(state, unit, targets, paths);
  if (sharing) return sharing;
  const handover=choosePackedGunHandover(state,unit,targets,{readyGun,bestShot,backupWeapon});
  if(handover)return handover;
  const scavenge = chooseScavengingAction(state, unit, targets, paths);
  if (scavenge) return scavenge;

  if (blade.usable !== false && (weaponFor(unit).capacity <= 0 || !firearmServiceable(unit) || (!unit.loaded && !availableAmmunition(unit,unit)))) {
    // Close for an affordable melee attack; never spend the entire turn rushing
    // across open ground towards an armed enemy who can shoot on arrival.
    const reacting = state.phase === 'interrupt' || Boolean(state.reactionStack?.length);
    const contacts = paths().filter(cell => cell.cost > 0 && cell.cost + costs.melee <= unit.ap && (!reacting || cell.path.length <= 1) && targets.some(target => atHand(cell,target,blade.reach) && hasLineOfSight(state, cell, target)));
    contacts.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
    if (contacts.length) return move(contacts[0]);
    // If contact takes more than one turn, make a short approach and retain
    // melee AP. Otherwise two visible blade squads can wait forever outside
    // one turn's reach. Only observed opponents inform the exposure cost.
    const crossFloor=targets.filter(target=>!sameSurface(unit,target));
    for(const target of crossFloor){const pursuit=verticalPursuit(state,unit,target,costs);if(pursuit)return pursuit;}
    const nearest = point => Math.min(...targets.filter(target=>sameSurface(point,target)).map(target => distance(point, target)));
    const coverAt = point => surfaceAt(state,point)?.cover ?? 0;
    const exposure = point => threats.reduce((sum, enemy) => sum + (canSee(state, enemy, point) ? observedShotChance(state, enemy, {...unit, ...point}) : 0), 0);
    const currentDistance = nearest(unit), currentExposure = exposure(unit), currentCover = coverAt(unit);
    const approach = paths().filter(cell => cell.cost > 0 && cell.cost <= Math.min(reacting ? 16 : 32, unit.ap - costs.melee) && (!reacting || cell.path.length <= 1) && nearest(cell) < currentDistance)
      .map(cell => ({cell, score: (currentDistance - nearest(cell)) * 8 + (coverAt(cell) - currentCover) * .6 - Math.max(0, exposure(cell) - currentExposure) * .3}))
      .filter(choice => choice.score > 0).sort((a, b) => b.score - a.score || a.cell.cost - b.cell.cost || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    if(approach.length)return move(approach[0].cell);
    for(const target of targets){const pursuit=verticalPursuit(state,unit,target,costs);if(pursuit)return pursuit;}
    return null;
  }

  const cover = cell => surfaceAt(state,cell)?.cover || 0;
  const reserve = readyGun(unit) ? costs.fire : 0;
  const candidates = paths().filter(cell => cell.cost > 0 && cell.cost + reserve <= unit.ap);
  // Bound detailed fire/cover evaluation even on the largest maps.
  candidates.sort((a, b) => cover(b) - cover(a) || a.cost - b.cost || a.y - b.y || a.x - b.x);
  const dangerous = [...threats].sort((a, b) => distance(unit, a) - distance(unit, b) || compareId(a, b)).slice(0, 8);
  const positionScore = (cell, budget) => {
    const moving=Boolean(cell.path?.length);
    const position = {...unit, ...planningPoint(cell,Boolean(state.upperSurfaces?.length)),
      weaponReady:moving?false:unit.weaponReady,
      facing:moving?directionTo(cell.path.at(-2)??unit,cell):unit.facing};
    const availableTargets = targets.filter(target => canSee(state, position, target));
    const firing = bestShot(state, position, availableTargets, budget);
    const exposure = dangerous.reduce((total, enemy) => total + (canSee(state, enemy, position) ? observedShotChance(state, enemy, position) : 0), 0);
    return {score: (firing?.effectiveness || 0) * .65 + cover(cell) * .8 - exposure * .25, firing};
  };
  const current = positionScore(unit, unit.ap);
  let best = null;
  for (const cell of candidates.slice(0, 48)) {
    const evaluated = positionScore(cell, unit.ap - cell.cost);
    const score = evaluated.score - cell.cost * .2;
    if (score <= current.score + 5) continue;
    if (!best || score > best.score) best = {cell, score};
  }
  if (best) return move(best.cell);
  if (shot?.effectiveness >= 25) return {type: 'fire', unitId: unit.id, targetId: shot.target.id, aim: shot.aim,hitLocation:shot.hitLocation};
  const posture=firingPosture(state,unit,targets,shot);if(posture)return posture;
  for(const target of targets){const pursuit=verticalPursuit(state,unit,target,costs);if(pursuit)return pursuit;}
  return null;
}
