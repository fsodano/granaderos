import type {
  BattleSnapshot,
  BattleUnit,
  BattleNpc,
  TacticalPoint,
  EquipmentItem,
  WeaponFitting,
} from './public/compatibility-types.ts';
import type { CampaignOperativeState } from './public/campaign-types.ts';
import type { ActionPreview } from './public/hud-types.ts';
import type {
  KnownItem,
  KnownUnitOrders,
  KnownBattle,
  KnownOperative,
} from './public/player-known-types.ts';
import { wallEdgeId } from './wall-geometry.js';
import { sectorDeploymentModel } from './sector-deployment.js';
import { publicLogisticsNotice } from './logistics-attention.js';
import { knownCampaignSectorEquipment, knownCampaignRepairReserves } from './sector-inventory.js';
import { publicContractNotice } from './contract-attention.js';
import { squadTravelStatus } from './squad-travel.js';
import { operativeInTransit } from './squads.js';
import { maximumEnergy } from './fatigue.js';
import { canSee, visibleRooms, actionCosts, stealPreview } from './tactical.js';
import { isInteriorVisible } from './tactical-visibility.ts';
import { environmentTargetSummary } from './environment-interactions.ts';
import {
  unitCanAct,
  handSlots,
  equipmentSlots,
  aimOptions,
  orderDescriptors,
  nearbyLootOptions,
  civilianMedicalInputAction,
  targetPreview,
  heardNoiseModel,
  fittingInventoryModel,
} from './ja2-hud.ts';
import { RESOURCE_NAMES } from './data.js';
import { campaignSectors } from './campaign-definition.js';
import { rosterFor } from './campaign.js';
import { enemyIntelligenceReports } from './enemy-intelligence.ts';
import { publicAssignmentNotice } from './assignment-attention.js';
import { spaceKey } from './tactical-space.js';
import {
  heldGrenade,
  grenadeThrowCosts,
  grenadeThrowRange,
  GRENADE_THROW,
} from './grenade-throw.ts';
import { CARE_COMPOSURE_RELIEF } from './care-composure.js';
import { publicCombatJournal } from './combat-journal.js';

// Explicit allowlists: new simulation fields remain private until reviewed here.
type Scalar = string | number | boolean | null;
const scalar = <T>(value: T): value is Extract<T, Scalar> =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';
function owns<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return key in value;
}
function pick<T extends object, const K extends string>(
  value: T | null | undefined,
  keys: readonly K[],
): Partial<{ [P in K & keyof T]: Extract<T[P], Scalar> }> {
  const result: Partial<{ [P in K & keyof T]: Extract<T[P], Scalar> }> = {};
  if (value) {
    for (const key of keys) {
      if (owns(value, key)) {
        const field = value[key];
        if (scalar(field)) {
          result[key] = field;
        }
      }
    }
  }
  return result;
}
const POSITION = ['x', 'y', 'tacticalLevel'] as const;
const STRUCTURE = ['structureDamage', 'destroyed'] as const;
const ACTOR = [
  'id',
  'name',
  'nickname',
  'side',
  ...POSITION,
  'hp',
  'maxHp',
  'stance',
  'movementMode',
  'facing',
  'mounted',
  'unconscious',
  'knockedDown',
  'entangled',
  'routed',
  'surrendered',
  'militia',
  'missionAlly',
] as const;
const OWN = [
  'ammunitionVersion',
  'ap',
  'maxAP',
  'carriedAP',
  'energy',
  'fatigue',
  'bleeding',
  'bandaged',
  'shock',
  'morale',
  'weapon',
  'blade',
  'condition',
  'bladeCondition',
  'weaponDropped',
  'weaponReady',
  'weaponMode',
  'loaded',
  'reloadProgress',
  'ammo',
  'jammed',
  'medkits',
  'rations',
  'torches',
  'boleadoras',
  'activeSlot',
  'activeItem',
  'leftHandItem',
  'activeTool',
  'activeSupply',
  'stealthMode',
  'agility',
  'dexterity',
  'strength',
  'wisdom',
  'leadership',
  'marksmanship',
  'medical',
  'mechanical',
  'explosives',
  'stealth',
  'experienceLevel',
  'militiaRank',
  'militiaExperience',
] as const;
const ITEM = [
  'item',
  'ammoType',
  'kind',
  'grenadeType',
  'outfit',
  'label',
  'name',
  'count',
  'weight',
  'weapon',
  'loaded',
  'reloadProgress',
  'condition',
  'jammed',
  'itemType',
  'toolKey',
  'fittingPattern',
] as const;
const ACTION = [
  'type',
  'unitId',
  'targetId',
  'targetKind',
  'item',
  'count',
  'slot',
  'toolKey',
  'supplyKey',
  'stance',
  'movement',
  'enabled',
  ...POSITION,
  'linkId',
  'aim',
  'hitLocation',
  'groundId',
  'dropIndex',
  'inventoryKey',
  'kind',
  'id',
  'wallEdgeId',
  'axis',
  'verb',
  'index',
  'destination',
] as const;
const ORDERS = new Set([
  'move',
  'climb',
  'look',
  'stealth',
  'useItem',
  'loot',
  'reload',
  'reprime',
  'weapon',
  'stance',
  'mount',
  'brace',
  'repair',
  'free',
  'endTurn',
]);
const onField = (unit: { departure?: object; fled?: boolean }) => !unit.departure && !unit.fled;
const fittings = (value: Record<string, WeaponFitting> | undefined) =>
  value?.['bayonet']
    ? { bayonet: pick(value['bayonet'], ['weapon', 'fittingPattern', 'condition']) }
    : {};
const item = (stack: EquipmentItem | number | null | undefined): KnownItem =>
  typeof stack === 'number'
    ? { count: stack }
    : { ...pick(stack, ITEM), ...(stack?.fittings ? { fittings: fittings(stack.fittings) } : {}) };
const cursor = (unit: BattleUnit | CampaignOperativeState) =>
  unit.equipmentCursor
    ? {
        equipmentCursor: {
          sourceId: unit.equipmentCursor.sourceId,
          stack: item(unit.equipmentCursor.stack),
        },
      }
    : {};
const handMetadata = (unit: BattleUnit | CampaignOperativeState) => ({
  ...(unit.weaponMetadata ? { weaponMetadata: item(unit.weaponMetadata) } : {}),
  ...(unit.bladeMetadata ? { bladeMetadata: item(unit.bladeMetadata) } : {}),
});
const inventory = (unit: BattleUnit | CampaignOperativeState) =>
  Object.fromEntries(
    Object.entries(unit.inventory ?? {}).map(([key, stack]) => [key, item(stack)]),
  );
const treatmentPreview = (preview: ActionPreview | null) =>
  preview?.treatment
    ? {
        treatment: pick(preview.treatment, [
          'critical',
          'targetHP',
          'hpGain',
          'hpAfter',
          'work',
          'remainingWork',
          'capacity',
          'dressingsUsed',
          'bleedingAfter',
          'bandagedAfter',
          'complete',
          'partial',
        ]),
        ...(preview.valid &&
        Number.isFinite(preview.composureRelief) &&
        (preview.composureRelief ?? 0) > 0 &&
        (preview.composureRelief ?? 0) <= CARE_COMPOSURE_RELIEF
          ? { composureRelief: preview.composureRelief }
          : {}),
      }
    : {};
const fresh = (
  state: BattleSnapshot,
  contact: (TacticalPoint & { turn: number }) | null | undefined,
) =>
  contact &&
  Number.isInteger(contact.turn) &&
  contact.turn <= state.turn &&
  state.turn - contact.turn <= 3;
const departure = (unit: BattleUnit) => ({
  ...pick(unit, ['id', 'name', 'nickname', 'hp', 'maxHp']),
  ...pick(unit.departure, ['edge', 'destination', 'elapsedSeconds', 'mountId']),
});

function ownActor(unit: BattleUnit) {
  return {
    maximumEnergy: maximumEnergy(unit),
    ...pick(unit, [...ACTOR, ...OWN, 'weaponFittingPattern', 'bladeFittingPattern']),
    weaponFittings: fittings(unit.weaponFittings),
    ...(unit.pocketOrder ? { pocketOrder: structuredClone(unit.pocketOrder) } : {}),
    ...cursor(unit),
    ...handMetadata(unit),
    inventory: inventory(unit),
    headwear: unit.headwear ? item(unit.headwear) : null,
    outfit: unit.outfit ? item(unit.outfit) : null,
    legwear: unit.legwear ? item(unit.legwear) : null,
    ...(unit.offHand ? { offHand: item(unit.offHand) } : {}),
    ...(unit.mount ? { mount: pick(unit.mount, ['id', 'stamina', 'condition']) } : {}),
  };
}

function fittingOrders(state: BattleSnapshot, unit: BattleUnit) {
  const model = fittingInventoryModel(state, unit);
  return [
    ...model.sources.map((source) => ({
      ...pick(source, ['item', 'label', 'condition', 'weight']),
      ...pick(source.preview, ['valid', 'reason', 'pa']),
      action: pick(source.action, ACTION),
    })),
    ...(model.attached?.removals ?? []).map((option) => ({
      ...pick(option, ['label', 'destination']),
      ...pick(option.preview, ['valid', 'reason', 'pa']),
      action: pick(option.action, ACTION),
    })),
  ];
}
function grenadePointOrders(
  state: BattleSnapshot,
  unit: BattleUnit,
  targets: (BattleUnit | BattleNpc)[],
) {
  const seen = new Set<string>();
  return targets.flatMap((target) => {
    const key = spaceKey(target);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const point = {
        x: target.x,
        y: target.y,
        ...(target.tacticalLevel === undefined ? {} : { tacticalLevel: target.tacticalLevel }),
      },
      preview = targetPreview(state, unit, point, { mode: 'throwGrenade' });
    if (!preview) {
      return [];
    }
    return [
      {
        ...point,
        ...pick(preview, [
          'name',
          'pa',
          'remaining',
          'chance',
          'chanceLabel',
          'coverNote',
          'attackType',
          'attackLabel',
          'actionLabel',
          'valid',
          'reason',
          'blastRadius',
          'friendlyRisk',
          'blocked',
          'landingLabel',
        ]),
        ...(preview.landing ? { landing: pick(preview.landing, POSITION) } : {}),
        action: { type: 'throwGrenade', ...point, aim: 0 },
      },
    ];
  });
}

/** Current shared sight, plus anonymous remembered contact. Never a save payload. */
/** @param {import('./public/compatibility-types.ts').BattleSnapshot | null} state @returns {import('./public/player-known-types.ts').KnownBattle | null} */
export function playerKnownBattle(
  state: import('./public/compatibility-types.ts').BattleSnapshot | null,
): import('./public/player-known-types.ts').KnownBattle | null {
  if (!state) {
    return null;
  }
  if (state.deployment) {
    const deployment = sectorDeploymentModel(state);
    if (!deployment) {
      throw Error('No se pudo preparar el despliegue.');
    }
    return {
      ...pick(state, [
        'sectorId',
        'sectorName',
        'sceneId',
        'missionId',
        'width',
        'height',
        'turn',
        'status',
        'elapsedSeconds',
      ]),
      phase: 'deployment',
      mode: 'deployment',
      deployment,
      journal: publicCombatJournal(state),
      units: deployment.units.map(({ position, ...unit }) => ({
        ...unit,
        side: 'player',
        ...position,
      })),
      orders: [],
      npcs: [],
      contacts: [],
      tiles: deployment.cells,
      artillery: [],
      groundItems: [],
    };
  }
  const players = state.units.filter((unit) => unit.side === 'player' && onField(unit));
  const actors = players.filter(
    (unit) => unit.hp > 0 && !unit.unconscious && !unit.routed && !unit.surrendered,
  );
  const revealed = new Set([...(state.revealedRooms ?? []), ...visibleRooms(state)]);
  const seen = (point: TacticalPoint & { departure?: object; fled?: boolean }) =>
    onField(point) &&
    actors.some((player) => canSee(state, player, point)) &&
    isInteriorVisible(state, point, revealed);
  const visible = state.units.filter((unit) => unit.side !== 'player' && seen(unit));
  const visibleIds = new Set(visible.map((unit) => unit.id));
  const tiles = state.tiles.filter(seen);
  const surfaces = (state.upperSurfaces ?? []).filter(seen);
  const wallEdges = (state.wallEdges ?? []).filter((edge) =>
    actors.some((player) => canSee(state, player, edge)),
  );
  const knownCells = new Set([...tiles, ...surfaces].map(spaceKey));
  const environment = [];
  for (const target of [
    ...wallEdges.filter((edge) => edge.type === 'door'),
    ...tiles.filter((tile) => tile.type === 'door'),
    ...(state.props ?? []).filter((prop) => prop.type === 'chest' && seen(prop)),
  ]) {
    const summary = environmentTargetSummary({ side: 'player' }, target),
      kind = target.type === 'door' ? 'door' : 'container';
    if ('axis' in target && target.axis) {
      summary.id = target.doorId ?? wallEdgeId(target);
    }
    environment.push({
      ...pick(target, [...POSITION, 'axis']),
      ...('axis' in target && target.axis ? { wallEdgeId: wallEdgeId(target) } : {}),
      ...pick(summary, ['id', 'type', 'label', 'open', 'locked', 'broken', ...STRUCTURE]),
      kind,
      ...(summary.trap ? { trap: pick(summary.trap, ['type', 'armed']) } : {}),
      ...(summary.contents
        ? { contents: summary.contents.map((stack, index) => ({ ...item(stack), index })) }
        : {}),
    });
  }
  const contacts = players.flatMap((unit) => {
    const known = unit.lastKnownEnemy,
      noise = heardNoiseModel(state, unit);
    return [
      ...(fresh(state, known)
        ? [
            {
              observerId: unit.id,
              kind: 'lastSeen',
              ...pick(known, [...POSITION, 'turn']),
              anonymous: true,
            },
          ]
        : []),
      ...(noise
        ? [
            {
              observerId: unit.id,
              kind: 'heard',
              ...pick(noise, [...POSITION, 'radius', 'label']),
              ...(unit.lastHeardNoise ? { turn: unit.lastHeardNoise.turn } : {}),
              anonymous: true,
            },
          ]
        : []),
    ];
  });
  const livingTargets = [...players, ...visible].filter((unit) => unit.hp > 0);
  const visibleNpcs = (state.npcs ?? []).filter(seen);
  const orders: KnownUnitOrders[] = actors
    .filter((unit) => !unit.militia)
    .map((unit) => {
      const grenade = heldGrenade(unit),
        throwCosts = grenade ? grenadeThrowCosts(unit) : null,
        throwPA = state.mode === 'exploration' ? 0 : (throwCosts?.total ?? 0);
      const grenadeReady = Boolean(
        grenade &&
        unitCanAct(state, unit) &&
        !unit.equipmentCursor &&
        !unit.knockedDown &&
        !unit.mounted &&
        grenade.record.condition > 0 &&
        (state.mode === 'exploration' || unit.ap >= throwPA),
      );
      return {
        unitId: unit.id,
        canAct: unitCanAct(state, unit),
        costs: grenade
          ? {
              ...pick(actionCosts(state, unit), [
                'heal',
                'weapon',
                'stance',
                'mount',
                'free',
                'loot',
                'drop',
                'equipLoot',
              ]),
              throwGrenade: throwPA,
            }
          : pick(actionCosts(state, unit), [
              'fire',
              'aim',
              'reload',
              'reprime',
              'melee',
              'heal',
              'weapon',
              'stance',
              'mount',
              'brace',
              'repair',
              'free',
              'loot',
              'drop',
              'equipLoot',
            ]),
        ...(grenade
          ? {
              grenade: {
                ...item(grenade.record),
                item: grenade.slot,
                pa: throwPA,
                range: pick(grenadeThrowRange(unit, grenade), ['maximum']),
                blastRadius: GRENADE_THROW.radius,
              },
            }
          : {}),
        equipment: equipmentSlots(state, unit).map((slot) => ({
          ...pick(slot, ['slot', 'label', 'pa', 'active', 'disabled']),
          action: pick(slot.action, ACTION),
        })),
        hands: handSlots(state, unit).map((hand) => {
          const held = hand.item?.startsWith('inventory:')
            ? unit.inventory?.[hand.item.slice(10)]
            : null;
          return {
            ...pick(hand, [
              'side',
              'item',
              'blocked',
              'label',
              'weapon',
              'loaded',
              'condition',
              'pa',
              'reason',
              'disabled',
            ]),
            ...(held && typeof held !== 'number' && held.kind === 'grenade'
              ? { ...pick(held, ['kind', 'grenadeType', 'condition']), count: 1 }
              : {}),
            ...(hand.action ? { action: pick(hand.action, ACTION) } : {}),
          };
        }),
        fittings: fittingOrders(state, unit),
        aim: grenade
          ? []
          : aimOptions(state, unit).map((option) => pick(option, ['level', 'pa', 'disabled'])),
        orders: orderDescriptors(state, unit)
          .filter((order) => ORDERS.has(order.id))
          .map((order) =>
            grenade && order.id === 'useItem'
              ? {
                  id: 'useItem',
                  label: 'Lanzar granada',
                  kind: 'mode',
                  pa: throwPA,
                  disabled: !grenadeReady,
                }
              : pick(order, ['id', 'label', 'kind', 'pa', 'disabled']),
          ),
        targets: grenade
          ? grenadePointOrders(state, unit, [...livingTargets, ...visibleNpcs])
          : livingTargets.flatMap((target) => {
              const preview = targetPreview(state, unit, target);
              return preview
                ? [
                    {
                      targetId: target.id,
                      ...treatmentPreview(preview),
                      ...pick(preview, [
                        'name',
                        'pa',
                        'remaining',
                        'chance',
                        'chanceLabel',
                        'coverNote',
                        'hitLocation',
                        'attackType',
                        'attackLabel',
                        'actionLabel',
                        'valid',
                        'reason',
                      ]),
                    },
                  ]
                : [];
            }),
        medicalTargets: visibleNpcs.flatMap((npc) => {
          const action = civilianMedicalInputAction(state, unit, npc);
          if (!action) {
            return [];
          }
          const preview = targetPreview(state, unit, npc);
          return [
            {
              targetId: npc.id,
              targetKind: 'npc',
              ...treatmentPreview(preview),
              ...pick(preview, [
                'name',
                'pa',
                'remaining',
                'coverNote',
                'actionLabel',
                'valid',
                'reason',
              ]),
              action,
            },
          ];
        }),
        stealTargets: visible
          .filter(
            (target) =>
              target.hp > 0 && !target.unconscious && !target.surrendered && !target.routed,
          )
          .map((target) => ({
            targetId: target.id,
            ...pick(stealPreview(state, unit, target), ['pa', 'valid', 'reason']),
            action: { type: 'steal', targetId: target.id },
          })),
        loot: nearbyLootOptions(state, unit)
          .filter((option) => {
            const target = option.action.targetId
              ? state.units.find((target) => target.id === option.action.targetId)
              : option.action.groundId
                ? (state.groundItems ?? []).find((target) => target.id === option.action.groundId)
                : option.action.dropIndex === undefined
                  ? undefined
                  : state.droppedWeapons?.[option.action.dropIndex];
            return target && seen(target);
          })
          .map((option) => ({
            ...item(option),
            source: option.source,
            action: pick(option.action, ACTION),
          })),
      };
    });
  const result: KnownBattle = {
    phase: state.phase,
    mode: state.mode,
    ...pick(state, [
      'sectorId',
      'sectorName',
      'sceneId',
      'missionId',
      'width',
      'height',
      'turn',
      'phase',
      'mode',
      'status',
      'sectorCleared',
      'night',
      'elapsedSeconds',
    ]),
    weather: pick(state.weather, ['rain', 'humidity']),
    units: [...players.map(ownActor), ...visible.map((unit) => pick(unit, ACTOR))],
    departedPlayers: state.units
      .filter((unit) => unit.side === 'player' && unit.departure)
      .map(departure),
    npcs: visibleNpcs.map((npc) =>
      ({ x: npc.x, y: npc.y, id: npc.id, ...pick(npc, [
        'id',
        'name',
        ...POSITION,
        'hp',
        'maxHp',
        'bleeding',
        'bandaged',
        'unconscious',
        'knockedDown',
        'stance',
        'mission',
      ]) }),
    ),
    wallEdges: wallEdges.map((edge) =>
      ({ x: edge.x, y: edge.y, type: edge.type, ...pick(edge, [
        'id',
        'axis',
        ...POSITION,
        'elevation',
        'type',
        'blocked',
        'blocksSight',
        'cover',
        'open',
        'doorId',
        'material',
        'buildingId',
        ...STRUCTURE,
      ]) }),
    ),
    tiles: tiles.map((tile) =>
      ({ x: tile.x, y: tile.y, type: tile.type, ...pick(tile, [
        ...POSITION,
        'elevation',
        'type',
        'blocked',
        'cover',
        'open',
        'buildingId',
        'roomId',
        ...STRUCTURE,
      ]) }),
    ),
    ...(state.upperSurfaces
      ? {
          upperSurfaces: surfaces.map((surface) =>
            ({ x: surface.x, y: surface.y, type: surface.type, ...pick(surface, [
              'id',
              ...POSITION,
              'elevation',
              'type',
              'kind',
              'blocked',
              'cover',
              'slabThickness',
              'material',
              'buildingId',
              'roomId',
              ...STRUCTURE,
            ]) }),
          ),
        }
      : {}),
    ...(state.climbLinks
      ? {
          climbLinks: state.climbLinks
            .filter(
              (link) => knownCells.has(spaceKey(link.from)) && knownCells.has(spaceKey(link.to)),
            )
            .map((link) => ({
              id: link.id, kind: link.kind,
              from: { x: link.from.x, y: link.from.y, ...pick(link.from, POSITION) },
              to: { x: link.to.x, y: link.to.y, ...pick(link.to, POSITION) },
            })),
        }
      : {}),
    props: (state.props ?? []).filter(seen).map((prop) => ({
      id: prop.id, type: prop.type, x: prop.x, y: prop.y,
      ...pick(prop, ['id', 'type', ...POSITION, 'blocksMovement', ...STRUCTURE]),
      ...(prop.footprint ? { footprint: { width: prop.footprint.width, height: prop.footprint.height } } : {}),
    })),
    environment,
    contacts,
    orders,
    journal: publicCombatJournal(state),
    artillery: (state.artillery ?? [])
      .filter((gun) => gun.side === 'player' || seen(gun))
      .map((gun) =>
        pick(
          gun,
          gun.side === 'player'
            ? ['id', 'side', 'type', ...POSITION, 'loaded', 'ammo', 'facing', 'reloadProgress']
            : ['id', 'side', 'type', ...POSITION, 'facing'],
        ),
      ),
    groundItems: (state.groundItems ?? [])
      .filter((ground) => !ground.heldBy && (ground.count ?? 0) > 0 && seen(ground))
      .map((ground) => ({
        ...pick(ground, ['id', ...POSITION, 'type']),
        ...item(ground.stack ?? ground),
      })),
    droppedWeapons: (state.droppedWeapons ?? []).flatMap((ground, dropIndex) =>
      !ground.taken && seen(ground)
        ? [{ dropIndex, ...pick(ground, POSITION), ...item(ground) }]
        : [],
    ),
    lights: (state.lights ?? [])
      .filter((light) => knownCells.has(spaceKey(light)))
      .map((light) =>
        pick(light, [...POSITION, 'type', 'radius', 'intensity', 'remainingSeconds']),
      ),
    smoke: (state.smoke ?? [])
      .filter((smoke) => knownCells.has(spaceKey(smoke)))
      .map((smoke) => pick(smoke, [...POSITION, 'radius'])),
    exits: (state.exits ?? []).map((exit) => pick(exit, ['id', 'edge', 'destination'])),
    interrupt:
      state.phase === 'interrupt' && state.interrupt?.side === 'player'
        ? {
            side: 'player',
            unitIds: players.filter((unit) => unitCanAct(state, unit)).map((unit) => unit.id),
            ...(visibleIds.has(state.interrupt.enemyId)
              ? { enemyId: state.interrupt.enemyId }
              : {}),
          }
        : null,
  };
  return result;
}

/** Player-owned campaign records and the strategic reports shown by the UI. */
/** @param {import('./public/campaign-types.ts').CampaignSnapshot | null} state @returns {import('./public/player-known-types.ts').KnownCampaign | null} */
export function playerKnownCampaign(
  state: import('./public/campaign-types.ts').CampaignSnapshot | null,
): import('./public/player-known-types.ts').KnownCampaign | null {
  if (!state) {
    return null;
  }
  const knownIds = new Set([
    ...(state.recruited ?? []),
    ...Object.entries(state.operativeState ?? {})
      .filter(([, record]) => record.captured)
      .map(([id]) => Number(id)),
  ]);
  const roster = rosterFor(state).filter((unit) => knownIds.has(unit.id));
  return {
    ...pick(state, [
      'hour',
      'secondOfHour',
      'phase',
      'location',
      'activeSquadId',
      'blockade',
      'completed',
      'defeated',
    ]),
    logisticsNotice: publicLogisticsNotice(state),
    assignmentNotice: publicAssignmentNotice(state),
    contractNotice: publicContractNotice(state),
    travelNotice: state.travelNotice
      ? {
          hour: state.travelNotice.hour,
          events: state.travelNotice.events.map((e) =>
            pick(e, ['squadId', 'name', 'sector', 'text']),
          ),
        }
      : null,
    resources: pick(state.resources, Object.keys(RESOURCE_NAMES)),
    reputation: pick(state.reputation, [
      'directory',
      'gauchos',
      'pardos',
      'foreign',
      'indigenous',
      'royalists',
    ]),
    sectors: campaignSectors(state).map((sector) => ({
      ...pick(sector, ['id', 'name', 'grid', 'biome', 'theater']),
      ...pick(state.sectors[sector.id], ['owner', 'loyalty', 'fort', 'damageUntil']),
      militia: [...(state.sectors[sector.id]?.militia ?? [])],
      equipment: knownCampaignSectorEquipment(state, sector.id),
      repairReserves: knownCampaignRepairReserves(state, sector.id),
    })),
    squads: (state.squads ?? []).map((squad) => ({
      ...pick(squad, ['id', 'name', 'location']),
      members: squad.members.filter((id) => knownIds.has(id)),
      journey: squadTravelStatus(squad),
    })),
    operatives: roster.map((unit): KnownOperative => {
      const record = state.operativeState[unit.id];
      if (!record) {
        throw Error(`No existe el estado del combatiente ${unit.id}.`);
      }
      return {
        inTransit: operativeInTransit(state, unit.id),
        maximumEnergy: maximumEnergy(record),
        ...pick(unit, ['id', 'name', 'nickname', 'weapon', 'blade', ...OWN]),
        ...pick(record, [
          'hp',
          'maxHp',
          'alive',
          'location',
          'assignment',
          'asleep',
          'sleepCollapsed',
          'captured',
          'capturedSector',
          'energy',
          'fatigue',
          'bleeding',
          'bandaged',
          'morale',
          'condition',
          'weaponDropped',
          'jammed',
          'carriedAmmo',
          'carriedLoaded',
          'carriedReloadProgress',
          'medkits',
          'rations',
          'torches',
          'boleadoras',
        ]),
        weaponFittings: fittings(record.weaponFittings),
        ...pick(record, [
          'activeItem',
          'activeSlot',
          'leftHandItem',
          'weaponFittingPattern',
          'bladeFittingPattern',
          'bladeCondition',
          'toolkitPoints',
          'repairTargetId',
          'repairWeaponId',
          'repairScope',
        ]),
        ...(record.pocketOrder ? { pocketOrder: structuredClone(record.pocketOrder) } : {}),
        ...cursor(record),
        ...handMetadata(record),
        inventory: inventory(record),
        headwear: record.headwear ? item(record.headwear) : null,
        outfit: record.outfit ? item(record.outfit) : null,
        legwear: record.legwear ? item(record.legwear) : null,
        ...(record.offHand ? { offHand: item(record.offHand) } : {}),
        contract: pick(state.contracts?.[unit.id], [
          'kind',
          'term',
          'started',
          'expiresAt',
          'paid',
        ]),
      };
    }),
    flags: pick(state.flags, [
      'academy',
      'sanLorenzo',
      'northPact',
      'partisanSupply',
      'foundry',
      'parliament',
      'emancipation',
      'commission',
      'mentoring',
    ]),
    horses: (state.horseState?.horses ?? []).map((horse) => ({
      ...pick(horse, [
        'id',
        'name',
        'location',
        'assignedTo',
        'stamina',
        'condition',
        'feed',
        'hired',
        'hireUntil',
        'returned',
        'pregnantUntil',
      ]),
      ...(horse.custody ? { custody: pick(horse.custody, ['kind', 'sector', 'operativeId']) } : {}),
    })),
    enemyReports: enemyIntelligenceReports(state),
    pendingEncounter: state.pendingEncounter
      ? pick(state.pendingEncounter, ['groupId', 'sector', 'arrivedAt'])
      : null,
    pendingBattle: state.pendingBattle
      ? {
          ...pick(state.pendingBattle, ['sector', 'sceneId', 'name', 'exploration']),
          resumeAvailable: Boolean(state.pendingBattle.resumeSnapshot),
        }
      : null,
  };
}

/** @param {{campaign:import('./public/campaign-types.ts').CampaignSnapshot|null,battle:import('./public/compatibility-types.ts').BattleSnapshot|null,screen:string}} current @returns {import('./public/player-known-types.ts').PlayerKnownState} */
export function playerKnownState({
  campaign,
  battle,
  screen,
}: {
  campaign: import('./public/campaign-types.ts').CampaignSnapshot | null;
  battle: import('./public/compatibility-types.ts').BattleSnapshot | null;
  screen: string;
}): import('./public/player-known-types.ts').PlayerKnownState {
  return { screen, campaign: playerKnownCampaign(campaign), battle: playerKnownBattle(battle) };
}

// Reducer admission still supplies its text reason. Never serialize an error
// object (which could contain an actor or an authoritative state snapshot).
/** @param {unknown} value @returns {string} */
export function playerKnownError(value: unknown): string {
  return typeof value === 'string' ? value : 'La orden no se pudo completar.';
}
