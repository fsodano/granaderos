import {chooseScavengingAction} from './tactical-ai-scavenging.js';
import {directionTo,facingAllowsSight,turnAPCost} from './tactical-awareness.js';
import {getReachable, canSee, hasLineOfSight, shotChance, firearmShotOptions, actionCosts, stanceCost, weaponFor, bladeFor, planEquipLoot, maxActionPoints, AP_CARRY_LIMIT} from './tactical.js';
import {planFitBayonet} from './tactical-inventory.js';
import {shotLocationEffects} from './targeted-combat.js';

// Decisions use only this soldier's sight and the last place an opponent was seen.
// No randomness or state changes occur here; tactical.js applies the returned order.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const active = u => u.hp > 0 && !u.departure && !u.surrendered && !u.routed && !u.unconscious;
const compareId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
const readyGun = u => weaponFor(u).capacity > 0 && u.loaded > 0 && !u.jammed;

export function choosePatrolAction(state,unit) {
  if(unit.knockedDown||unit.entangled||!unit.patrolOrigin||unit.patrol===false||unit.patrolTurn===state.turn||state.turn-(unit.lastInvestigatedTurn??-10)<=1||!active(unit)||state.phase==='interrupt'||state.reactionStack?.length)return null;
  const anchor=unit.patrolOrigin;
  // Patrol one short bound per round, retaining most AP for contact. A fixed
  // post and a rotating waypoint prevent aimless drift across the whole map.
  const directions=[[0,-4],[4,0],[0,4],[-4,0]];
  const offset=[...String(unit.id)].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  const [dx,dy]=directions[(state.turn+offset)%4],goal={x:anchor.x+dx,y:anchor.y+dy};
  const perceived={...state,units:state.units.filter(other=>other.side===unit.side||canSee(state,unit,other))};
  const cells=getReachable(perceived,unit).filter(p=>p.cost>0&&p.cost<=24&&p.path.length<=3&&distance(p,anchor)<=6);
  cells.sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost||a.y-b.y||a.x-b.x);
  const next=cells[0];
  return next&&distance(next,goal)<distance(unit,goal)?{type:'move',unitId:unit.id,x:next.x,y:next.y,patrol:true}:null;
}

function bestShot(state, unit, targets, budget = unit.ap) {
  if (!readyGun(unit)) return null;
  const costs = actionCosts(state, unit);
  if (costs.fire > budget) return null;
  const maxAim = Math.min(4, Math.floor((budget - costs.fire) / costs.aim));
  let best = null;
  for (const target of targets) {
    if (!hasLineOfSight(state, unit, target)) continue;
    for (const {aim,hitLocation,chance,damageFactor} of firearmShotOptions(state,unit,target,maxAim)) {
      if(!chance)continue;
      const cost = costs.fire + aim * costs.aim;
      const base=weaponFor(unit).damage,effect=shotLocationEffects(hitLocation,base*damageFactor,target);
      // Visible posture and mounted state can make balance loss useful. Do not
      // inspect a target's hidden AP, energy, supplies or future intentions.
      const secondary=target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0)+(effect.unhorse?20:0);
      const value=Math.min(target.hp,effect.damage)+secondary;
      const effectiveness=chance*value/Math.max(1,Math.min(target.hp,base)),score=effectiveness-cost*.2;
      // Torso comes first on an exact tie; equal aim values preserve AP.
      if (!best || score > best.score) best = {target, chance, aim, hitLocation, cost, score, effectiveness};
    }
  }
  return best;
}

function maintenance(state, unit, costs) {
  if (weaponFor(unit).capacity <= 0) return null;
  if (unit.jammed) return unit.priming > 0 && unit.ap >= costs.reprime ? {type: 'reprime', unitId: unit.id} : null;
  if (unit.loaded === 0 && unit.ammo > 0 && costs.reload > 0) {
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
  return null;
}

function fieldAid(state, unit, costs, targets, paths) {
  if (!(unit.medkits > 0 && unit.medical > 0)) return null;
  const prepare = unit.activeSlot === 'medical' ? 0 : costs.weapon;
  if (unit.ap < prepare + costs.heal || unit.knockedDown && prepare) return null;
  const patients = state.units.filter(other => other.side === unit.side && other.hp > 0 && other.bleeding > 0 &&
    !other.departure && !other.fled && !other.routed && !other.surrendered && distance(unit, other) <= 5 &&
    (other.id === unit.id || distance(unit, other) <= 1.5 && hasLineOfSight(state, unit, other) || canSee(state, unit, other)));
  // First stop the medic's own bleeding. For others, prefer the shortest
  // estimated time to blood loss; ties are stable across unit-array ordering.
  patients.sort((a, b) => Number(b.id === unit.id) - Number(a.id === unit.id) ||
    a.hp / a.bleeding - b.hp / b.bleeding || a.hp - b.hp || compareId(a, b));
  for (const patient of patients) {
    if (distance(unit, patient) > 1.5 || !hasLineOfSight(state, unit, patient)) continue;
    return prepare ? {type: 'weapon', unitId: unit.id, slot: 'medical'} : {type: 'useItem', unitId: unit.id, targetId: patient.id};
  }
  // A reaction can bind an adjacent wound, but does not start a rescue trip.
  if (unit.knockedDown || unit.entangled || state.phase === 'interrupt' || state.reactionStack?.length || !patients.length) return null;
  const budget = Math.min(24, unit.ap - prepare - costs.heal);
  if (budget <= 0 || targets.some(target => distance(unit, target) <= 2.5)) return null;
  const threats = targets.filter(readyGun);
  const exposure = point => threats.reduce((sum, enemy) => sum + (canSee(state, enemy, point) ? shotChance(state, enemy, {...unit, ...point}) : 0), 0);
  const currentExposure = exposure(unit);
  const choices = paths().filter(cell => cell.cost > 0 && cell.cost <= budget && cell.path.length <= 3 &&
    cell.path.every(point => !targets.some(target => distance(point, target) <= 2.5) && exposure(point) <= currentExposure));
  for (const patient of patients) {
    const destinations = choices.filter(cell => distance(cell, patient) <= 1.5 && hasLineOfSight(state, cell, patient));
    destinations.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
    if (destinations.length) return {type: 'move', unitId: unit.id, x: destinations[0].x, y: destinations[0].y};
  }
  return null;
}

function backupWeapon(state, unit, costs, targets) {
  if (readyGun(unit)) return null;
  const blade = bladeFor(unit);
  if (blade.id !== 0 && targets.some(target => distance(unit, target) <= blade.reach && hasLineOfSight(state, unit, target))) return null;
  const held = weaponFor(unit);
  const serviceable = held.capacity > 0 && (unit.jammed ? unit.priming > 0 : unit.loaded > 0 || unit.ammo > 0);
  // Do not unpack guns just to stand idle. With contact, a prepared spare can
  // permit a shot this turn when the held weapon needs a long reload.
  if (!targets.length && (serviceable || held.capacity === 0 && blade.id !== 0)) return null;
  const candidates = [];
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
  if (distance(unit, known) <= 1 || budget <= 0) return null;
  const reachable = paths();
  const tiles = new Map(state.tiles.map(tile => [`${tile.x},${tile.y}`, tile]));
  const coverAt = point => tiles.get(`${point.x},${point.y}`)?.cover ?? 0;
  const currentDistance = distance(unit, known), currentCover = coverAt(unit);
  const currentSight = hasLineOfSight(state, unit, known);
  // A path toward the nearest reachable part of the search area permits short
  // detours around a wall, even when the first step is farther from the area.
  const goal = [...reachable].sort((a, b) => distance(a, known) - distance(b, known) || a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
  const detour = new Map((goal?.path ?? []).map((point, index) => [`${point.x},${point.y}`, index + 1]));
  const choices = reachable.filter(cell => cell.cost > 0 && cell.cost <= budget && cell.path.length <= maxSteps).map(cell => {
    const cover = coverAt(cell), sight = hasLineOfSight(state, cell, known);
    const progress = currentDistance - distance(cell, known), routeProgress = detour.get(`${cell.x},${cell.y}`) ?? 0;
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
  return choices.length ? {type: 'move', unitId: unit.id, x: choices[0].cell.x, y: choices[0].cell.y} : null;
}

export function chooseEnemyAction(state, unit) {
  if (!unit || !active(unit) || state.status !== 'active' || unit.ap <= 0) return null;
  const costs = actionCosts(state, unit);
  const targets = state.units.filter(other => other.side !== unit.side && other.hp > 0 && !other.departure && !other.surrendered && !other.unconscious && canSee(state, unit, other)).sort(compareId);
  // Share the same perceived path search across aid, pursuit and cover choices.
  let reachable;
  const paths = () => reachable ??= getReachable({...state, units: state.units.filter(other => other.side === unit.side || canSee(state, unit, other))}, unit);
  if (unit.bleeding > 0 && unit.medkits > 0 && unit.medical > 0 && unit.activeSlot === 'medical' && unit.ap >= costs.heal) return {type: 'useItem', unitId: unit.id, targetId: unit.id};
  if (unit.knockedDown) return unit.ap >= (costs.standing ?? 12) ? {type: 'stance', unitId: unit.id, stance: 'standing'} : null;
  if (unit.entangled) return unit.ap >= (costs.free ?? 15) ? {type: 'free', unitId: unit.id} : null;
  if (unit.bleeding > 0 && unit.medkits > 0 && unit.medical > 0 && unit.ap >= costs.heal + costs.weapon) return {type: 'weapon', unitId: unit.id, slot: 'medical'};
  const aid = fieldAid(state, unit, costs, targets, paths);
  if (aid) return aid;
  const backup = backupWeapon(state, unit, costs, targets);
  if (backup) return backup;
  if (['medical','tool','supply'].includes(unit.activeSlot)) {
    const slot = !unit.weaponDropped ? 'primary' : unit.blade ? 'blade' : null;
    return slot && unit.ap >= (costs.weapon ?? 4) ? {type: 'weapon', unitId: unit.id, slot} : null;
  }

  if(unit.activeSlot==='unarmed'&&unit.ap>=costs.weapon){
    const slot=!unit.weaponDropped&&unit.weapon?'primary':unit.blade?'blade':null;
    if(slot)return {type:'weapon',unitId:unit.id,slot};
  }

  const upkeep = maintenance(state, unit, costs);
  const move = cell => ({type: 'move', unitId: unit.id, x: cell.x, y: cell.y});

  if (!targets.length) {
    if (upkeep) return upkeep;
    const scavenge = chooseScavengingAction(state, unit, targets, paths);
    if (scavenge) return scavenge;
    const known = unit.lastKnownEnemy || unit.lastHeardNoise;
    const age = state.turn - (known?.turn ?? -Infinity);
    if (!known || !Number.isInteger(known.x) || !Number.isInteger(known.y) || known.x < 0 || known.y < 0 || known.x >= state.width || known.y >= state.height || age < 0 || age > 3) return choosePatrolAction(state,unit);
    return investigate(state, unit, known, costs, paths);
  }

  const blade = bladeFor(unit);
  // A useful owned fitting is a paid inventory action, followed by a fresh
  // decision. Never fabricate a bayonet or mutate equipment while scoring.
  if (!unit.weaponFittings?.bayonet && (unit.activeSlot??'primary')==='primary' &&
      unit.ap>=costs.fitBayonet+16 && targets.some(target=>distance(unit,target)<=2&&hasLineOfSight(state,unit,target))) {
    for (const item of ['blade',...Object.keys(unit.inventory??{}).sort().map(key=>`inventory:${key}`)]) {
      try {planFitBayonet(unit,item);return {type:'fitBayonet',unitId:unit.id,item};} catch { /* Try the next owned item. */ }
    }
  }
  const adjacent = targets.filter(target => distance(unit, target) <= blade.reach && hasLineOfSight(state, unit, target));
  adjacent.sort((a, b) => a.hp - b.hp || distance(unit, a) - distance(unit, b) || compareId(a, b));
  if (adjacent.length && unit.ap >= costs.melee) return {type: 'melee', unitId: unit.id, targetId: adjacent[0].id};

  const shot = bestShot(state, unit, targets);
  const support = state.units.filter(other => other.side === unit.side && active(other) && distance(unit, other) <= 8).length;
  const threats = targets.filter(readyGun);
  const outgunned = threats.length > support;
  if (shot?.effectiveness >= 45 && !outgunned) return {type: 'fire', unitId: unit.id, targetId: shot.target.id, aim: shot.aim,hitLocation:shot.hitLocation};
  if (upkeep) return upkeep;
  const scavenge = chooseScavengingAction(state, unit, targets, paths);
  if (scavenge) return scavenge;

  if (weaponFor(unit).capacity <= 0 || (!unit.loaded && !unit.ammo) || (unit.jammed && !unit.priming)) {
    // Close for an affordable melee attack; never spend the entire turn rushing
    // across open ground towards an armed enemy who can shoot on arrival.
    const reacting = state.phase === 'interrupt' || Boolean(state.reactionStack?.length);
    const contacts = paths().filter(cell => cell.cost > 0 && cell.cost + costs.melee <= unit.ap && (!reacting || cell.path.length <= 1) && targets.some(target => distance(cell, target) <= blade.reach && hasLineOfSight(state, cell, target)));
    contacts.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
    if (contacts.length) return move(contacts[0]);
    // If contact takes more than one turn, make a short approach and retain
    // melee AP. Otherwise two visible blade squads can wait forever outside
    // one turn's reach. Only observed opponents inform the exposure cost.
    const nearest = point => Math.min(...targets.map(target => distance(point, target)));
    const coverAt = point => state.tiles.find(tile => tile.x === point.x && tile.y === point.y)?.cover ?? 0;
    const exposure = point => threats.reduce((sum, enemy) => sum + (canSee(state, enemy, point) ? shotChance(state, enemy, {...unit, ...point}) : 0), 0);
    const currentDistance = nearest(unit), currentExposure = exposure(unit), currentCover = coverAt(unit);
    const approach = paths().filter(cell => cell.cost > 0 && cell.cost <= Math.min(reacting ? 16 : 32, unit.ap - costs.melee) && (!reacting || cell.path.length <= 1) && nearest(cell) < currentDistance)
      .map(cell => ({cell, score: (currentDistance - nearest(cell)) * 8 + (coverAt(cell) - currentCover) * .6 - Math.max(0, exposure(cell) - currentExposure) * .3}))
      .filter(choice => choice.score > 0).sort((a, b) => b.score - a.score || a.cell.cost - b.cell.cost || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    return approach.length ? move(approach[0].cell) : null;
  }

  const tiles = new Map(state.tiles.map(tile => [`${tile.x},${tile.y}`, tile]));
  const cover = cell => tiles.get(`${cell.x},${cell.y}`)?.cover || 0;
  const reserve = readyGun(unit) ? costs.fire : 0;
  const candidates = paths().filter(cell => cell.cost > 0 && cell.cost + reserve <= unit.ap);
  // Bound detailed fire/cover evaluation even on the largest maps.
  candidates.sort((a, b) => cover(b) - cover(a) || a.cost - b.cost || a.y - b.y || a.x - b.x);
  const dangerous = [...threats].sort((a, b) => distance(unit, a) - distance(unit, b) || compareId(a, b)).slice(0, 8);
  const positionScore = (cell, budget) => {
    const position = {...unit, x: cell.x, y: cell.y};
    const availableTargets = targets.filter(target => canSee(state, position, target));
    const firing = bestShot(state, position, availableTargets, budget);
    const exposure = dangerous.reduce((total, enemy) => total + (canSee(state, enemy, position) ? shotChance(state, enemy, position) : 0), 0);
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
  return null;
}
