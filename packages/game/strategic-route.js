import { journeyRefusalMessage } from './infrastructure/journeys/journey-refusal-messages.js';
import { isSupplied } from './campaign.js';
import { campaignSectors } from './campaign-definition.js';
import {
  queueSquadTravel,
  squadTravelStatus,
  previewJourneyRedirection,
  hasPendingArrivalDecision,
} from './squad-travel.js';
import { worldCell, locationId, worldOwner, cellTravelReason } from './world-cells.ts';
import { tooTiredToMarch } from './march-fatigue.js';

// Preview only the small squad record. Never clone tactical sector snapshots on hover.
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {string} squadId
 * @param {string} destination
 * @param {import("./domain/journeys/journey.ts").JourneyModeValue} [mode]
 * @param {string[]} [waypoints]
 * @returns {import("./public/campaign-types.ts").StrategicRoutePreview} */
export function previewStrategicRoute(s, squadId, destination, mode = 'march', waypoints = []) {
  const q = s.squads.find((q) => q.id === squadId);
  const reject = (reason) => ({ valid: false, reason, path: [], hours: 0, action: null });
  if (!q) {
    return reject('La escuadra no existe.');
  }
  if (s.defeated) {
    return reject('La campaña ha terminado.');
  }
  if (s.pendingBattle) {
    return reject('Resolvé el sector táctico antes de marchar.');
  }
  if (s.pendingEncounter) {
    return reject('Respondé al encuentro antes de marchar.');
  }
  if (hasPendingArrivalDecision(s)) {
    return reject('Elegí combatir o retirarte antes de cambiar el destino.');
  }
  if (!q.members.length) {
    return reject('La escuadra no tiene combatientes.');
  }
  if (
    q.members.some(
      (id) =>
        !s.recruited.includes(id) || !s.operativeState[id]?.alive || s.operativeState[id].captured,
    )
  ) {
    return reject('Hay combatientes que no pueden marchar.');
  }
  if (
    q.members.some(
      (id) =>
        s.operativeState[id].asleep ||
        s.operativeState[id].assignment !== 'active' ||
        s.militiaTraining?.some((t) => t.trainerId === id),
    )
  ) {
    return reject('Hay combatientes durmiendo o con otra asignación.');
  }
  if (q.members.some((id) => tooTiredToMarch(s.operativeState[id]))) {
    return reject('La escuadra necesita descansar.');
  }
  const cell = worldCell(destination, s);
  if (!cell) {
    return reject('Elegí un destino en el mapa.');
  }
  destination = locationId(destination, s);
  if (!q.journey && destination === q.location && !waypoints.length) {
    return reject('La escuadra ya está en este sector.');
  }
  const target = campaignSectors(s).find((d) => d.id === destination);
  if (!target && cell.locality && worldOwner(s, destination) === 'royalist') {
    return reject(cellTravelReason(s, destination));
  }
  // A naval blockade restricts flotillas, not land travel to an empty friendly port.
  const occupied = s.enemyGroups?.some(
    (group) => group.target === destination && group.status === 'stationed',
  );
  const intent =
    target && (s.sectors[destination].owner === 'royalist' || occupied) ? 'attack' : 'travel';
  if (intent === 'attack') {
    if (s.completed) {
      return reject('La campaña está ganada.');
    }
    if (!target.neighbors.some((id) => s.sectors[id].owner === 'patriot' && isSupplied(s, id))) {
      return reject('Debes abrir una ruta hasta el frente.');
    }
  }
  try {
    if (q.journey) {
      const status = previewJourneyRedirection(s, q, destination, waypoints);
      return {
        valid: true,
        reason: null,
        path: status.plannedPath,
        hours: status.remaining,
        action: {
          type: 'redirectJourney',
          squadId: q.id,
          sector: destination,
          ...(waypoints.length ? { waypoints } : {}),
        },
      };
    }
    const draft = { ...q, members: [...q.members] };
    queueSquadTravel(s, draft, { sector: destination, mode, intent, waypoints });
    const status = squadTravelStatus(draft, s);
    return {
      valid: true,
      reason: null,
      path: status.path,
      hours: status.remaining,
      action: {
        type: intent,
        sector: destination,
        mode,
        ...(waypoints.length ? { waypoints } : {}),
        queue: true,
      },
    };
  } catch (error) {
    return reject(journeyRefusalMessage(error));
  }
}
