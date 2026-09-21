import {sameCell} from './tactical-space.js';
import {atHand,moveOrder,planningPoint} from './tactical-planning-space.js';
import {actBattle, canEndCombat, CRITICAL_HEALTH, getReachable, hasLineOfSight} from './tactical.js';
import {criticalFirstAidNeeded} from './first-aid.js';

const present = unit => unit.side === 'player' && unit.hp > 0 && !unit.routed && !unit.fled && !unit.departure && !unit.surrendered;
const needsBandage = unit => present(unit) && (criticalFirstAidNeeded(unit) || unit.bleeding > 0 || (unit.bandaged ?? 0) < unit.maxHp - unit.hp);
const conscious = unit => present(unit) && unit.hp >= CRITICAL_HEALTH && !unit.unconscious && (unit.energy ?? 100) > 0;
const doctorReady = unit => !unit.militia && conscious(unit) && unit.medical > 0 && (!unit.knockedDown || unit.activeSlot === 'medical');
const summary = unit => ({id: unit.id, name: unit.nickname || unit.name, hp: unit.hp, bleeding: unit.bleeding ?? 0, medkits: unit.medkits ?? 0});
const DANGER = 'Vendaje detenido: hay contacto o señales recientes del enemigo.';

function admissionReason(state) {
  const exploring = state.status === 'active' && state.mode === 'exploration' && state.phase === 'player';
  const clearedVictory = state.status === 'victory' && state.sectorCleared;
  if (!exploring && !clearedVictory) return 'Solo se puede vendar la escuadra al explorar un sector seguro o después de la victoria.';
  // Corpses and incapacitated enemies can leave stale contact memories after victory.
  const capableEnemy = state.units.some(unit => unit.side === 'enemy' && unit.hp >= CRITICAL_HEALTH && !unit.unconscious && !unit.routed && !unit.fled && !unit.departure && !unit.surrendered && (unit.energy ?? 100) > 0);
  if (capableEnemy && (!canEndCombat({...state, status: 'active', mode: 'combat', phase: 'player'}) || state.units.some(u => conscious(u) && [u.lastKnownEnemy, u.lastHeardNoise].some(k => k && state.turn - k.turn <= 3)))) return DANGER;
  return null;
}

/** Read-only admission and squad summary. No hidden enemy identity is returned. */
export function autoBandageStatus(state) {
  const patients = state.units.filter(needsBandage);
  const doctors = state.units.filter(doctorReady);
  const reason = admissionReason(state) || (!patients.length ? 'Todas las heridas están vendadas.' : !doctors.length ? 'No hay un sanitario consciente y disponible.' : !doctors.some(unit => unit.medkits > 0) ? 'Los sanitarios no tienen vendas.' : null);
  return {available: !reason, reason, patients: patients.map(summary), doctors: doctors.map(summary)};
}

function plansFor(state) {
  const patients = state.units.filter(needsBandage);
  const doctors = state.units.filter(unit => doctorReady(unit) && unit.medkits > 0);
  const plans = [];
  for (const doctor of doctors) {
    const reachable = doctor.knockedDown || doctor.entangled ? [{...planningPoint(doctor), cost: 0, path: []}] : getReachable(state, doctor);
    for (const patient of patients) {
      let destination = reachable.filter(point => atHand(point,patient) && hasLineOfSight(state, point, patient)).sort((a, b) => a.cost - b.cost || a.path.length - b.path.length)[0],stand=false;
      if(!destination&&state.climbLinks?.length&&doctor.stance!=='standing'&&!doctor.knockedDown&&!doctor.entangled&&!doctor.mounted){
        const upright={...doctor,stance:'standing',movementMode:'walk'};
        destination=getReachable(state,upright).filter(point=>atHand(point,patient)&&hasLineOfSight(state,point,patient)&&point.path.some(step=>step.kind==='climb')).sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length)[0];stand=Boolean(destination);
      }
      if (destination) plans.push({doctor, patient, destination,stand});
    }
  }
  // Stabilize a bleeding medic before sending them across the sector.
  const selfCare = plan => plan.doctor.id === plan.patient.id && plan.patient.bleeding > 0 ? 0 : 1;
  const urgency = patient => patient.bleeding > 0 ? patient.hp / patient.bleeding : Infinity;
  return plans.sort((a, b) => selfCare(a) - selfCare(b) || urgency(a.patient) - urgency(b.patient) || a.destination.cost - b.destination.cost || b.doctor.medical - a.doctor.medical || String(a.patient.id).localeCompare(String(b.patient.id)) || String(a.doctor.id).localeCompare(String(b.doctor.id)));
}

/** Execute ordinary tactical orders, including paid critical stabilization. */
export function autoBandageBattle(state) {
  let battle = state;
  const steps = [], treatedIds = [];
  const initialPatients = state.units.filter(needsBandage).map(unit => unit.id);
  const initial = autoBandageStatus(state);
  let stoppedReason = initial.reason;
  if (initial.available) {
    stoppedReason = null;
    if (battle.status === 'victory') {
      const action = {type: 'explore'};
      battle = actBattle(battle, action); steps.push(action);
      if (battle.lastError) stoppedReason = battle.lastError;
    }
    // Each successful treatment consumes one existing dressing. Bound extra
    // stand/equip/approach orders per stroke; rescued medics can use their kits.
    // Never refill supplies or rest to finish.
    const limit = state.units.filter(u=>present(u)&&!u.militia&&u.medical>0).reduce((sum,u)=>sum+(u.medkits??0),0)*4+1;
    while (!stoppedReason && battle.units.some(needsBandage)) {
      const danger = admissionReason(battle);
      if (danger) { stoppedReason = danger; break; }
      if (steps.length >= limit) { stoppedReason = 'Vendaje detenido: no se pudo completar una orden.'; break; }
      const plan = plansFor(battle)[0];
      if (!plan) { stoppedReason = autoBandageStatus(battle).reason || 'No hay un camino abierto hasta los heridos pendientes.'; break; }
      const {doctor, patient, destination,stand} = plan;
      const action = stand ? {type:'stance',unitId:doctor.id,stance:'standing'} : doctor.activeSlot !== 'medical' ? {type: 'weapon', unitId: doctor.id, slot: 'medical'} : destination.path.length ? moveOrder(battle,doctor,destination) : {type: 'useItem', unitId: doctor.id, targetId: patient.id};
      const next = actBattle(battle, action);
      steps.push(action);
      battle = next;
      if (next.lastError) { stoppedReason = next.lastError; break; }
      const actor = next.units.find(unit => unit.id === doctor.id);
      const casualty = next.units.find(unit => unit.id === patient.id);
      const progressed = action.type === 'stance' ? actor.stance==='standing' : action.type === 'weapon' ? actor.activeSlot === 'medical' : action.type === 'move' ? !sameCell(actor,doctor) : actor.medkits < doctor.medkits && (casualty.hp>patient.hp||casualty.bleeding<patient.bleeding||(casualty.bandaged??0)>(patient.bandaged??0));
      if (action.type === 'useItem' && progressed && !needsBandage(casualty) && !treatedIds.includes(patient.id)) treatedIds.push(patient.id);
      if (next.mode !== 'exploration' || next.phase !== 'player') { stoppedReason = DANGER; break; }
      if (!conscious(actor)) { stoppedReason = 'Vendaje detenido: el sanitario quedó sin fuerzas o fuera de combate.'; break; }
      if (next.status !== 'active' || admissionReason(next)) { stoppedReason = DANGER; break; }
      if (!progressed) { stoppedReason = 'Vendaje detenido: la orden no produjo avance.'; break; }
    }
  }
  const pending = new Set([...initialPatients, ...battle.units.filter(needsBandage).map(unit => unit.id)]);
  const untreated = [...pending].flatMap(id => {
    const unit = battle.units.find(candidate => candidate.id === id);
    if (unit && !needsBandage(unit) && unit.hp > 0 && !unit.routed && !unit.fled && !unit.departure && !unit.surrendered) return [];
    const reason = !unit || unit.hp <= 0 ? 'Murió antes de recibir las vendas.' : unit.routed || unit.fled ? 'Ya no está disponible en el sector.' : stoppedReason || 'No hay un camino abierto hasta este herido.';
    return [{id, name: unit?.nickname || unit?.name || id, reason}];
  });
  return {battle, treatedIds, steps, stoppedReason: untreated.length ? stoppedReason : null, untreated, elapsedSeconds: (battle.elapsedSeconds ?? 0) - (state.elapsedSeconds ?? 0)};
}
