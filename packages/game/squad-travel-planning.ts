import { Journey, JourneyPurpose, SecondsPerTravelHour } from './domain/journeys/journey.ts';
import type { JourneyModeValue } from './domain/journeys/journey.ts';
import type { CampaignSnapshot, CampaignSquad, CampaignJourney } from './public/campaign-types.ts';
import type { CampaignContext } from './public/compatibility-types.ts';
import { campaignSectors } from './campaign-definition.js';
import { validWorldLocation, adjacentCells, cellLegHours, legacyCellStepHours, previousCellStepHours, cellTravelPlan, cellWinterClosed, worldOwner, worldCell, sameCityCells, roadLinks } from './world-cells.ts';
import { TRAVEL_BALANCE } from './travel-balance.js';
import { tooTiredToMarch } from './march-fatigue.js';
import { mountForOperative } from './horses.js';
import { flotillaSectorAllowed } from './logistics.js';
import { JourneySnapshotMapper } from './infrastructure/journeys/journey-snapshot-mapper.ts';
import { nextRevision } from './infrastructure/shared/revision.ts';

export interface QueueSquadTravelOptions {
  sector: string;
  waypoints?: string[];
  mode?: JourneyModeValue;
  intent?: 'travel' | 'attack';
}
const sector = (id: string, context: CampaignContext) => campaignSectors(context).find((d) => d.id === id);
function need(condition: unknown, message: string): asserts condition {
  if (!condition) { throw Error(message); }
}
const modes: readonly string[] = ['march', 'horse', 'posta', 'flotilla', 'carts'];
const campaignSeconds = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0);
const journeyMapper = new JourneySnapshotMapper();
export function retainJourney(squad: CampaignSquad, journey: Journey, acceptedRevision = nextRevision(squad.journeyRevision ?? 0)): CampaignJourney {
  squad.journey = journeyMapper.serialize(journey);
  squad.journeyRevision = acceptedRevision;
  return squad.journey;
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
export const assaultNeighbor = (from: string, to: string, context: CampaignContext = null) =>
  Boolean(
    sector(to, context) &&
    (sector(from, context)?.neighbors.includes(to) ||
      (validWorldLocation(from, context) && adjacentCells(from, to, context))),
  );
export const travelLegHours = (from: string, to: string, mode: JourneyModeValue = 'march', context: CampaignContext = null) => {
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
export function supportedTravelLegHours(from: string, to: string, mode: JourneyModeValue = 'march', context: CampaignContext = null) {
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
export const squadHasHorses = (s: CampaignSnapshot, q: CampaignSquad) =>
  Boolean(
    q?.members.length && q.members.every((id) => mountForOperative(s.horseState, id)?.canMount),
  );
export function pathTo(s: CampaignSnapshot, from: string, to: string, mode: JourneyModeValue): string[] | null {
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
    const path = queue.shift();
    need(path, 'La ruta en cola debe existir.');
    const last = path.at(-1);
    need(last, 'La ruta debe tener un origen.');
    if (last === to) {
      return path;
    }
    const location = sector(last, s);
    need(location, 'La ubicación de la ruta no existe.');
    for (const id of location.neighbors) {
      if (!seen.has(id) && s.sectors[id]?.owner === 'patriot') {
        seen.add(id);
        queue.push([...path, id]);
      }
    }
  }
  return null;
}
export function legIssue(s: CampaignSnapshot, q: CampaignSquad): keyof typeof TRAVEL_REASONS | null {
  const j = q.journey;
  need(j, 'La escuadra no tiene una ruta pendiente.');
  const [from, to] = j.path;
  need(from && to, 'La ruta debe tener una etapa de destino.');
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
        s.operativeState[id]?.asleep ||
        s.operativeState[id]?.assignment !== 'active' ||
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
  s: CampaignSnapshot,
  q: CampaignSquad,
  { sector: destination, waypoints = [], mode = 'march', intent = 'travel' }: QueueSquadTravelOptions,
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
    const origin = path.at(-1);
    need(origin, 'La ruta debe tener un origen.');
    const leg = intent === 'attack' ? [q.location, to] : pathTo(s, origin, to, mode);
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
  const [origin, firstDestination] = path;
  need(origin && firstDestination, 'La ruta debe tener una etapa de destino.');
  const journey = Journey.begin({
    id: `${q.id}:journey:${campaignSeconds(s)}:${(q.journeySequence ?? 0) + 1}`,
    route: path,
    mode,
    purpose: intent === 'attack' ? JourneyPurpose.HostileApproach : JourneyPurpose.Travel,
    startedAtSeconds: campaignSeconds(s),
    legDurationSeconds: travelLegHours(origin, firstDestination, mode, s) * SecondsPerTravelHour,
  });
  const retained = retainJourney(q, journey);
  const reason = legIssue(s, q);
  if (reason) {
    throw Error(TRAVEL_REASONS[reason]);
  }
  q.journeySequence = (q.journeySequence ?? 0) + 1;
  return retained;
}

