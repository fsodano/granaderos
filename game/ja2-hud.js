import {OUTFITS,wornOutfit,hasPoncho} from './outfits.js';
import {handLayout} from './hand-layout.js';
import {reloadPlan,lookPreview} from './tactical.js';
import {shotRangeText} from './shot-range.js';
import {canChooseShotLocation} from './targeted-combat.js';
import {tacticalGridLabel} from './tactical-grid.js';
// Pure HUD model for the tactical battle inspector and squad strip.
// Read-only descriptors plus action-object constructors; no game rules.
import {swapHandsPreview, weaponFor, bladeFor, hasFirearm, carriedWeight, carryCapacity, actionCosts, actionPointBudget, stanceCost, shotChance, firearmRangeProfile, firearmProjectilePath, firearmFlightPreview, canSee, hasLineOfSight, artilleryCosts, artilleryCrewPlan, artilleryReloadPreview, interruptAvailable, canEndCombat, fieldCapable, transferPreview, dropPreview, environmentTargetAt, environmentPreview, containerLootPreview, supplyUsePreview, getReachable, movementIntentReason, exitPreview, ARTILLERY, WEAPONS, BLADES} from './tactical.js';
import {directionTo} from './tactical-awareness.js';
import {unarmedChance} from './unarmed-combat.js';
import {inventoryUsage, itemDescriptor, INVENTORY_CAPACITY, SUPPLY_ITEMS} from './tactical-inventory.js';
import {TOOL_TYPES, heldTool, ENVIRONMENT_VERBS, environmentTargetSummary, visibleContainerContents} from './environment-interactions.js';
import {HELD_SUPPLIES, heldSupply} from './held-supplies.js';
import {planGroupMove} from './group-movement.js';
import {contextualAttack, fitBayonetPreview, removeBayonetPreview, medicalUsePreview,itemUsePreview,environmentUsePreview,lootApproachPreview,lootSearchPreview,lootBatchPreview,stealPreview,pointFirePreview} from './tactical.js';
import {fixedBayonetFor, fittingLabel, weaponItemWeight} from './weapon-fittings.js';

const alive = u => u.hp > 0 && !u.routed && !u.unconscious && !u.departure && !u.fled;
const shortName = u => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const affordable = (state, unit, pa) => state.mode === 'exploration' || unit.ap >= pa;
const hasPrimary = unit => Boolean(unit.weapon) && !unit.weaponDropped;
export function toolItems(unit) {
  return Object.entries(unit?.inventory || {}).flatMap(([key, record]) => {
    const item = `inventory:${key}`, tool = heldTool({...unit, activeSlot: 'tool', activeTool: item});
    return tool ? [{...record, ...tool, key, count: record.count, active: unit.activeSlot === 'tool' && unit.activeTool === item}] : [];
  });
}
export function supplyItems(unit) {
  return Object.keys(HELD_SUPPLIES).flatMap(key => {
    const supply = heldSupply({...unit, activeSlot: 'supply', activeSupply: key});
    return supply ? [{...supply, label: SUPPLY_ITEMS[key].label, active: unit.activeSlot === 'supply' && unit.activeSupply === key}] : [];
  });
}
export function heldSupplyAction(unit, target) {
  return {type: 'useItem', ...(unit.activeSupply === 'torches' ? {x: target.x, y: target.y} : {targetId: target?.id})};
}

export const attackCursorMode = unit => hasFirearm(unit || {}) ? 'fire' : 'useItem';
export const pickupTargetAction = (target,unit) => ({type:target.side!==unit?.side&&target.hp>0&&!target.unconscious&&!target.surrendered&&!target.routed?'steal':'loot',targetId:target.id});
export const targetItemAction = (mode, targetId, unit) => ({type: mode === 'fire' && hasFirearm(unit || {}) ? 'fire' : 'useItem', targetId});
export function resolvedOrderType(state, unit, action) {
  if (action.type !== 'useItem') return action.type;
  if (action.environment || unit.activeSlot === 'tool') return 'environment';
  if (unit.activeSlot === 'supply') return 'supply';
  if (unit.activeSlot === 'medical') return 'heal';
  return contextualAttack(state, unit, state.units.find(target => target.id === action.targetId), action).type;
}
// A firing click on an empty held gun performs one reload, never a reload and shot.
// Keep strict shot commands in the combat engine for AI and reaction validation.
export function tacticalInputAction(state, unit, action) {
  if (!unit || !hasFirearm(unit) || unit.loaded > 0) return action;
  const type = resolvedOrderType(state, unit, action);
  if (!['fire', 'firePoint'].includes(type)) return action;
  return {type: 'reload', ...(action.unitId ? {unitId: action.unitId} : {}), aim: 0};
}
export function firearmCostText(state,unit,point){
  if(state.mode==='exploration')return 'Sin coste de PA; consume tiempo y la munición del disparo.';
  const c=actionCosts(state,unit,point);
  if(c.turn)return c.ready?`Preparar y girar: ${c.setup} PA · disparar: ${c.discharge} PA.`:`Girar: ${c.turn} PA · disparar: ${c.discharge} PA.`;
  return c.ready?`Preparar: ${c.ready} PA · disparar: ${c.discharge} PA.`:`Arma en posición de tiro · disparar: ${c.discharge} PA.`;
}
export function emptyGunPreview(state, unit) {
  if (!unit || !hasFirearm(unit) || unit.loaded > 0) return null;
  const plan = reloadPlan(unit, state), rounds = plan.available, pa = state.mode === 'exploration' ? 0 : plan.pa;
  const reason = !rounds ? 'Sin munición. No quedan cartuchos.'
    : unit.jammed ? 'Cebá el arma antes de recargar (R).'
    : unit.knockedDown ? 'Primero debés levantarte.'
    : !unitCanAct(state, unit) ? 'El combatiente no puede actuar.'
    : !pa || !affordable(state, unit, pa) ? 'PA insuficientes para recargar.' : null;
  return {name: weaponFor(unit).name, actionLabel: rounds ? plan.partial ? 'Recarga parcial' : 'Recargar' : 'Sin munición',
    attackType: 'reload', cursor: rounds ? 'reload' : 'empty', pa,
    chance: undefined, chanceLabel: undefined, hitLocation: undefined, attackLabel: undefined,
    remaining: Math.max(0, unit.ap - (state.mode === 'exploration' || reason ? 0 : pa)),
    rounds: plan.rounds, partial: plan.partial, remainingReloadPA: plan.remainingPA, reloadProgress: plan.progress, reason, valid: !reason,
    coverNote: rounds ? plan.partial ? `Carga ${plan.rounds} cartuchos ahora. Faltan ${plan.remainingPA} PA para completar la recarga. Continuá con R o un clic de disparo con el arma vacía.` : `Carga ${plan.rounds} cartucho${plan.rounds === 1 ? '' : 's'}. Quedan ${unit.ammo - plan.rounds} de reserva. Hacé otro clic para disparar.` : undefined};
}
export const STANCES = [['standing', 'De pie'], ['crouched', 'Agachado'], ['prone', 'Cuerpo a tierra']];
export const stanceLabel = stance => STANCES.find(([id]) => id === stance)?.[1] || 'De pie';
export const nextStance = unit => unit.knockedDown ? 'standing' : STANCES[(STANCES.findIndex(([id]) => id === unit.stance) + 1) % STANCES.length][0];
const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const facingLabel = unit => COMPASS_LABELS[directionTo(unit, unit)];
export const HIT_LOCATIONS = [['torso', 'Torso'], ['head', 'Cabeza'], ['legs', 'Piernas']];
const hitLocationFor = value => HIT_LOCATIONS.some(([id]) => id === value) ? value : 'torso';

export function unitCanAct(state, unit) {
  return Boolean(unit) && !unit.militia && (!state.alliedTurn || state.phase==='interrupt') && interruptAvailable(state, unit);
}

export function groupSelectionMode(state) {
  return state.status === 'active' && state.mode === 'exploration' && state.phase === 'player' && !state.interrupt && !state.enemyTurn && !state.reactionStack?.length;
}

/** Submits a settled deployment report; this does not move anyone across a sector edge. */
export function campaignReturnModel(state, peacefulVisit = false) {
  const settled = state.status === 'active' && state.mode === 'exploration' && state.phase === 'player' && !state.interrupt && !state.enemyTurn && !state.reactionStack && !state.contactInitiative;
  const available = settled && (state.sectorCleared === true || peacefulVisit) && state.units.some(unit => unit.side === 'player' && fieldCapable(unit)) && !state.units.some(unit => unit.side === 'enemy' && fieldCapable(unit));
  return {available, label: 'Volver a la campaña', note: state.units.some(unit => unit.side === 'player' && unit.departure) ? 'Quienes siguen aquí permanecen en este sector.' : 'La escuadra permanece en este sector.'};
}

export function isMovementGround(state, unit, point) {
  if (!point) return false;
  const occupied = state.units.some(target => !target.fled && !target.departure && target.x === point.x && target.y === point.y && (target.side === 'player' || state.units.some(observer => observer.side === 'player' && canSee(state, observer, target))));
  return !occupied && !(unit && canSee(state, unit, point) && environmentTargetAt(state, point));
}
export function isGroupGround(state, unit, point) { return groupSelectionMode(state) && isMovementGround(state, unit, point); }

export function movementAction(point, movementIntent = 'forward') {
  return {type: 'move', x: point.x, y: point.y, ...(movementIntent === 'preserveFacing' ? {movementIntent} : {})};
}

export function toggleMovementGroup(state, ids, targetId, selectedId) {
  const target = state.units.find(unit => unit.id === targetId);
  if (!groupSelectionMode(state) || !target || target.side !== 'player' || !unitCanAct(state, target)) return ids;
  const current = ids.filter(id => state.units.some(unit => unit.id === id && unit.side === 'player' && !unit.departure));
  if (current.includes(targetId)) return current.filter(id => id !== targetId);
  const selected = state.units.find(unit => unit.id === selectedId);
  if (!current.length && selected?.side === 'player' && unitCanAct(state, selected)) current.push(selectedId);
  return [...new Set([...current, targetId])];
}

export function movementGroupModel(state, ids, selectedId, point) {
  const members = groupSelectionMode(state) ? [...new Set(ids)].flatMap(id => {
    const unit = state.units.find(unit => unit.id === id && unit.side === 'player' && !unit.departure && !unit.fled);
    return unit ? [{id, name: unit.nickname || unit.name}] : [];
  }) : [];
  const anchorId = members.some(unit => unit.id === selectedId) ? selectedId : members[0]?.id;
  const request = members.length && point ? {unitIds: members.map(unit => unit.id), anchorId, x: point.x, y: point.y} : null;
  return {members, anchorId, request, preview: request ? planGroupMove(state, request) : null};
}

export function turnModel(state) {
  const interrupted = state.phase === 'interrupt' && state.interrupt?.side === 'player';
  return {
    interrupted,
    label: interrupted ? 'Interrupción' : state.mode === 'exploration' ? 'Exploración libre' : `Turno ${state.turn} · ${state.phase === 'enemy' ? 'Ejército realista' : 'Ejército patriota'}`,
    endLabel: interrupted ? 'Continuar turno enemigo' : state.mode === 'exploration' ? 'Descansar' : 'Fin del turno',
    units: interrupted ? state.units.filter(u => unitCanAct(state, u)) : [],
    canExplore: canEndCombat(state),
  };
}

export function shotLocationOptions(state, unit, ctx = {}) {
  if (!unit || !hasFirearm(unit)) return [];
  return HIT_LOCATIONS.filter(([id])=>!ctx.target||canChooseShotLocation(ctx.target)||id==='torso').map(([id, label]) => ({id, label, active: id === hitLocationFor(ctx.hitLocation), disabled: !unitCanAct(state, unit) || Boolean(ctx.busy)}));
}

export function heardNoiseModel(state, unit) {
  const noise = unit?.lastHeardNoise;
  if (!unit || !alive(unit) || !noise || noise.investigated || !Number.isInteger(noise.turn) || state.turn - noise.turn > 3 || state.turn < noise.turn) return null;
  if (!Number.isFinite(noise.x) || !Number.isFinite(noise.y) || !Number.isFinite(noise.uncertainty) || noise.uncertainty < 0) return null;
  return {x: noise.x, y: noise.y, radius: noise.uncertainty, label: 'Ruido: zona aproximada'};
}

export function visibleHover(state, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (point.anonymous) return {x: point.x, y: point.y, anonymous: true};
  const unit = point.id ? state.units.find(unit => unit.id === point.id) : null;
  const npc = !unit && point.id ? (state.npcs || []).find(npc => npc.id === point.id) : null;
  const target = unit || npc;
  if (!target) return point;
  if (target.departure || target.fled || target.side !== 'player' && !state.units.some(observer => observer.side === 'player' && canSee(state, observer, target))) return null;
  return target;
}

export function interruptHover(state, selectedId) {
  const enemy = state.units.find(unit => unit.id === state.interrupt?.enemyId);
  const seen = visibleHover(state, enemy);
  if (seen) return seen;
  const eligible = state.units.filter(unit => unitCanAct(state, unit));
  const observer = eligible.find(unit => unit.id === selectedId) || eligible[0];
  const noise = heardNoiseModel(state, observer);
  return noise ? {x: noise.x, y: noise.y, anonymous: true} : null;
}

export function targetingHelp(mode, unit, ctx = {}) {
  if(mode==='talk')return 'Hablar: seleccioná una persona visible y contigua. Esc vuelve al cursor de movimiento.';
  if ((ctx.itemIntent==='steal'&&['move','useItem'].includes(mode))||mode==='loot'&&unit?.activeSlot==='unarmed') return 'Manos libres: seleccioná un enemigo contiguo para quitarle el arma. Requiere 28 PA como mínimo y consume todos los restantes. Los cuerpos se registran.';
  if (unit?.activeSlot==='unarmed'&&['move','useItem'].includes(mode)) return 'Seleccioná un enemigo para acercarte y golpear. Ctrl+clic o Recoger equipo: intentar quitar el arma a un enemigo contiguo.';
  if (mode === 'fire') return 'Disparo deliberado: seleccioná un enemigo o una casilla. Una casilla no confirma un objetivo; el tiro puede herir aliados. G o Esc vuelve al uso contextual.';
  if (mode === 'look') return 'Seleccioná hacia dónde mirar. El giro consume PA. Con un arma de fuego, mirá otra vez en la misma dirección para prepararla sin disparar. La vista previa muestra el costo. F: disparar; Esc: cancelar.';
  if (mode === 'move' && ctx.movementIntent === 'preserveFacing') return 'Alt: mové solo al seleccionado sin girar. Cancela el grupo. Caminar, agachado o cuerpo a tierra; no correr ni montar.';
  if (unit?.activeSlot === 'supply' && ['move', 'useItem'].includes(mode)) return ({torches: 'Seleccioná una casilla para arrojar la antorcha. Para avanzar, cambiá el objeto en mano.', boleadoras: 'Seleccioná un enemigo visible para lanzar las boleadoras.', rations: 'Seleccionate a vos para comer la ración. Recupera fuerzas; no detiene hemorragias.'})[unit.activeSupply] || 'Equipá un pertrecho disponible.';
  if (unit?.activeSlot === 'tool' && ['move', 'useItem'].includes(mode)) return 'Seleccioná una puerta o un cofre para usar la herramienta. Las casillas libres permiten avanzar.';
  if(hasFirearm(unit||{})&&unit.weaponMode==='melee'&&['move','useItem'].includes(mode))return `${fixedBayonetFor(unit)?'Estocada de bayoneta':'Culatazo'}: seleccioná un enemigo para acercarte y golpear. No dispara ni recarga. Botón derecho o F: apuntar para disparar.`;
  if (mode === 'useItem') return unit?.activeSlot === 'medical' ? 'Seleccionate a vos o a un aliado herido. Se acerca y venda si hay ruta y PA suficientes. Detiene la hemorragia, sin recuperar salud.' : hasFirearm(unit || {}) ? 'Seleccioná un enemigo. Apuntar consume PA adicionales.' : 'Seleccioná un enemigo para acercarte y usar el arma blanca.';
  return ({move: 'Seleccioná una casilla para avanzar. Sobre un combatiente se usa el objeto equipado.', loot: 'Seleccioná un cuerpo o equipo visible. Elegí qué recoger; los PA incluyen el desplazamiento.', torch: 'Seleccioná una casilla para arrojar la antorcha.', bolas: 'Seleccioná un enemigo para lanzar las boleadoras.', artillery: 'Seleccioná un objetivo dentro del arco del cañón.', artilleryMove: 'Seleccioná una casilla contigua al cañón.', artilleryPivot: 'Seleccioná hacia dónde apuntar el cañón.'})[mode] || 'Seleccioná una orden.';
}

export function aimOptions(state, unit, ctx = {}) {
  const costs = unit ? actionCosts(state, unit, ctx.target) : {fire: 0, aim: 0};
  const ready = unitCanAct(state, unit) && hasFirearm(unit) && unit.loaded > 0 && !unit.jammed && !unit.knockedDown && !ctx.busy;
  return Array.from({length: 5}, (_, level) => {
    const pa = costs.fire + level * costs.aim;
    return {level, pa, disabled: !ready || !affordable(state, unit, pa)};
  });
}

// A read-only preview of the selected action. Enemy data must already be visible.
export function targetPreview(state, unit, point, ctx = {}) {
  const preview=targetPreviewWithCosts(state,unit,point,ctx);
  return state.mode==='exploration'&&preview?{...preview,...(preview.pa===undefined?{}:{pa:0,remaining:unit?.ap})}:preview;
}
function targetPreviewWithCosts(state, unit, point, ctx = {}) {
  if (!unit) return null;
  const mode = ctx.mode || 'move';
  const reload = mode === 'fire' ? emptyGunPreview(state, unit) : null;
  if (reload) return reload;
  if (!point) return null;
  const occupants = state.units.filter(v => v.x === point.x && v.y === point.y && !v.fled && !v.departure && (v.side === unit.side || state.units.some(p => p.side === unit.side && canSee(state, p, v))));
  const target = occupants.find(v => v.id === point.id) || occupants.find(v => v.hp > 0) || occupants[0];
  if(mode==='fire'&&(!target||target.side===unit.side||target.hp<=0||target.surrendered)){
    const preview=pointFirePreview(state,unit,point,ctx.aim??0);
    return {name:tacticalGridLabel(point.x,point.y),actionLabel:'Disparar a la casilla',attackType:'fire',pa:preview.pa,remaining:Math.max(0,unit.ap-(state.mode==='exploration'?0:preview.pa)),valid:preview.valid,reason:preview.reason,coverNote:`${firearmCostText(state,unit,point)} Sin objetivo confirmado. Altura fija; la cobertura y los cuerpos pueden interceptar el tiro. Puede herir aliados.`};
  }
  if(target&&target.side!==unit.side&&pickupTargetAction(target,unit).type==='steal'&&(ctx.itemIntent==='steal'&&['move','useItem'].includes(mode)||mode==='loot')){
    const preview=stealPreview(state,unit,target);
    return {name:target.name,actionLabel:'Quitar arma',attackLabel:'Quitar arma',pa:preview.pa,remaining:state.mode==='exploration'?unit.ap:0,reason:preview.reason,valid:preview.valid,coverNote:'Intento disputado: consume todos los PA restantes, también si falla.'};
  }
  const preserveFacing = mode === 'move' && ctx.movementIntent === 'preserveFacing' && isMovementGround(state, unit, point);
  if (preserveFacing) {
    const destination = (ctx.reachable || getReachable(state, unit, {movementIntent: 'preserveFacing'})).find(tile => tile.x === point.x && tile.y === point.y);
    const reason = movementIntentReason(unit, 'preserveFacing') || (!unitCanAct(state, unit) ? 'El combatiente no puede actuar.' : unit.knockedDown ? 'Primero debés levantarte.' : unit.entangled ? 'Primero debés liberarte de las boleadoras.' : !destination || !destination.path.length ? 'Destino inaccesible o PA insuficientes.' : null);
    const pa = destination ? state.mode === 'exploration' ? 0 : destination.cost : undefined;
    return {name: `${tacticalGridLabel(point.x,point.y)}`, actionLabel: 'Mover sin girar', pa, remaining: pa === undefined ? undefined : Math.max(0, unit.ap - pa), reason, valid: !reason};
  }
  const pickup=pickupSelection(state,unit,point,ctx);
  if(pickup.length){const p=pickup[0];return {name:'Equipo',actionLabel:p.movePa?'Acercarse al equipo':'Elegir qué recoger',pa:p.movePa,remaining:Math.max(0,unit.ap-(state.mode==='exploration'?0:p.movePa)),valid:p.valid,reason:p.reason,coverNote:'Al llegar, elegí el objeto y la cantidad. Recoger cuesta 8 PA adicionales. El contacto puede detener el desplazamiento.'};}
  const aliasSupply = ({torch: 'torches', bolas: 'boleadoras', ration: 'rations'})[mode];
  if (aliasSupply || unit.activeSlot === 'supply' && ['move', 'useItem'].includes(mode) && (unit.activeSupply === 'torches' || target || mode === 'useItem')) {
    const key = aliasSupply || unit.activeSupply;
    const preview = supplyUsePreview(state, unit, key === 'torches' ? {x: point.x, y: point.y} : target, key);
    const label = ({torches: 'Arrojar antorcha', boleadoras: 'Lanzar boleadoras', rations: 'Comer ración'})[key] || 'Usar pertrecho';
    return {name: target?.name || `${tacticalGridLabel(point.x,point.y)}`, actionLabel: label, attackLabel: label, pa: preview.cost, chance: preview.chance, remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.cost)), reason: preview.reason, valid: preview.allowed};
  }
  const environment = !target && ['move', 'useItem'].includes(mode) ? environmentTargetAt(state, point) : null;
  if (environment && canSee(state, unit, point)) {
    const summary = environmentTargetSummary(unit, environment), preview = environmentUsePreview(state, unit, environment);
    return {name: summary.label, pa: preview.pa, chance: preview.chance ?? undefined, chanceLabel: 'éxito', attackLabel: preview.label, actionLabel: preview.label, remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)), coverNote:preview.movePa?`Desplazamiento: ${preview.movePa} PA · uso: ${preview.actionPa} PA. El contacto puede detener la acción.`:undefined, reason: preview.reason, valid: preview.valid};
  }
  if (mode === 'heal' || unit.activeSlot === 'medical' && ['move', 'useItem'].includes(mode) && target) {
    if(mode!=='heal'){
      const preview=itemUsePreview(state,unit,target);
      return {name:target?.name||tacticalGridLabel(point.x,point.y),actionLabel:preview.movePa?'Acercarse y vendar':'Vendar',pa:preview.pa,remaining:Math.max(0,unit.ap-(state.mode==='exploration'?0:preview.pa)),coverNote:preview.movePa?`Desplazamiento: ${preview.movePa} PA · vendas: ${preview.actionPa} PA. El contacto puede detener la acción.`:undefined,reason:preview.reason,valid:preview.valid};
    }
    const preview = medicalUsePreview(state, unit, target ?? null);
    return {name: target?.name || tacticalGridLabel(point.x, point.y), actionLabel: 'Vendar', pa: preview.cost, remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.cost)), reason: preview.reason, valid: preview.allowed};
  }
  let pa, chance, reason, actionLabel, attackType, attackLabel, coverNote;
  if (mode === 'look') {
    const preview=lookPreview(state,unit,point);
    pa=preview.pa;reason=preview.reason;actionLabel=preview.prepare?preview.actionLabel:`Mirar al ${COMPASS_LABELS[preview.facing]}`;
    coverNote=preview.prepare?'Prepara el arma sin disparar. Conserva los cartuchos; el próximo disparo no vuelve a pagar la preparación.':hasFirearm(unit)?'Una vez orientado, mirá otra vez en esa dirección para preparar el arma.':undefined;
  } else if (target && target.side !== unit.side && ['move', 'useItem', 'fire', 'melee'].includes(mode)) {
    if (target.hp <= 0 || target.surrendered) return null;
    if (unit.activeSlot === 'tool') return {name: target.name, reason: 'La herramienta se usa sobre una puerta o un cofre.', valid: false};
    const attack = contextualAttack(state, unit, target, {type: mode, aim: ctx.aim || 0, hitLocation: hitLocationFor(ctx.hitLocation)});
    pa = attack.pa; attackType = attack.type;
    if (attack.type === 'melee') {
      const approach=['move','useItem'].includes(mode)?itemUsePreview(state,unit,target):null;
      attackLabel = unit.activeSlot === 'unarmed' ? 'Puños' : fixedBayonetFor(unit) ? 'Estocada de bayoneta' : hasFirearm(unit) ? 'Culatazo' : attack.profile.name;
      actionLabel = attackLabel;
      if(approach){pa=approach.pa;reason=approach.reason;if(approach.movePa){actionLabel='Acercarse y atacar';coverNote=`Desplazamiento: ${approach.movePa} PA · ataque: ${approach.actionPa} PA. El contacto puede detener la acción.`;}else if(approach.valid&&unit.activeSlot==='unarmed')chance=unarmedChance(unit,target,{aware:canSee(state,target,unit)});}
      else if (distance(unit, target) > attack.profile.reach || !hasLineOfSight(state, unit, target)) reason = unit.activeSlot === 'unarmed' ? 'Acercate para golpear con los puños.' : 'Fuera del alcance del arma blanca.';
      else if (unit.activeSlot === 'unarmed') chance = unarmedChance(unit, target, {aware: canSee(state, target, unit)});
    } else {
      const reload = emptyGunPreview(state, unit);
      if (reload) return reload;
      chance = shotChance(state, unit, target, ctx.aim || 0, hitLocationFor(ctx.hitLocation));
      const path=firearmProjectilePath(state,unit,target,hitLocationFor(ctx.hitLocation));
      coverNote=path.blocked?'La cobertura detiene este tiro. Disparar consume la carga.':path.damageFactor<1?`La cobertura reduce el daño un ${Math.round((1-path.damageFactor)*100)}%.`:undefined;
      const flight=firearmFlightPreview(state,unit,target,hitLocationFor(ctx.hitLocation));
      if(flight.victimId&&flight.victimId!==target.id)coverNote='Un combatiente está en la trayectoria. Disparar puede herirlo y consume la carga.';
      coverNote=[shotRangeText(firearmRangeProfile(state,unit,target)),coverNote].filter(Boolean).join(' ');
      if (!canChooseShotLocation(target)&&hitLocationFor(ctx.hitLocation)!=='torso') reason = 'Un objetivo cuerpo a tierra tiene una sola zona de tiro.';
      else if (unit.jammed) reason = 'Cebá el arma antes de disparar.';
      else if (!(unit.loaded > 0)) reason = 'Recargá el arma.';
      else if (!hasLineOfSight(state,unit,target)) reason = 'No hay línea de tiro.';
    }
  } else if (mode === 'move' && !target) {
    const destination = (ctx.reachable || []).find(p => p.x === point.x && p.y === point.y);
    if (!destination) reason = 'Destino inaccesible o PA insuficientes.';
    else pa = state.mode === 'exploration' ? 0 : destination.cost;
  } else return null;
  if(attackType==='fire')coverNote=[firearmCostText(state,unit,target),coverNote].filter(Boolean).join(' ');
  if (unit.knockedDown) reason = 'Primero debés levantarte.';
  if (!reason && !unitCanAct(state, unit)) reason = state.phase === 'interrupt' ? 'Este combatiente no puede actuar en la interrupción.' : 'El combatiente no puede actuar.';
  if (!reason && pa !== undefined && !affordable(state, unit, pa)) reason = 'PA insuficientes.';
  return {name: (attackType ? target?.name : actionLabel || target?.name) || `${tacticalGridLabel(point.x,point.y)}`, pa, chance, coverNote, hitLocation: chance === undefined || attackType !== 'fire' ? undefined : HIT_LOCATIONS.find(([id]) => id === hitLocationFor(ctx.hitLocation))[1], attackType, attackLabel, actionLabel, remaining: pa === undefined ? undefined : Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : pa)), reason, valid: !reason};
}

export function fittingInventoryModel(state, unit) {
  const sources = [
    ...(unit.blade === 1811 ? [{item: 'blade', condition: unit.bladeCondition ?? 100, pattern: unit.bladeFittingPattern}] : []),
    ...Object.entries(unit.inventory || {}).flatMap(([key, record]) => record?.weapon === 1811 && record.count > 0 ? [{item: `inventory:${key}`, condition: record.condition ?? 100, pattern: record.fittingPattern}] : []),
  ].map(source => ({...source, label: fittingLabel(source.pattern), weight: weaponItemWeight(1811), preview: fitBayonetPreview(state, unit, source.item), action: {type: 'fitBayonet', item: source.item}}));
  const attached = unit.weaponFittings?.bayonet;
  return {sources, attached: attached ? {...attached, label: fittingLabel(attached.fittingPattern), weight: weaponItemWeight(attached.weapon), hostCondition: unit.condition, removals: ['inventory', 'blade'].map(destination => ({destination, label: destination === 'inventory' ? 'Retirar a mochila' : 'Retirar a secundaria', preview: removeBayonetPreview(state, unit, destination), action: {type: 'removeBayonet', destination}}))} : null};
}

export function equippedItemHelp(state, unit, ctx = {}) {
  if (!unit) return 'Seleccioná un combatiente.';
  const weapon = weaponFor(unit), costs = actionCosts(state, unit), exploring=state.mode==='exploration';
  if (unit.activeSlot === 'supply') return `${weapon.name} · ${exploring?0:supplyUsePreview(state, unit, ctx.target).cost} PA. ${targetingHelp('useItem', unit)}`;
  if (unit.activeSlot === 'tool') return `${weapon.name}. Seleccioná una puerta o un cofre para usarla.`;
  if (unit.activeSlot === 'medical' && exploring) return 'Vendas: sin coste de PA. Seleccionate a vos o a un aliado herido. Consume tiempo y vendas. Detiene la hemorragia; no recupera salud.';
  if (unit.activeSlot === 'medical') return `Vendas: ${costs.heal} PA, más el desplazamiento. Seleccionate a vos o a un aliado herido. Se acerca y venda si hay PA suficientes. Detiene la hemorragia; no recupera salud.`;
  const attack = contextualAttack(state, unit, ctx.target, {type: ctx.mode, aim: ctx.aim || 0});
  const reload = attack.type === 'fire' ? emptyGunPreview(state, unit) : null;
  if (reload) return `${weapon.name} · ${reload.actionLabel}${reload.valid ? `: ${reload.pa} PA. ${reload.coverNote}` : `. ${reload.reason}`}`;
  const approach=ctx.target&&['move','useItem',undefined].includes(ctx.mode)?itemUsePreview(state,unit,ctx.target):null;
  if(approach?.movePa&&exploring)return `${weapon.name} · sin coste de PA. Se acerca y usa el objeto. El contacto puede detener la acción.`;
  if(approach?.movePa)return `${weapon.name} · ${approach.pa} PA (${approach.movePa} para acercarse y ${approach.actionPa} para usarlo). El contacto puede detener la acción.`;
  const label = attack.type === 'melee' && hasFirearm(unit) ? fixedBayonetFor(unit) ? 'Estocada de bayoneta' : 'Culatazo' : weapon.name;
  return `${label} · ${exploring?0:attack.pa} PA. ${attack.type==='fire'?firearmCostText(state,unit,ctx.target)+' ':''}${fixedBayonetFor(unit) || ctx.mode === 'fire' ? targetingHelp(ctx.mode || 'move', unit) : 'Seleccioná un enemigo para usarlo.'}`;
}

export function levelFor(unit) {
  if (Number.isFinite(unit.experienceLevel)) return unit.experienceLevel;
  return Math.floor((unit.agility + unit.dexterity + unit.strength + unit.leadership + unit.wisdom + unit.marksmanship + unit.mechanical + unit.explosives + unit.medical + unit.maxHp) / 100);
}

export function rosterCells(players, selectedId, state) {
  const cells = fieldUnits({units: players}).map((unit, index) => {
    const fallen = unit.hp <= 0 || unit.routed || unit.unconscious;
    return {
      unit,
      portrait: unit.portrait ?? null,
      label: shortName(unit),
      hpPct: Math.max(0, Math.min(100, Math.round((100 * unit.hp) / unit.maxHp))),
      ap: unit.ap,
      energy: unit.energy,
      bleeding: unit.bleeding || 0,
      bandaged: unit.bandaged || 0,
      apPct: Math.max(0, Math.min(100, unit.ap / Math.max(1, (unit.maxAP || 100) + (unit.carriedAP || 0)) * 100)),
      active: unit.id === selectedId,
      fallen,
      disabled: fallen || (state ? !unitCanAct(state, unit) : false),
      interruptReady: state?.phase === 'interrupt' && unitCanAct(state, unit),
      index,
    };
  });
  while (cells.length < 6) cells.push({empty: true});
  return cells;
}

export function slotAction(unit) {
  const tools = toolItems(unit), supplies = supplyItems(unit), slots = ['primary', 'blade', 'medical', ...(tools.length ? ['tool'] : []), ...(supplies.length ? ['supply'] : []), 'unarmed'], current = slots.indexOf(unit.activeSlot || 'primary');
  if (unit.activeSlot === 'supply') {
    const next = supplies[supplies.findIndex(supply => supply.key === unit.activeSupply) + 1];
    if (next) return {type: 'weapon', slot: 'supply', supplyKey: next.key};
  }
  const available = slot => ['unarmed', 'tool', 'supply'].includes(slot) || (slot === 'medical' ? unit.medkits > 0 : slot === 'blade' ? Boolean(BLADES[unit.blade]) : hasPrimary(unit));
  const slot = Array.from({length: slots.length}, (_, offset) => slots[(current + offset + 1) % slots.length]).find(available) || 'unarmed';
  return {type: 'weapon', slot, ...(slot === 'tool' ? {toolKey: tools.find(tool => tool.item === unit.activeTool)?.item || tools[0].item} : slot === 'supply' ? {supplyKey: supplies[0].key} : {})};
}

export function equipmentSlots(state, unit, ctx = {}) {
  const pa = state.mode === 'exploration' ? 0 : actionCosts(state, unit).weapon;
  const tools = toolItems(unit), activeTool = tools.find(tool => tool.item === unit.activeTool) || tools[0], supplies = supplyItems(unit), activeSupply = supplies.find(supply => supply.key === unit.activeSupply) || supplies[0];
  return [['primary', 'Arma'], ['blade', 'Arma blanca'], ['medical', `Vendas · ${unit.medkits ?? 0}`], ...(tools.length ? [['tool', 'Herramienta']] : []), ...(supplies.length ? [['supply', `${activeSupply.label} · ${activeSupply.count}`]] : []), ['unarmed', 'Manos libres']].map(([slot, label]) => ({slot, label, pa, action: {type: 'weapon', slot, ...(slot === 'tool' ? {toolKey: activeTool.item} : slot === 'supply' ? {supplyKey: activeSupply.key} : {})}, active: (unit.activeSlot || 'primary') === slot, disabled: !unitCanAct(state, unit) || Boolean(ctx.busy) || Boolean(unit.knockedDown) || !affordable(state, unit, pa) || (slot === 'medical' ? !(unit.medkits > 0) : slot === 'blade' ? !BLADES[unit.blade] : slot === 'primary' ? !hasPrimary(unit) : false)})).map(option=>{
    const held={...unit,activeSlot:option.slot,activeTool:option.action.toolKey,activeSupply:option.action.supplyKey};
    let reason=null;try{if(inventoryUsage(held).overloaded)reason='No queda espacio para guardar el objeto en mano.';}catch(error){reason=error.message;}
    return {...option,reason,disabled:option.disabled||Boolean(reason)};
  });
}

export function handSlots(state,unit){
 const layout=handLayout(unit),options=equipmentSlots(state,unit);
 return ['right','left'].map(side=>{
  const reference=layout[side],blocked=side==='left'&&layout.twoHanded;
  const descriptor=reference?itemDescriptor(unit,reference):null;
  const option=reference==='offhand'?{...swapHandsPreview(state,unit),action:{type:'swapHands'}}:options.find(o=>o.slot===reference);
  return {side,item:reference,blocked,label:descriptor?.label??(blocked?'Ocupada por el arma':'Vacía'),weapon:descriptor?.weapon,loaded:descriptor?.loaded,condition:descriptor?.condition,action:side==='left'?option?.action:null,pa:option?.pa,reason:option?.reason,disabled:blocked||side==='left'&&(option?.disabled||option?.valid===false)};
 });
}

export function backpackEquipAction(key, slot) {
  return {type: 'equipLoot', inventoryKey: key, slot};
}

export function inventoryModel(state, unit) {
  const tools = toolItems(unit);
  const stats = [
    {id: 'agility', label: 'Agilidad', value: unit.agility},
    {id: 'dexterity', label: 'Destreza', value: unit.dexterity},
    {id: 'strength', label: 'Fuerza', value: unit.strength},
    {id: 'leadership', label: 'Liderazgo', value: unit.leadership},
    {id: 'wisdom', label: 'Sabiduría', value: unit.wisdom},
    {id: 'level', label: 'Nivel', value: levelFor(unit)},
    {id: 'marksmanship', label: 'Puntería', value: unit.marksmanship},
    {id: 'explosives', label: 'Pólvora y artillería', value: unit.explosives},
    {id: 'mechanical', label: 'Mecánica', value: unit.mechanical},
    {id: 'medical', label: 'Medicina', value: unit.medical},
  ];
  const supplies = [
    {id: 'ammo', label: 'Cartuchos', count: unit.ammo},
    {id: 'priming', label: 'Cebado', count: unit.priming},
    {id: 'flints', label: 'Sílex', count: unit.flints},
    {id: 'rations', label: 'Raciones', count: unit.rations},
    {id: 'medkits', label: 'Vendas', count: unit.medkits ?? 0},
    {id: 'boleadoras', label: 'Boleadoras', count: unit.boleadoras},
    {id: 'torches', label: 'Antorchas', count: unit.torches},
  ];
  const backpack = Object.entries(unit.inventory || {})
    .filter(([, record]) => record && (typeof record === 'object' || Number.isInteger(record)))
    .map(([key, value]) => {
      const record = typeof value === 'object' ? value : {count: value, weight: 0};
      const weapon = WEAPONS[record.weapon];
      const blade = BLADES[record.weapon];
      return {
        key,
        ...record,
        equippable: Boolean(weapon || blade || record.kind === 'outfit'),
        name: record.weapon === 1811 ? fittingLabel(record.fittingPattern) : weapon?.name ?? blade?.name ?? OUTFITS[record.outfit]?.name ?? tools.find(tool => tool.key === key)?.name ?? null,
      };
    });
  const outfit=wornOutfit(unit);
  const items = [
    ...(outfit ? [{...outfit,item:'outfit',label:OUTFITS[outfit.outfit].name}] : []),
    ...(hasPrimary(unit) ? [{item: 'primary', label: weaponFor({...unit, activeSlot: 'primary'}).name, count: 1, loaded: unit.loaded, condition: unit.condition, jammed: Boolean(unit.jammed)}] : []),
    ...(BLADES[unit.blade] ? [{item: 'blade', label: BLADES[unit.blade].name, count: 1}] : []),
    ...(unit.offHand ? [{...itemDescriptor(unit,'offhand'),...unit.offHand,item:'offhand',count:1}] : []),
    ...supplies.filter(supply => supply.count > 0).map(supply => ({item: supply.id, label: supply.label, count: supply.count})),
    ...backpack.filter(record => record.count > 0).map(record => ({...record, item: `inventory:${record.key}`, label: record.name || 'Pertrechos'})),
  ];
  let pockets;
  try { pockets = inventoryUsage(unit); }
  catch { pockets = {used: null, capacity: INVENTORY_CAPACITY, free: 0, overloaded: true, items: [], slots: [], overflow: []}; }
  return {
    stats,
    hands: handSlots(state,unit),
    slots: {primary: weaponFor({...unit, activeSlot: 'primary'}), blade: BLADES[unit.blade] ? bladeFor({...unit, activeSlot: 'blade'}) : null, medical: {name: 'Vendas de campaña', count: unit.medkits ?? 0}},
    activeSlot: unit.activeSlot,
    weight: carriedWeight(unit),
    capacity: carryCapacity(unit),
    outfit: outfit ? {...outfit,label:OUTFITS[outfit.outfit].name} : null,
    poncho: hasPoncho(unit),
    supplies,
    heldSupplies: supplyItems(unit),
    backpack,
    items,
    pockets,
    tools,
    fittings: fittingInventoryModel(state, unit),
    unitAlive: alive(unit),
    unitReady: unitCanAct(state, unit),
    apBudget: actionPointBudget(state, unit),
    currentAPLimit: (unit.maxAP || 100) + (unit.carriedAP || 0),
    equipCost: actionCosts(state, unit).equipLoot,
  };
}

export function inventoryHandlingModel(state, unit, ctx = {}) {
  const recipients = state.units.filter(target => target.id !== unit.id && target.side === unit.side && target.hp > 0 && !target.routed && !target.fled && !target.departure);
  const target = recipients.find(target => target.id === ctx.targetId);
  const transfer = transferPreview(state, unit, target, ctx.item, ctx.count ?? 1);
  const drop = dropPreview(state, unit, ctx.item, ctx.count ?? 1);
  return {
    recipients,
    transfer: {...transfer,
      action: {type:'transfer',targetId:target?.id,item:ctx.item,count:ctx.count??1,transferKind:transfer.kind,transferRoute:transfer.route.map(v=>v.id)},
      label: !target ? 'Dar o arrojar' : transfer.kind === 'relay' ? 'Pasar por aliados' : transfer.kind === 'throw' ? 'Arrojar al aliado' : 'Dar al aliado',
      detail: transfer.kind === 'relay'
        ? `${transfer.route.map(v=>`${v.name} (${v.pa} PA)`).join(' → ')}. ${transfer.totalPA} PA en total. Entrega segura.`
        : transfer.kind === 'throw' ? `${transfer.chance}% de recepción. El aliado necesita 2 PA; si falla, el objeto cae al suelo.` : 'Entrega directa al aliado contiguo.',
      disabled: Boolean(ctx.busy) || !transfer.valid},
    drop: {...drop, disabled: Boolean(ctx.busy) || !drop.valid},
  };
}

export function nearbyLootOptions(state, unit, point=/** @type {{x:number,y:number}|null} */ (null)) {
  if (!unit) return [];
  const options = [], visible = source => (point?source.x===point.x&&source.y===point.y:distance(unit, source)<=1.5) && canSee(state, unit, source);
  for (const source of state.units) {
    if (source.id === unit.id || source.fled || source.departure || !(source.hp <= 0 || source.unconscious || source.surrendered) || distance(unit,source)>1.5 || !visible(source)) continue;
    for (const item of inventoryModel(state, source).items) {
      options.push({...item, id: `unit:${source.id}:${item.item}`, source: source.name, action: {type: 'loot', targetId: source.id, item: item.item === 'primary' ? 'weapon' : item.item}});
    }
  }
  for (const [index, source] of (state.droppedWeapons || []).entries()) {
    if (source.taken || !visible(source)) continue;
    options.push({...source, id: `drop:${index}`, label: WEAPONS[source.weapon]?.name || BLADES[source.weapon]?.name || 'Arma', count: 1, source: 'En el suelo', action: {type: 'loot', dropIndex: index}});
  }
  for (const source of state.groundItems || []) {
    if (source.heldBy || !(source.count > 0) || !visible(source)) continue;
    const stack = source.stack || source;
    options.push({...stack, id: `ground:${source.id}`, label: WEAPONS[stack.weapon]?.name || BLADES[stack.weapon]?.name || OUTFITS[stack.outfit]?.name || SUPPLY_ITEMS[stack.item || stack.type]?.label || 'Objeto', count: source.count, source: 'En el suelo', action: {type: 'loot', groundId: source.id}});
  }
  return options;
}
export function pickupSelection(state,unit,point,ctx={}){
  if(!unit||!point)return [];
  const mode=ctx.mode??'move';
  if(mode!=='loot'){
    if(!['move','useItem'].includes(mode)||ctx.movementIntent==='preserveFacing'||ctx.itemIntent!=='steal'&&unit.activeSlot==='supply'&&unit.activeSupply==='torches')return [];
    const occupant=state.units.find(other=>!other.departure&&other.x===point.x&&other.y===point.y&&(other.side===unit.side||canSee(state,unit,other)));
    if(occupant&&!point.loot&&ctx.itemIntent!=='steal'&&(occupant.hp>0||unit.activeSlot==='medical'))return [];
  }
  const preview=lootSearchPreview(state,unit,point);
  return preview.available?[preview]:[];
}
export function lootSelectionModel(state,unit,point,{id='',count=1}={}){
  const options=nearbyLootOptions(state,unit,point),item=options.find(option=>option.id===id)||options[0];
  const action=item?{...item.action,count}:null,preview=action?lootApproachPreview(state,unit,action):null;
  return {options,item,action,preview};
}
export function lootBatchSelectionModel(state,unit,point,selection={}){
  const options=nearbyLootOptions(state,unit,point),items=[];let missing=false;
  for(const [id,count]of Object.entries(selection)){
    const option=options.find(entry=>entry.id===id);if(!option){missing=true;continue;}
    const {type,...source}=option.action;items.push({...source,count});
  }
  const action={type:'lootBatch',items},preview=missing?{pa:8,valid:false,reason:'Un objeto seleccionado ya no está disponible. Revisá la selección.'}:lootBatchPreview(state,unit,items);
  return {options,action,preview,selectedCount:Object.keys(selection).length};
}
export function groundLootPiles(state,actors){
  const piles=new Map();
  for(const source of [...(state.droppedWeapons??[]).filter(item=>!item.taken),...(state.groundItems??[]).filter(item=>item.count>0&&!item.heldBy)]){
    if(!actors.some(actor=>canSee(state,actor,source)))continue;
    const key=`${source.x},${source.y}`,pile=piles.get(key)??{x:source.x,y:source.y,count:0};pile.count++;piles.set(key,pile);
  }
  return [...piles.values()];
}

export function nearbyEnvironmentModel(state, unit, ctx = {}) {
  const found = new Map();
  if (unit) for (const point of state.tiles) {
    if (distance(unit, point) > 1.5 || !canSee(state, unit, point)) continue;
    const raw = environmentTargetAt(state, point);
    if (raw) found.set(`${raw.kind}:${raw.id}`, raw);
  }
  const targets = [...found].map(([key, raw]) => {
    const summary = environmentTargetSummary(unit, raw);
    return {key, kind: raw.kind, id: raw.id, label: `${summary.label} · ${tacticalGridLabel(raw.x,raw.y)}`, open: summary.open, locked: summary.locked, broken: summary.broken, trapKnown: Boolean(summary.trap), trapArmed: summary.trap?.armed};
  });
  const target = targets.find(entry => entry.key === ctx.targetKey) || targets[0];
  if (!target) return {targets, target: null, preview: null, contents: [], verbs: [], loot: null};
  const raw = found.get(target.key), preview = environmentPreview(state, unit, target, ctx.verb || undefined);
  const contents = visibleContainerContents(raw).map((stack, index) => ({...stack, index, label: WEAPONS[stack.weapon]?.name || BLADES[stack.weapon]?.name || OUTFITS[stack.outfit]?.name || TOOL_TYPES[stack.toolKey]?.label || SUPPLY_ITEMS[stack.item]?.label || 'Pertrechos'}));
  const verbs = ENVIRONMENT_VERBS.map(id => ({id, label: environmentPreview(state, unit, target, id).label}));
  const loot = target.kind === 'container' ? containerLootPreview(state, unit, target, ctx.index ?? 0, ctx.count ?? 1) : null;
  return {targets, target, preview, contents, verbs, loot};
}

const ORDER_DEFS = [
  {id: 'move', label: 'Mover', kind: 'mode'},
  {id: 'look', label: 'Mirar', kind: 'mode'},
  {id: 'stealth', label: 'Sigilo', kind: 'order'},
  {id: 'useItem', label: 'Usar objeto equipado', kind: 'mode'},
  {id: 'fire', label: 'Disparar', kind: 'mode'},
  {id: 'melee', label: 'Atacar', kind: 'mode'},
  {id: 'charge', label: 'Cargar', kind: 'mode'},
  {id: 'heal', label: 'Vendar', kind: 'mode'},
  {id: 'loot', label: 'Recoger equipo', kind: 'mode'},
  {id: 'reload', label: 'Recargar', kind: 'order'},
  {id: 'reprime', label: 'Cebar', kind: 'order'},
  {id: 'weapon', label: 'Cambiar arma', kind: 'order'},
  {id: 'stance', label: 'Postura', kind: 'order'},
  {id: 'overwatch', label: 'Cubrir', kind: 'order'},
  {id: 'mount', label: 'Montar', kind: 'order'},
  {id: 'brace', label: 'Guardia de bayoneta', kind: 'order'},
  {id: 'repair', label: 'Cambiar sílex', kind: 'order'},
  {id: 'ration', label: 'Comer tasajo', kind: 'order'},
  {id: 'torch', label: 'Arrojar antorcha', kind: 'mode'},
  {id: 'bolas', label: 'Lanzar boleadoras', kind: 'mode'},
  {id: 'free', label: 'Liberarse', kind: 'order'},
  {id: 'sight', label: 'Campo de visión', kind: 'toggle'},
  {id: 'endTurn', label: 'Fin del turno', kind: 'order'},
  {id: 'artillery', label: 'Disparar cañón', kind: 'mode'},
  {id: 'artilleryMove', label: 'Desplazar pieza', kind: 'mode'},
  {id: 'artilleryPivot', label: 'Girar pieza', kind: 'mode'},
  {id: 'artilleryReload', label: 'Recargar pieza', kind: 'order'},
];

export function orderDescriptors(state, unit, ctx = {}) {
  const u = unit || {};
  const unitAlive = Boolean(unit) && alive(u);
  const busy = Boolean(ctx.busy);
  const statusActive = state.status === 'active';
  const baseDisabled = !unitAlive || busy || !statusActive || !unitCanAct(state, unit);
  const firearm = hasFirearm(u);
  const blade = bladeFor(u);
  const gun = (state.artillery || []).find(g => g.id === ctx.cannonId && g.side === u.side);
  const costs = unit ? actionCosts(state, unit) : {};
  const pa = {...costs, reload: unit ? reloadPlan(unit, state).pa : 0, fire: costs.fire + Math.max(0, Math.min(4, Math.floor(ctx.aim || 0))) * costs.aim, stance: unit ? stanceCost(u, nextStance(u)) : 0};
  const attack = unit && !['medical', 'tool', 'supply'].includes(u.activeSlot) ? contextualAttack(state, u, ctx.target, {aim: ctx.aim || 0}) : null;
  const medicalPreview = medicalUsePreview(state, unit, ctx.target ?? unit);
  const itemPreview=ctx.target?itemUsePreview(state,unit,ctx.target):null;
  const supplyAliases = {
    ration: supplyUsePreview(state, unit, ctx.target ?? unit, 'rations'),
    torch: supplyUsePreview(state, unit, ctx.target ?? {x: ctx.x, y: ctx.y}, 'torches'),
    bolas: supplyUsePreview(state, unit, ctx.target, 'boleadoras'),
  };
  pa.heal = medicalPreview.cost;
  for (const [id, preview] of Object.entries(supplyAliases)) pa[id] = preview.cost;
  pa.useItem = u.activeSlot === 'medical' ? medicalPreview.cost : attack?.pa ?? costs.melee;
  if(itemPreview)pa.useItem=itemPreview.pa;
  const supplyPreview = u.activeSlot === 'supply' ? supplyUsePreview(state, u, ctx.target ?? (u.activeSupply === 'rations' ? u : undefined)) : null;
  if (supplyPreview) pa.useItem = supplyPreview.cost;
  if (u.activeSlot === 'tool') delete pa.useItem;
  if (gun && unit) {
    const gunCosts = artilleryCosts(state, unit, gun);
    for (const [id, costId] of [['artillery', 'fire'], ['artilleryMove', 'move'], ['artilleryPivot', 'pivot'], ['artilleryReload', 'reload']]) pa[id] = id==='artilleryReload'?artilleryReloadPreview(state,unit,gun).pa:gunCosts[costId];
  }

  const disabled = {
    move: Boolean(u.entangled),
    look: false,
    stealth: Boolean(u.mounted) && !u.stealthMode,
    useItem: itemPreview ? !itemPreview.valid : u.activeSlot === 'supply' ? !(u[u.activeSupply] > 0) || (u.activeSupply === 'rations' || ctx.target) && !supplyPreview.allowed : u.activeSlot === 'tool' ? !heldTool(u) : u.activeSlot === 'medical' ? !medicalPreview.allowed : attack?.type === 'fire' && (!(u.loaded > 0) || Boolean(u.jammed)),
    fire: !firearm || !(u.loaded > 0) || Boolean(u.jammed),
    melee: false,
    charge: false,
    heal: !medicalPreview.allowed,
    loot: false,
    reload: !firearm || !pa.reload || !(u.ammo > 0) || u.loaded >= weaponFor(u).capacity,
    reprime: !firearm || !u.jammed || !(u.priming > 0),
    weapon: false,
    stance: Boolean(u.mounted),
    overwatch: !u.overwatch && (!firearm || !(u.loaded > 0) || Boolean(u.jammed)),
    mount: !u.horse,
    brace: !fixedBayonetFor(u),
    repair: !firearm || (u.flints ?? 4) < 1,
    ration: !supplyAliases.ration.allowed,
    torch: !supplyAliases.torch.allowed,
    bolas: !supplyAliases.bolas.allowed,
    free: !u.entangled,
    sight: false,
    endTurn: false,
    artillery: !gun || !gun.loaded,
    artilleryMove: !gun,
    artilleryPivot: !gun,
    artilleryReload: !gun || Boolean(gun.loaded) || !(gun.ammo > 0),
  };

  const active = {
    overwatch: Boolean(u.overwatch),
    brace: Boolean(u.braced),
    stealth: Boolean(u.stealthMode),
  };

  return ORDER_DEFS.map(def => {
    const reserveOff = def.id === 'overwatch' && u.overwatch;
    let unavailable = Boolean(disabled[def.id]) || (Boolean(u.knockedDown) && !['stance', 'heal', 'ration', 'sight', 'endTurn', ...(u.activeSlot === 'medical' || u.activeSlot === 'supply' && u.activeSupply === 'rations' ? ['useItem'] : [])].includes(def.id));
    if (gun && def.id.startsWith('artillery')) {
      const crew = def.id==='artilleryReload'?artilleryReloadPreview(state,unit,gun):artilleryCrewPlan(state,unit,gun,pa[def.id]);
      unavailable ||= Boolean(crew.reason);
    }
    const label = def.id === 'useItem' ? u.activeSlot === 'supply' ? 'Usar pertrecho' : u.activeSlot === 'tool' ? 'Usar herramienta' : u.activeSlot === 'medical' ? 'Usar vendas' : firearm ? 'Usar arma' : u.activeSlot === 'unarmed' ? 'Usar puños' : 'Usar arma blanca' : def.id === 'stance' ? stanceLabel(nextStance(u)) : def.id === 'overwatch' && u.overwatch ? 'Cancelar cobertura' : def.label;
    /** @type {{id:string,label:string,kind:string,disabled:boolean,pa?:number,reserve?:boolean,active?:boolean}} */
    const d = {id: def.id, label, kind: def.kind, disabled: baseDisabled || unavailable || (!reserveOff && def.id in pa && !affordable(state, u, pa[def.id]))};
    if (def.id === 'overwatch') d.reserve = !reserveOff;
    if (def.id in pa) d.pa = state.mode === 'exploration' ? 0 : pa[def.id];
    // Pickup can mean an 8-AP corpse search or an all-remaining-AP grab.
    // Show its actual cost on the target preview, not on the shared cursor.
    if (def.id === 'loot' && u.activeSlot === 'unarmed') delete d.pa;
    if (reserveOff) d.pa = 0;
    if (def.id in active) d.active = active[def.id];
    return d;
  });
}

export function orderAction(state, unit, ctx = {}, id) {
  switch (id) {
    case 'movement':
      return {type: 'movement', movement: ctx.movement};
    case 'look':
      return {type: 'look', x: ctx.x, y: ctx.y};
    case 'stealth':
      return {type: 'stealth', enabled: ctx.enabled ?? !unit.stealthMode};
    case 'reload':
    case 'reprime':
    case 'overwatch':
    case 'mount':
    case 'brace':
    case 'repair':
    case 'ration':
    case 'free':
      return {type: id};
    case 'weapon':
      return slotAction(unit);
    case 'stance':
      return {type: 'stance', stance: ctx.stance || nextStance(unit)};
    case 'equipLoot':
      return {type: 'equipLoot', inventoryKey: ctx.inventoryKey, slot: ctx.slot};
    case 'torch':
      return {type: 'throwTorch', x: ctx.x, y: ctx.y};
    case 'bolas':
      return {type: 'boleadoras', targetId: ctx.targetId};
    case 'artillery':
      return {type: 'artillery', artilleryId: ctx.artilleryId, x: ctx.x, y: ctx.y, targetId: ctx.targetId, mode: ctx.mode};
    case 'artilleryMove':
    case 'artilleryPivot':
      return {type: id, artilleryId: ctx.artilleryId, x: ctx.x, y: ctx.y};
    case 'artilleryReload':
      return {type: 'artilleryReload', artilleryId: ctx.artilleryId};
    case 'endTurn':
      return {type: 'rest'};
    case 'move':
      return {type: 'move', x: ctx.x, y: ctx.y};
    case 'fire':
      return {type: 'fire', targetId: ctx.targetId};
    case 'melee':
      return {type: 'melee', targetId: ctx.targetId};
    case 'charge':
      return {type: 'charge', targetId: ctx.targetId};
    case 'heal':
      return {type: 'heal', targetId: ctx.targetId};
    case 'useItem':
      return {type: 'useItem', targetId: ctx.targetId, aim: ctx.aim || 0, hitLocation: hitLocationFor(ctx.hitLocation)};
    case 'loot':
      return {type: 'loot', targetId: ctx.targetId};
    default:
      return {type: id};
  }
}


/** Keep departure receipts in the saved state, outside all field render lists. */
export function fieldUnits(state) { return state.units.filter(unit => !unit.departure && !unit.fled); }
export function fieldState(state) { return {...state, units: fieldUnits(state)}; }

export function exitModel(state, {unitIds = /** @type {string[]} */ ([]), exitId = ''} = {}) {
  const units = fieldUnits(state).filter(unit => unit.side === 'player' && unit.hp > 0);
  const ids = [...new Set(unitIds)].filter(id => units.some(unit => unit.id === id));
  const exits = (state.exits || []).map(exit => ({...exit, label: `${({N: 'Norte', E: 'Este', S: 'Sur', W: 'Oeste'})[exit.edge] || exit.edge} · ${String(exit.destination).replaceAll('_', ' ')}`}));
  const selectedExit = exits.find(exit => exit.id === exitId) || exits[0];
  const preview = exitPreview(state, {unitIds: ids, exitId: selectedExit?.id});
  const action = {type: 'exit', unitIds: ids, exitId: selectedExit?.id};
  return {units, exits, selectedExit, unitIds: ids, preview, action, departures: state.units.filter(unit => unit.side === 'player' && unit.departure)};
}
