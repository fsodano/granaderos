import * as historical from '../../content/campaigns/granaderos/scenario.js';
import {
  campaignDefinitions,
  campaignSectors,
  campaignFactions,
  campaignPresentation,
  campaignWorld,
} from './campaign-definition.js';
import { campaignRules } from './campaign-rules.js';
import { campaignStory, advanceCampaignStory } from './campaign-story.js';
import { headquartersFor } from './campaign-headquarters.js';
import { foundryFor } from './campaign-foundry.js';
import { authoredForceEquipment } from './content-force-equipment.js';
import { advanceCampaignEvents } from './campaign-events.js';
import {
  enemyStrategiesFor,
  authoredEnemyGroupPlan,
  authoredEnemyRaid,
  authoredEnemyHourlyEvents,
} from './campaign-enemy-strategy.js';

// Only installed, trusted scenario code is executable. A package selects a
// known scenario by name; its saved JSON never supplies functions or scripts.
export function scenarioIdFor(value) {
  const content = campaignDefinitions(value);
  if (content?.campaignStory) {
    return 'generic-v1';
  }
  const id = content?.scenario ?? 'granaderos-historical-v1';
  if (!['granaderos-historical-v1', 'generic-v1'].includes(id)) {
    throw Error('El escenario de campaña no es compatible.');
  }
  return id;
}
export const isHistoricalCampaign = (value) => scenarioIdFor(value) === 'granaderos-historical-v1';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const empty = (value) => object(value) && Object.keys(value).length === 0;
const noop = () => {};
const unavailable = () => {
  throw Error('Esta campaña utiliza sus propios objetivos y no ofrece esa orden.');
};

function genericInitialState(seed, definitions) {
  const sectors = campaignSectors(definitions),
    hq = definitions?.headquarters ?? sectors[0].id;
  return {
    artilleryVersion: 1,
    artilleryCustodyVersion: 1,
    nextArtilleryId: 1,
    civilianState: { version: 2, people: {} },
    hiringArrivals: [],
    equipmentShipments: [],
    missions: {},
    sceneStates: {},
    missionAllies: {},
    garrisons: {},
    nextMilitiaId: 20000,
    quests: {},
    cityLoyaltyEvents: [],
    contracts: {},
    militiaTraining: [],
    foundMoney: [],
    skillLearningVersion: 1,
    economyVersion: 2,
    version: 1,
    seed: seed >>> 0,
    hour: 0,
    phase: 0,
    location: hq,
    activeSquadId: 'squad-1',
    squads: [{ id: 'squad-1', name: 'Primera escuadra', members: [], location: hq }],
    sectorStates: {},
    resources: {
      treasury: campaignRules({ contentCampaign: { package: definitions } }).startingTreasury,
    },
    reputation: Object.fromEntries(campaignFactions(definitions).map((f) => [f.id, 0])),
    sectors: Object.fromEntries(
      sectors.map((d) => [
        d.id,
        {
          owner: d.id === hq ? 'patriot' : 'royalist',
          loyalty: d.id === hq ? 65 : 25,
          militia: [0, 0, 0],
          damageUntil: 0,
          fort: 0,
        },
      ]),
    ),
    artillerySelection: [],
    armory: {},
    loadouts: {},
    lastConversation: null,
    conversations: {},
    officer: null,
    recruited: [],
    squad: [],
    operativeState: {},
    flags:
      definitions?.scenario === 'generic-v1'
        ? { armyFunded: false, foundry: false }
        : Object.fromEntries(
            Object.keys(historical.initialState(seed).flags).map((key) => [key, false]),
          ),
    routes: { posta: false, flotilla: false, carts: false, mules: false },
    blockade: false,
    pendingBattle: null,
    completed: false,
    defeated: false,
    log: [
      {
        hour: 0,
        text:
          definitions?.campaignStory?.introduction ??
          `Comienza ${definitions?.name ?? 'la campaña'}. Reuní una escuadra y explorá el territorio.`,
      },
    ],
    lastError: null,
  };
}
function genericProgress(s, { updateContentQuests, endingSpeech }) {
  updateContentQuests(s);
  if (s.sectors[headquartersFor(s)]?.owner !== 'patriot') {
    s.defeated = true;
  }
  advanceCampaignStory(s);
  if (s.completed) {
    endingSpeech(s);
  }
}
function genericOpposition(request, state) {
  const count = request.enemyCount ?? Math.max(3, request.squad.length + request.difficulty - 1);
  return {
    enemyCommand: 'opposition',
    enemyCommander: 'Mando adversario',
    enemyObjective: 'Defender el territorio.',
    enemies: Array.from({ length: count }, (_, i) =>
      authoredForceEquipment(
        state,
        'oppositionEquipment',
        i === 0 ? 'officer' : i % 3 === 0 ? 'veteran' : 'line',
        {
          id: `enemy-${i}`,
          name: `Combatiente adversario ${i + 1}`,
          weapon: 0,
          blade: 0,
          marksmanship: 50 + request.difficulty * 5,
          morale: 60 + request.difficulty * 5,
          leadership: i === 0 ? 75 : 40,
        },
        campaignRules(state).enemyCartridges,
      ),
    ),
  };
}
export function scaledEnemyCount(s) {
  const sectors = campaignSectors(s),
    controlled = sectors.filter((d) => s.sectors[d.id]?.owner === 'patriot').length;
  return (
    4 +
    Math.round(26 * Math.max(0, Math.min(1, (controlled - 1) / Math.max(1, sectors.length - 2))))
  );
}
function genericEnemyReserveLimits(s) {
  const policies = enemyStrategiesFor(campaignWorld(s));
  if (Object.keys(policies).length) {
    return Object.fromEntries(Object.entries(policies).map(([theater, p]) => [theater, p.reserve]));
  }
  // Older chapter packages kept the former save fields with zero reserves.
  return campaignDefinitions(s)?.scenario === 'generic-v1'
    ? {}
    : Object.fromEntries(Object.keys(historical.enemyReserveLimits).map((key) => [key, 0]));
}
const genericStrategyContext = (s, ctx) => ({ ...ctx, headquarters: headquartersFor(s) });
const genericRaid = (s, theater, target, ctx) =>
  authoredEnemyRaid(s, campaignWorld(s), theater, target, genericStrategyContext(s, ctx));
function genericHourlyEvents(s, ctx) {
  advanceCampaignEvents(s, ctx);
  authoredEnemyHourlyEvents(s, campaignWorld(s), genericStrategyContext(s, ctx));
}
const generic = Object.freeze({
  id: 'generic-v1',
  maxPhase: 0,
  scenes: {},
  sceneStateKey: () => 'sectorStates',
  workshopSectors: (s) => campaignWorld(s).workshopSectors ?? [headquartersFor(s)],
  missionNPCs: [],
  enemyReserveLimits: genericEnemyReserveLimits,
  enemyGroupLegHours: (s) =>
    Object.fromEntries(
      Object.entries(enemyStrategiesFor(campaignWorld(s))).map(([theater, p]) => [
        theater,
        p.legHours,
      ]),
    ),
  losses: { historicalRequiredActors: () => [], historicalLossReason: () => null },
  assault: {
    missionAssaultSquads: () => [],
    missionAssaultManifest: unavailable,
    validationContext: () => null,
  },
  grenadeSupply: null,
  grenadeSupplyReason: () => 'Esta campaña no dispone de una remesa de arsenal.',
  enemyReserveError: 'Las reservas enemigas guardadas son inválidas.',
  missionCivilianOperativeId: (npc) => npc.operativeId,
  onCivilianDeath: noop,
  legacyCityReceipt: () => false,
  recruitmentLocalityId: (state, id) => id,
  retreatAxis: () => [],
  invaderEntry: () => ({ entryEdge: 'W', entryAnchor: { x: 0, y: 8 } }),
  politics: {
    tradeQuote: (s, price) => Math.ceil(price),
    policyStatus: () => ({ taxDue: false, tax: 0, requisitionReady: false, nextRequisition: 0 }),
    applyPolicy: unavailable,
  },
  initialState: genericInitialState,
  chapters: (s) =>
    campaignStory(s)?.chapters ?? [
      {
        id: 'free-play',
        name: s.contentCampaign?.package.name ?? 'Campaña',
        objective: 'Administrá tu escuadra y explorá el territorio.',
      },
    ],
  calendar: (s) => {
    const day = Math.floor(s.hour / 24),
      date = campaignPresentation(s).calendar ?? { year: 1, month: 1, day: 1 };
    return {
      year: date.year + Math.floor((date.month - 1 + Math.floor((date.day - 1 + day) / 30)) / 12),
      month: ((date.month - 1 + Math.floor((date.day - 1 + day) / 30)) % 12) + 1,
      day: ((date.day - 1 + day) % 30) + 1,
      hour: s.hour % 24,
    };
  },
  recruitmentGate: () => ({ available: true, reason: 'Disponible para incorporarse.' }),
  weeklyPayFor: (state, operative, definition) => Math.ceil((definition.monthlyPay * 7) / 30),
  progress: genericProgress,
  raid: genericRaid,
  hourlyEvents: genericHourlyEvents,
  dailyEvents: noop,
  payroll: noop,
  paidService: noop,
  dispatchAction: unavailable,
  conversationContacts: () => null,
  missionConversation: unavailable,
  enemyName: 'enemigos',
  victoryText: (request) =>
    `Victoria en ${request.name}. Se recuperan armas y fondos del adversario.`,
  occupationText: (name) => `Las tropas enemigas ocupan ${name} y cortan el camino.`,
  blockadeText: (name) => `Un bloqueo en ${name} reduce los ingresos del puerto.`,
  blockaded: () => false,
  clearVictoryBlockade: noop,
  occupySector: (s, group, { note, sector }) => {
    s.sectors[group.target].owner = 'royalist';
    note(s, `Las tropas enemigas ocupan ${sector(group.target).name} y cortan el camino.`);
  },
  attackDifficulty: (s, def) => def.difficulty ?? Math.min(4, 1 + Math.floor(s.hour / 240)),
  defaultAttackSector: null,
  attackDefinition: (s, at, { sector }) => sector(at),
  admitAttack: noop,
  prepareAttack: noop,
  missionFailed: () => false,
  settleMissionResult: (s, request, snapshot, action) => action,
  battleOutcome: noop,
  changedFlags: (s, previous, { recordCityLoyalty }) => {
    if (s.flags.foundry && !previous.flags.foundry) {
      recordCityLoyalty(s, {
        sectorId: foundryFor(s).sector,
        kind: 'quest',
        eventId: 'quest-foundry',
      });
    }
  },
  validateReputation: () => true,
  validateStoredScenes: (s) => empty(s.missions) && empty(s.sceneStates) && empty(s.missionAllies),
  validatePendingScene: (s, b) => !b.sceneId && !b.missionId && !b.missionAllies,
  validateDailyState: (s) => {
    if (s.politics !== undefined) {
      throw Error('Esta campaña no utiliza las políticas históricas.');
    }
  },
  validateHistoricalState: noop,
  enemyGroupPlan: (s, theater, target) => authoredEnemyGroupPlan(campaignWorld(s), theater, target),
  enemyOriginName: () => 'Fuera del mapa',
  missions: {
    missionContacts: () => [],
    missionStatus: () => null,
    talkMission: unavailable,
    sanLorenzoAlly: unavailable,
    validateMissions: (s) => empty(s.missions),
  },
  narrative: {
    campaignEnemyCount: scaledEnemyCount,
    coastalRevenue: () => 0,
    royalistIntel: () => [],
    mentorDispatch: (s) => ({
      name: campaignPresentation(s).title ?? s.contentCampaign?.package.name ?? 'Campaña',
      role: 'Objetivos de campaña',
      text:
        campaignStory(s)?.chapters[s.campaignProgress?.completed.length ?? 0]?.objective ??
        'Explorá el territorio y administrá tu escuadra.',
      deployable: false,
    }),
    oppositionFor: genericOpposition,
  },
});
export const scenarioFor = (value) => (isHistoricalCampaign(value) ? historical : generic);
export const missionScenesFor = (value) => scenarioFor(value).scenes;
/** @param {string} id @returns {string} */
export const sceneAnchorFor = (value, id) => missionScenesFor(value)[id]?.anchor ?? id;
export const isCampaignScene = (value, id) => Boolean(missionScenesFor(value)[id]);
export const enemyCommandsFor = (value) => scenarioFor(value).narrative.royalistIntel(value);
export const enemyGroupLegHoursFor = (value) => {
  const hours = scenarioFor(value).enemyGroupLegHours;
  return typeof hours === 'function' ? hours(value) : hours;
};

export const sceneStateKeyFor = (value, id) => scenarioFor(value).sceneStateKey(id);
export const workshopSectorsFor = (value) => scenarioFor(value).workshopSectors(value);
export const grenadeSupplyFor = (value) => scenarioFor(value).grenadeSupply;
export const grenadeCapacityFor = (value, at) => {
  const supply = grenadeSupplyFor(value);
  return supply?.sector === at ? supply.capacity : 0;
};
