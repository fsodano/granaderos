import { nextRevision } from './infrastructure/shared/revision.js';
import {
  Journey,
  JourneyPurpose,
  JourneyStatus,
  SecondsPerTravelHour,
} from './domain/journeys/journey.ts';
import { JourneyRoutePlanner } from './domain/journeys/journey-route-planner.ts';
import { executeJourneyCommand } from './infrastructure/journeys/journey-refusal-messages.js';
import { JourneySnapshotMapper } from './infrastructure/journeys/journey-snapshot-mapper.js';
import {
  CampaignJourneyTransaction,
  CampaignFightOnArrivalRepository,
  CampaignWithdrawOnArrivalRepository,
  CampaignRedirectJourneyRepository,
} from './infrastructure/journeys/campaign-journey-repositories.js';
import { FightOnArrivalUseCase } from './application/journeys/fight-on-arrival/fight-on-arrival.use-case.ts';
import { WithdrawOnArrivalUseCase } from './application/journeys/withdraw-on-arrival/withdraw-on-arrival.use-case.ts';
import { RedirectJourneyUseCase } from './application/journeys/redirect-journey/redirect-journey.use-case.ts';
import { TRAVEL_BALANCE } from './travel-balance.js';
import { entryFromSector } from './tactical-exits.js';
import { campaignSectors } from './campaign-definition.js';
import { scenarioFor } from './campaign-scenario.js';
import {
  validWorldLocation,
  campaignPlace,
  adjacentCells,
  cellLegHours,
  legacyCellStepHours,
  previousCellStepHours,
  cellTravelPlan,
  cellWinterClosed,
  worldOwner,
  worldCell,
  sameCityCells,
  roadLinks,
} from './world-cells.ts';
import { tooTiredToMarch, advanceMarchFatigue } from './march-fatigue.js';
import { mountForOperative } from './horses.js';
import { recordStrategicArrival } from './deployment-return.js';
import { flotillaSectorAllowed } from './logistics.js';

const sector = (id, context) => campaignSectors(context).find((d) => d.id === id);
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};
const modes = ['march', 'horse', 'posta', 'flotilla', 'carts'];
const progressSeconds = (j) => j.elapsed * 3600 + (j.elapsedSecond ?? 0);
const campaignSeconds = (s) => s.hour * 3600 + (s.secondOfHour ?? 0);
const journeyMapper = new JourneySnapshotMapper();
const restoreJourney = (campaign, squad) => journeyMapper.restore(squad, campaignSeconds(campaign));
const retainJourney = (
  squad,
  journey,
  acceptedRevision = nextRevision(squad.journeyRevision ?? 0),
) => {
  squad.journey = journeyMapper.serialize(journey);
  squad.journeyRevision = acceptedRevision;
};

/** @param {import('./public/campaign-types.ts').CampaignSnapshot} campaign
 * @returns {import("./public/campaign-types.ts").CampaignArrivalDecision[]} */
export function pendingArrivalDecisions(campaign) {
  return campaign.squads
    .filter((squad) => squad.journey?.status === 'ready')
    .map((squad) => {
      const journey = restoreJourney(campaign, squad);
      return {
        ...journey.arrivalDecision,
        squadId: squad.id,
        name: squad.name,
        origin: squad.location,
        members: [...squad.members],
      };
    })
    .sort(
      (left, right) =>
        left.arrivedAtSeconds - right.arrivedAtSeconds || left.id.localeCompare(right.id),
    );
}

/** @param {Pick<import('./public/campaign-types.ts').CampaignSnapshot, 'squads'>} campaign @returns {boolean} */
export const hasPendingArrivalDecision = (campaign) =>
  campaign.squads.some((squad) => squad.journey?.status === 'ready');

export function withdrawOnArrival(campaign, request) {
  const squadId = request.squadId ?? campaign.activeSquadId;
  const repository = new CampaignWithdrawOnArrivalRepository(
    new CampaignJourneyTransaction(campaign),
  );
  const result = executeJourneyCommand(() =>
    new WithdrawOnArrivalUseCase(repository).execute({
      squadId,
      decisionId: request.decisionId,
    }),
  );
  if (campaign.travelNotice) {
    const events = campaign.travelNotice.events.filter((event) => event.squadId !== squadId);
    campaign.travelNotice = events.length ? { ...campaign.travelNotice, events } : null;
  }
  return result;
}

export function authorizeFightOnArrival(campaign, request) {
  const squadId = request.squadId ?? campaign.activeSquadId;
  const repository = new CampaignFightOnArrivalRepository(new CampaignJourneyTransaction(campaign));
  executeJourneyCommand(() =>
    new FightOnArrivalUseCase(repository).execute({ squadId, decisionId: request.decisionId }),
  );
  return [campaign.squads.find((squad) => squad.id === squadId)];
}

function planJourneyRedirection(campaign, journey, destination, waypoints) {
  const planner = new JourneyRoutePlanner({
    locationExists: (sectorId) => validWorldLocation(sectorId, campaign),
    isHostile: (sectorId) =>
      worldOwner(campaign, sectorId) === 'royalist' ||
      campaign.enemyGroups?.some(
        (group) => group.target === sectorId && group.status === 'stationed',
      ),
    permitsHostileApproach: (origin, target) => assaultNeighbor(origin, target, campaign),
    findRoute: (origin, target, mode) => pathTo(campaign, origin, target, mode),
    permitsRoute: (route, mode) =>
      (['march', 'horse'].includes(mode) || route.every((id) => sector(id, campaign))) &&
      (mode !== 'flotilla' || route.every((id) => flotillaSectorAllowed(campaign, id))),
    legDurationSeconds: (origin, target, mode) =>
      travelLegHours(origin, target, mode, campaign) * SecondsPerTravelHour,
  });
  return planner.planRedirection(journey, destination, waypoints);
}

export function previewJourneyRedirection(campaign, squad, destination, waypoints = []) {
  need(
    !hasPendingArrivalDecision(campaign),
    'Elegí combatir o retirarte antes de cambiar el destino.',
  );
  const journey = restoreJourney(campaign, squad);
  const route = planJourneyRedirection(campaign, journey, destination, waypoints);
  journey.redirect(route, campaignSeconds(campaign));
  return squadTravelStatus({ ...squad, journey: journeyMapper.serialize(journey) }, campaign);
}

export function redirectJourney(campaign, request) {
  need(
    !hasPendingArrivalDecision(campaign),
    'Elegí combatir o retirarte antes de cambiar el destino.',
  );
  const squadId = request.squadId ?? campaign.activeSquadId;
  const repository = new CampaignRedirectJourneyRepository(
    new CampaignJourneyTransaction(campaign),
    (journey, destination, waypoints) =>
      planJourneyRedirection(campaign, journey, destination, waypoints),
  );
  const response = executeJourneyCommand(() =>
    new RedirectJourneyUseCase(repository).execute({
      squadId,
      destination: request.sector ?? request.destination,
      waypoints: request.waypoints,
    }),
  );
  const squad = campaign.squads.find((candidate) => candidate.id === squadId);
  const journey = restoreJourney(campaign, squad);
  if (journey.travelling && journey.remainingLegSeconds === 0) {
    const snapshot = journey.snapshot();
    const remainingRoute = journey.backwards ? snapshot.returnRoute : snapshot.route.slice(1);
    const nextLegSeconds =
      remainingRoute?.length > 1
        ? travelLegHours(remainingRoute[0], remainingRoute[1], snapshot.mode, campaign) *
          SecondsPerTravelHour
        : undefined;
    const arrival = journey.finishLeg(nextLegSeconds);
    if (arrival.from !== arrival.to) {
      recordStrategicArrival(campaign, squad.members, arrival.from, arrival.to);
      squad.location = arrival.to;
      for (const id of squad.members) {
        campaign.operativeState[id].location = arrival.to;
      }
      for (const horse of campaign.horseState.horses) {
        if (!horse.returned && squad.members.includes(horse.assignedTo))
          {horse.location = arrival.to;}
      }
      if (squad.id === campaign.activeSquadId) {
        campaign.location = arrival.to;
      }
    }
    if (arrival.complete) {
      delete squad.journey;
    } else {
      retainJourney(squad, journey, squad.journeyRevision);
    }
  }
  return response;
}
// Continuous time stops at exact travel-hour work and locality boundaries.
// Legacy journeys omit both fractions and retain their whole-hour cadence.
export function nextSquadTravelBoundarySeconds(s) {
  const due = s.squads
    .filter((q) => q.journey?.status === 'moving')
    .map(({ journey: j }) =>
      Math.min(
        3600 - (j.pendingSeconds ?? 0),
        j.returning ? progressSeconds(j) : j.legHours * 3600 - progressSeconds(j),
      ),
    )
    .filter((seconds) => seconds > 0);
  return due.length ? Math.min(...due) : null;
}
export const TRAVEL_REASONS = {
  exhausted: 'La escuadra necesita descansar.',
  assignment: 'Hay combatientes durmiendo o con otra asignación.',
  blocked: 'La ruta está ocupada.',
  winter: 'La nieve cerró el paso.',
  transport: 'El transporte no está disponible.',
  remounts: 'Faltan pesos para la siguiente etapa de postas.',
  contact: 'Hay un encuentro en este sector.',
  empty: 'La escuadra no tiene combatientes.',
  unavailable: 'Hay combatientes que no pueden marchar.',
  assault: 'En el límite del sector. Elegí combatir o retirarte. El tiempo está detenido.',
};
export const assaultNeighbor = (from, to, context = null) =>
  Boolean(
    sector(to, context) &&
    (sector(from, context)?.neighbors.includes(to) ||
      (validWorldLocation(from, context) && adjacentCells(from, to, context))),
  );
/**
 * @param {string} from
 * @param {string} to
 * @param {string} [mode]
 * @param {import("./public/compatibility-types.ts").CampaignContext} [context]
 * @returns {number}
 */
export const travelLegHours = (from, to, mode = 'march', context = null) => {
  if (adjacentCells(from, to, context)) {
    return cellLegHours(from, to, mode, context);
  }
  if (sameCityCells(from, to, context)) {
    const link = roadLinks(context).find(
      (link) => (link.from === from && link.to === to) || (link.from === to && link.to === from),
    );
    if (link) {
      return (link.path.length - 1) * TRAVEL_BALANCE.cityCellHours;
    }
  }
  return Math.ceil(
    {
      march: TRAVEL_BALANCE.roadWalkHours,
      horse: TRAVEL_BALANCE.horseHours,
      posta: 4,
      flotilla: 5,
      carts: 18,
    }[mode] *
      ([from, to].some((id) => sector(id, context)?.biome === 'mountain')
        ? TRAVEL_BALANCE.mountainFactor
        : 1),
  );
};
export function supportedTravelLegHours(from, to, mode = 'march', context = null) {
  const hours = new Set([travelLegHours(from, to, mode, context)]);
  if (adjacentCells(from, to, context)) {
    hours.add(legacyCellStepHours(to, mode, context));
    hours.add(previousCellStepHours(to, mode, context));
  }
  if (!sector(from, context) && adjacentCells(from, to, context)) {
    if (mode === 'march') {
      hours.add(worldCell(to, context)?.biome === 'mountain' ? 4 : 2);
    }
  } else {
    hours.add(
      Math.ceil(
        { march: 12, horse: 6, posta: 4, flotilla: 5, carts: 18 }[mode] *
          ([from, to].some((id) => sector(id, context)?.biome === 'mountain') ? 1.5 : 1),
      ),
    );
  }
  return [...hours];
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {import("./public/campaign-types.ts").CampaignSquad} q
 * @returns {boolean} */
export const squadHasHorses = (s, q) =>
  Boolean(
    q?.members.length && q.members.every((id) => mountForOperative(s.horseState, id)?.canMount),
  );
function pathTo(s, from, to, mode) {
  if (['march', 'horse'].includes(mode) || !sector(from, s) || !sector(to, s)) {
    return cellTravelPlan(
      {
        location: from,
        hour: s.hour,
        sectors: s.sectors,
        ...(s.contentCampaign ? { contentCampaign: s.contentCampaign } : {}),
      },
      to,
      mode,
    ).path;
  }
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift(),
      last = path.at(-1);
    if (last === to) {
      return path;
    }
    for (const id of sector(last, s).neighbors) {
      if (!seen.has(id) && s.sectors[id].owner === 'patriot') {
        seen.add(id);
        queue.push([...path, id]);
      }
    }
  }
  return null;
}
function legIssue(s, q) {
  const j = q.journey,
    [from, to] = j.path;
  if (!q.members.length) {
    return 'empty';
  }
  if (
    q.members.some(
      (id) =>
        !s.recruited.includes(id) || !s.operativeState[id]?.alive || s.operativeState[id].captured,
    )
  ) {
    return 'unavailable';
  }
  if (q.members.some((id) => tooTiredToMarch(s.operativeState[id]))) {
    return 'exhausted';
  }
  if (
    q.members.some(
      (id) =>
        s.operativeState[id].asleep ||
        s.operativeState[id].assignment !== 'active' ||
        s.militiaTraining?.some((t) => t.trainerId === id),
    )
  ) {
    return 'assignment';
  }
  if (
    s.enemyGroups?.some(
      (g) => g.target === from && ['waiting', 'engaged', 'stationed'].includes(g.status),
    )
  ) {
    return 'contact';
  }
  if (
    (j.intent !== 'attack' && s.pendingBattle?.sector === to) ||
    (j.intent !== 'attack' &&
      (worldOwner(s, to) === 'royalist' ||
        s.enemyGroups?.some((g) => g.target === to && g.status === 'stationed')))
  ) {
    return 'blocked';
  }
  if ([from, to].some((id) => cellWinterClosed(s, id))) {
    return 'winter';
  }
  if (j.mode === 'horse' && !squadHasHorses(s, q)) {
    return 'transport';
  }
  if (
    (!['march', 'horse'].includes(j.mode) && !s.routes[j.mode]) ||
    (j.mode === 'flotilla' && s.blockade)
  ) {
    return 'transport';
  }
  if (j.mode === 'posta' && s.resources.treasury < 10) {
    return 'remounts';
  }
  return null;
}
export function queueSquadTravel(
  s,
  q,
  { sector: destination, waypoints = [], mode = 'march', intent = 'travel' },
) {
  need(!q.journey, 'Terminá o cancelá la ruta anterior.');
  need(modes.includes(mode), 'Medio de transporte desconocido.');
  need(Array.isArray(waypoints) && waypoints.length <= 8, 'Elegí hasta ocho escalas.');
  need(['travel', 'attack'].includes(intent), 'La intención de marcha es inválida.');
  if (intent === 'attack') {
    need(
      waypoints.length === 0 && assaultNeighbor(q.location, destination, s),
      'Prepará el ataque desde un sector vecino, sin escalas.',
    );
  }
  need(validWorldLocation(q.location, s), 'La ubicación de la escuadra no existe.');
  const path = [q.location];
  for (const to of [...waypoints, destination]) {
    need(
      validWorldLocation(to, s) && (intent === 'attack' || worldOwner(s, to) !== 'royalist'),
      'Cada escala debe ser una celda terrestre accesible.',
    );
    const leg = intent === 'attack' ? [q.location, to] : pathTo(s, path.at(-1), to, mode);
    need(leg?.length, 'Los realistas cortan la ruta de tránsito.');
    path.push(...leg.slice(1));
  }
  need(path.length > 1 && path.length <= 65, 'La ruta debe tener entre una y 64 etapas.');
  need(
    ['march', 'horse'].includes(mode) || path.every((id) => sector(id, s)),
    'Las celdas rurales requieren marcha a pie o caballos.',
  );
  need(
    mode !== 'flotilla' || path.every((id) => flotillaSectorAllowed(s, id)),
    'La flotilla requiere una ruta navegable.',
  );
  const journey = Journey.begin({
    id: `${q.id}:journey:${campaignSeconds(s)}:${(q.journeySequence ?? 0) + 1}`,
    route: path,
    mode,
    purpose: intent === 'attack' ? JourneyPurpose.HostileApproach : JourneyPurpose.Travel,
    startedAtSeconds: campaignSeconds(s),
    legDurationSeconds: travelLegHours(path[0], path[1], mode, s) * SecondsPerTravelHour,
  });
  retainJourney(q, journey);
  const reason = legIssue(s, q);
  need(!reason, TRAVEL_REASONS[reason]);
  q.journeySequence = (q.journeySequence ?? 0) + 1;
  return q.journey;
}

export function cancelSquadTravel(squad, choice = 'stop') {
  need(squad?.journey, 'La escuadra no tiene una ruta pendiente.');
  need(['stop', 'return'].includes(choice), 'Elegí detenerse o regresar.');
  need(squad.journey.status !== 'ready', 'Elegí combatir o retirarte al llegar al sector.');
  const journey = journeyMapper.restore(
    squad,
    squad.journey.startedAt * SecondsPerTravelHour + progressSeconds(squad.journey),
  );
  if (journey.positionSeconds === 0) {
    squad.journeyRevision = nextRevision(squad.journeyRevision ?? 0);
    delete squad.journey;
    return;
  }
  if (choice === 'return' || journey.purpose === JourneyPurpose.HostileApproach) {
    journey.returnToOrigin();
  } else {
    journey.stopAtNextSector();
  }
  retainJourney(squad, journey);
}

export function resumeSquadTravel(campaign, squad) {
  need(squad?.journey?.status === 'paused', 'La ruta no está detenida.');
  const reason = legIssue(campaign, squad);
  need(!reason, TRAVEL_REASONS[reason]);
  const journey = restoreJourney(campaign, squad);
  journey.resume();
  retainJourney(squad, journey);
}

/** @param {import("./public/campaign-types.ts").CampaignSquad} squad
 * @param {import('./public/campaign-types.ts').CampaignSnapshot | null} [context]
 * @returns {import("./public/campaign-types.ts").CampaignTravelStatus | null} */
export function squadTravelStatus(squad, context = null) {
  if (!squad.journey) {
    return null;
  }
  const record = squad.journey;
  const journey = journeyMapper.restore(
    squad,
    context
      ? campaignSeconds(context)
      : record.startedAt * SecondsPerTravelHour + progressSeconds(record),
  );
  const snapshot = journey.snapshot();
  const remainingRoute = journey.backwards
    ? (snapshot.returnRoute ?? [journey.origin])
    : snapshot.route.slice(1);
  const laterHours = remainingRoute
    .slice(1)
    .reduce(
      (hours, to, index) =>
        hours + travelLegHours(remainingRoute[index], to, snapshot.mode, context),
      0,
    );
  const legRemaining = journey.remainingLegSeconds / SecondsPerTravelHour;
  return {
    status: record.status,
    intent: record.intent ?? 'travel',
    purpose: journey.purpose,
    mode: snapshot.mode,
    from: journey.origin,
    to: journey.nextSector,
    destination: journey.destination,
    returning: journey.backwards,
    elapsed: journey.positionSeconds / SecondsPerTravelHour,
    elapsedSeconds: journey.positionSeconds,
    travelledSeconds: journey.travelledSeconds,
    legHours: record.legHours,
    legRemaining,
    remaining: legRemaining + laterHours,
    path: [...snapshot.route],
    plannedPath: journey.backwards ? [snapshot.route[1], ...remainingRoute] : [...snapshot.route],
    reason: record.reason ? TRAVEL_REASONS[record.reason] : null,
    arrivalDecision: journey.awaitingArrivalDecision ? journey.arrivalDecision : null,
  };
}
export function advanceSquadTravel(
  campaign,
  roster,
  {
    note,
    releaseAtArrival,
    onArrival = () => {},
    stopAtEveryArrival = false,
    seconds = SecondsPerTravelHour,
  },
) {
  need(
    Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= SecondsPerTravelHour,
    'El intervalo de marcha es inválido.',
  );
  if (hasPendingArrivalDecision(campaign)) {
    return false;
  }
  const acceptedRevisions = new Map(
    campaign.squads
      .filter(
        (squad) => squad.journey && (!squad.members.length || squad.journey.status === 'moving'),
      )
      .map((squad) => [squad.id, nextRevision(squad.journeyRevision ?? 0)]),
  );
  const events = [];
  const announce = (squad, message) => {
    note(campaign, `${squad.name}: ${message}`);
    events.push({ squadId: squad.id, name: squad.name, sector: squad.location, text: message });
  };
  for (const squad of campaign.squads) {
    if (!squad.journey) {
      continue;
    }
    if (!squad.members.length) {
      squad.journeyRevision = acceptedRevisions.get(squad.id);
      delete squad.journey;
      announce(squad, 'se cancela la marcha; no quedan combatientes.');
      continue;
    }
    const journey = restoreJourney(campaign, squad);
    if (!journey.travelling) {
      continue;
    }
    if (!journey.backwards && journey.positionSeconds === 0) {
      const reason = legIssue(campaign, squad);
      if (reason) {
        journey.pause(reason);
        retainJourney(squad, journey, acceptedRevisions.get(squad.id));
        announce(squad, TRAVEL_REASONS[reason]);
        continue;
      }
      if (!journey.legPaid) {
        if (squad.journey.mode === 'posta') {
          campaign.resources.treasury -= 10;
        }
        journey.markLegPaid();
      }
    }
    const snapshot = journey.snapshot();
    const blocked =
      journey.purpose !== JourneyPurpose.HostileApproach &&
      (worldOwner(campaign, snapshot.route[1]) === 'royalist' ||
        campaign.enemyGroups?.some(
          (group) => group.target === snapshot.route[1] && group.status === 'stationed',
        ));
    const winter = snapshot.route.slice(0, 2).some((id) => cellWinterClosed(campaign, id));
    if (
      !journey.backwards &&
      journey.positionSeconds > 0 &&
      (blocked ||
        winter ||
        (snapshot.purpose !== JourneyPurpose.HostileApproach &&
          campaign.pendingBattle?.sector === snapshot.route[1]))
    ) {
      journey.reverseForBlockedRoute(winter ? 'winter' : 'blocked');
      announce(
        squad,
        winter
          ? 'la nieve cerró el paso; regresa por la etapa recorrida.'
          : 'el destino quedó cerrado; regresa por la etapa recorrida.',
      );
    }
    const progress = journey.advance(seconds, campaignSeconds(campaign));
    for (let hour = 0; hour < progress.completedWorkHours; hour++) {
      advanceMarchFatigue(
        campaign,
        roster.map((operative) => ({
          ...operative,
          ...mountForOperative(campaign.horseState, operative.id),
        })),
        {
          traveling: squad.members,
          mode: snapshot.mode,
          mountain: snapshot.route
            .slice(0, 2)
            .some((id) => campaignPlace(id, campaign)?.biome === 'mountain'),
        },
      );
      for (const horse of campaign.horseState.horses) {
        if (!horse.returned && squad.members.includes(horse.assignedTo)) {
          horse.stamina = Math.max(0, horse.stamina - 2);
        }
      }
    }
    retainJourney(squad, journey, acceptedRevisions.get(squad.id));
    if (!progress.reachedBoundary) {
      continue;
    }
    if (journey.awaitingArrivalDecision) {
      announce(
        squad,
        `alcanza el límite de ${campaignPlace(journey.nextSector, campaign).name}. Elegí combatir o retirarte. El tiempo está detenido.`,
      );
      continue;
    }
    const current = journey.snapshot();
    const remainingRoute = journey.backwards ? current.returnRoute : current.route.slice(1);
    const nextLegSeconds =
      remainingRoute?.length > 1
        ? travelLegHours(remainingRoute[0], remainingRoute[1], current.mode, campaign) *
          SecondsPerTravelHour
        : undefined;
    const arrival = journey.finishLeg(nextLegSeconds);
    if (arrival.to !== arrival.from) {
      recordStrategicArrival(campaign, squad.members, arrival.from, arrival.to);
    }
    squad.location = arrival.to;
    for (const id of squad.members) {
      campaign.operativeState[id].location = arrival.to;
    }
    for (const horse of campaign.horseState.horses) {
      if (!horse.returned && squad.members.includes(horse.assignedTo)) {
        horse.location = arrival.to;
      }
    }
    if (squad.id === campaign.activeSquadId) {
      campaign.location = arrival.to;
    }
    onArrival(squad);
    for (const horse of campaign.horseState.horses) {
      if (
        !horse.returned &&
        horse.hired &&
        horse.hireUntil <= campaign.hour &&
        squad.members.includes(horse.assignedTo)
      ) {
        horse.returned = true;
        horse.assignedTo = null;
      }
    }
    releaseAtArrival(squad);
    if (arrival.complete || !squad.members.length) {
      delete squad.journey;
      announce(squad, `llega a ${campaignPlace(arrival.to, campaign).name}.`);
      continue;
    }
    retainJourney(squad, journey, acceptedRevisions.get(squad.id));
    const reason = legIssue(campaign, squad);
    if (reason) {
      journey.pause(reason);
      retainJourney(squad, journey, acceptedRevisions.get(squad.id));
      announce(squad, `${campaignPlace(arrival.to, campaign).name}. ${TRAVEL_REASONS[reason]}`);
    } else if (stopAtEveryArrival) {
      announce(
        squad,
        `llega a ${campaignPlace(arrival.to, campaign).name}; la ruta continúa hacia ${campaignPlace(journey.destination, campaign).name}.`,
      );
    }
  }
  if (events.length) {
    campaign.travelNotice = {
      hour: campaign.hour,
      ...(campaign.secondOfHour ? { secondOfHour: campaign.secondOfHour } : {}),
      events,
    };
  }
  return events.length > 0;
}
export function validateSquadTravel(s) {
  const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  const notice = s.travelNotice;
  need(
    notice === undefined ||
      notice === null ||
      (notice &&
        integer(notice.hour, 0, s.hour) &&
        (notice.secondOfHour === undefined || integer(notice.secondOfHour, 0, 3599)) &&
        notice.hour * 3600 + (notice.secondOfHour ?? 0) <= campaignSeconds(s) &&
        Array.isArray(notice.events) &&
        notice.events.length > 0 &&
        notice.events.length <= 16 &&
        notice.events.every(
          (e) =>
            e &&
            typeof e.squadId === 'string' &&
            s.squads.some((q) => q.id === e.squadId) &&
            typeof e.name === 'string' &&
            e.name.length <= 30 &&
            validWorldLocation(e.sector, s) &&
            typeof e.text === 'string' &&
            e.text.length <= 500,
        )),
    'El aviso de marcha guardado es inválido.',
  );
  for (const q of s.squads) {
    const j = q.journey;
    if (j === undefined) {
      continue;
    }
    need(
      j &&
        typeof j === 'object' &&
        !Array.isArray(j) &&
        j.version === 1 &&
        modes.includes(j.mode) &&
        ['moving', 'paused', 'ready'].includes(j.status) &&
        typeof j.returning === 'boolean' &&
        (j.reason === null || Object.hasOwn(TRAVEL_REASONS, j.reason)) &&
        integer(j.startedAt, 0, s.hour) &&
        Array.isArray(j.path) &&
        j.path.length >= 2 &&
        j.path.length <= 65 &&
        j.path[0] === q.location &&
        j.path.every(
          (id, i) =>
            validWorldLocation(id, s) &&
            (i === 0 ||
              sector(j.path[i - 1], s)?.neighbors.includes(id) ||
              adjacentCells(j.path[i - 1], id, s)),
        ) &&
        integer(j.legHours, 1, 96) &&
        integer(j.elapsed, 0, j.returning || j.status === 'ready' ? j.legHours : j.legHours - 1),
      'La ruta guardada es inválida.',
    );
    need(
      ['startedSecond', 'elapsedSecond', 'pendingSeconds'].every(
        (key) => j[key] === undefined || integer(j[key], 0, 3599),
      ) && j.startedAt * 3600 + (j.startedSecond ?? 0) <= campaignSeconds(s),
      'Los segundos de la ruta guardada son inválidos.',
    );
    const covered = progressSeconds(j);
    need(
      covered <= j.legHours * 3600 &&
        covered <= campaignSeconds(s) - (j.startedAt * 3600 + (j.startedSecond ?? 0)) &&
        (j.id !== undefined || j.returning || (j.pendingSeconds ?? 0) === (j.elapsedSecond ?? 0)),
      'El tiempo recorrido de la ruta guardada es inválido.',
    );
    need(
      ['march', 'horse'].includes(j.mode) || j.path.every((id) => sector(id, s)),
      'La ruta guardada usa transporte no disponible en celdas rurales.',
    );
    need(
      supportedTravelLegHours(j.path[0], j.path[1], j.mode, s).includes(j.legHours),
      'La duración de la etapa guardada es inválida.',
    );
    need(
      (j.intent === undefined || j.intent === 'attack') &&
        (j.intent !== 'attack' || j.path.length === 2) &&
        (j.status !== 'ready' ||
          (j.intent === 'attack' &&
            covered === j.legHours * 3600 &&
            !j.returning &&
            j.reason === 'assault')),
      'La preparación de ataque guardada es inválida.',
    );
    need(
      q.members.length > 0 &&
        (j.mode !== 'flotilla' || j.path.every((id) => flotillaSectorAllowed(s, id))) &&
        (j.status !== 'paused' || (covered === 0 && !j.returning)) &&
        (j.returning ? covered > 0 : true),
      'El avance guardado es inválido.',
    );
    const restored = restoreJourney(s, q);
    need(
      j.travelledSeconds === undefined ||
        integer(
          j.travelledSeconds,
          covered,
          campaignSeconds(s) - (j.startedAt * 3600 + (j.startedSecond ?? 0)),
        ),
      'El recorrido acumulado guardado es inválido.',
    );
    need(
      !j.arrivalDecision || j.arrivalDecision.arrivedAtSeconds <= campaignSeconds(s),
      'La llegada guardada está en el futuro.',
    );
    need(
      !j.returnPath ||
        (Array.isArray(j.returnPath) &&
          j.returnPath.length >= 1 &&
          j.returnPath[0] === q.location &&
          j.returnPath.every(
            (id, index) =>
              validWorldLocation(id, s) &&
              (index === 0 ||
                sector(j.returnPath[index - 1], s)?.neighbors.includes(id) ||
                adjacentCells(j.returnPath[index - 1], id, s)),
          )),
      'La ruta de retirada guardada es inválida.',
    );
    need(
      restored.status !== JourneyStatus.Completed,
      'Una ruta completada no puede seguir activa.',
    );
    need(
      q.members.every((id) => !s.pendingBattle?.squad?.some((u) => Number(u.id) === id)),
      'Una escuadra en ruta no puede estar desplegada.',
    );
    if (['moving', 'ready'].includes(j.status)) {
      need(
        q.members.every(
          (id) =>
            s.operativeState[id].alive &&
            !s.operativeState[id].captured &&
            !s.operativeState[id].asleep &&
            s.operativeState[id].assignment === 'active' &&
            !s.militiaTraining?.some((t) => t.trainerId === id),
        ),
        'Los viajeros guardados no están disponibles.',
      );
    }
  }
}

// A ready squad is at the boundary, not a defender or worker in either sector.
export function assaultGroups(s) {
  const targets = [
    ...new Set(
      s.squads
        .filter((q) => q.journey?.intent === 'attack' && !q.journey.returning)
        .map((q) => q.journey.path[1]),
    ),
  ];
  return targets.map((target) => ({
    sector: target,
    ready: s.squads
      .filter(
        (q) =>
          q.journey?.intent === 'attack' &&
          q.journey.path[1] === target &&
          q.journey.status === 'ready',
      )
      .map((q) => ({ id: q.id, name: q.name, origin: q.location, members: [...q.members] })),
    incoming: s.squads
      .filter(
        (q) =>
          q.journey?.intent === 'attack' &&
          !q.journey.returning &&
          q.journey.path[1] === target &&
          q.journey.status !== 'ready',
      )
      .map((q) => ({
        id: q.id,
        name: q.name,
        remaining: squadTravelStatus(q, s).remaining,
        status: q.journey.status,
      })),
  }));
}
export function readyAssaultSquads(s, target) {
  const groups = s.squads.filter(
    (q) => q.journey?.status === 'ready' && q.journey.path[1] === target,
  );
  need(groups.length > 0, 'No hay escuadras listas en ese límite.');
  return groups;
}
export function arriveForAssault(s, groups, target) {
  const manifest = groups.map((q) => ({
    id: q.id,
    name: q.name || q.id,
    origin: q.location,
    members: [...q.members],
  }));
  for (const q of groups) {
    if (q.journey?.status === 'ready') {
      authorizeFightOnArrival(s, {
        squadId: q.id,
        decisionId: restoreJourney(s, q).arrivalDecision.id,
      });
    }
  }
  for (const q of groups) {
    recordStrategicArrival(s, q.members, q.location, target);
    q.location = target;
    delete q.journey;
    for (const horse of s.horseState.horses) {
      if (!horse.returned && q.members.includes(horse.assignedTo)) {horse.location = target;}
    }
    if (q.id === s.activeSquadId) {
      s.location = target;
    }
  }
  return manifest;
}
export function validateAssaultDeployment(s) {
  const b = s.pendingBattle;
  if (b?.assaultSquads === undefined) {
    return;
  }
  const manifest = b.assaultSquads,
    mission = scenarioFor(s).assault.validationContext(s, b),
    location = mission?.location ?? b.sector;
  need(
    !b.defenseGroupId &&
      !b.exploration &&
      ((!b.missionId && sector(b.sector, s)) || mission) &&
      Array.isArray(manifest) &&
      manifest.length > 0 &&
      manifest.length <= 8 &&
      new Set(manifest.map((q) => q?.id)).size === manifest.length,
    'Las escuadras del asalto son inválidas.',
  );
  need(
    manifest.every((group) => {
      const q = s.squads.find((q) => q.id === group?.id);
      return (
        q &&
        q.location === location &&
        !q.journey &&
        (mission ? group.origin === mission.origin : assaultNeighbor(group.origin, b.sector, s)) &&
        Array.isArray(group.members) &&
        group.members.length > 0 &&
        group.members.length <= 6 &&
        JSON.stringify(group.members) === JSON.stringify(q.members)
      );
    }),
    'Los participantes del asalto no corresponden a sus escuadras.',
  );
  for (const group of manifest) {
    const name = s.squads.find((q) => q.id === group.id).name || group.id;
    if (group.name === undefined) {
      group.name = name;
    }
    need(group.name === name, 'El nombre de la escuadra de llegada no corresponde a la campaña.');
  }
  need(
    !mission || (b.origin === mission.origin && manifest.some((q) => q.id === s.activeSquadId)),
    'El origen de la misión no corresponde a la escuadra activa.',
  );
  const ids = manifest.flatMap((q) => q.members);
  need(
    new Set(ids).size === ids.length &&
      ids.length === b.squad.length &&
      b.squad.every((u) => ids.includes(u.id)),
    'El destacamento del asalto está incompleto.',
  );
  for (const group of manifest) {
    const entry = entryFromSector(group.origin, b.sector, null, s);
    need(
      group.members.every((id) => {
        const unit = b.squad.find((u) => u.id === id);
        return (
          s.operativeState[id]?.arrival?.fromSector === group.origin &&
          s.operativeState[id]?.location === location &&
          unit.entryEdge === entry.entryEdge &&
          unit.entryAnchor?.x === entry.entryAnchor.x &&
          unit.entryAnchor?.y === entry.entryAnchor.y
        );
      }),
      'La entrada del asalto no corresponde al origen.',
    );
  }
}
