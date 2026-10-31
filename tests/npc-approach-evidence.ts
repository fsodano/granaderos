import type { BattleOrder } from './opening-driver.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  BattleNpc,
} from '../packages/game/public/compatibility-types.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';

function approachView(battle: BattleSnapshot, unitId: string, npcId: string) {
  const actor = battle.units.find((unit: BattleUnit) => unit.id === unitId),
    npc = battle.npcs.find((person) => person.id === npcId);
  const position = (person: BattleUnit | BattleNpc | undefined) =>
    person ? { x: person.x, y: person.y, tacticalLevel: person.tacticalLevel ?? 0 } : null;
  return {
    actor: {
      ...position(actor),
      hp: actor?.hp,
      energy: actor?.energy,
      ap: actor?.ap,
      stance: actor?.stance,
    },
    npc: { ...position(npc), ai: structuredClone(npc?.ai ?? null) },
    mode: battle.mode,
    turn: battle.turn,
    elapsedSeconds: battle.elapsedSeconds,
    lastError: battle.lastError,
  };
}
interface NPCApproachTrace {
  inputBattle: BattleSnapshot;
  unitId: string;
  npcId: string;
  steps: {
    action: BattleOrder;
    before: ReturnType<typeof approachView>;
    after: ReturnType<typeof approachView>;
  }[];
}
export function beginNPCApproachEvidence(
  battle: BattleSnapshot,
  unitId: string | number,
  npcId: string,
): NPCApproachTrace | null {
  if (!process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR']) {
    return null;
  }
  try {
    return { inputBattle: structuredClone(battle), unitId: String(unitId), npcId, steps: [] };
  } catch {
    return null;
  }
}
export function observeNPCApproachAction(
  trace: NPCApproachTrace | null,
  before: BattleSnapshot,
  after: BattleSnapshot,
  action: BattleOrder,
) {
  if (!trace) {
    return;
  }
  try {
    trace.steps.push({
      action: structuredClone(action),
      before: approachView(before, trace.unitId, trace.npcId),
      after: approachView(after, trace.unitId, trace.npcId),
    });
  } catch {
    /* A passive trace cannot replace the original action or error. */
  }
}
export function recordNPCApproachFailure(
  trace: NPCApproachTrace | null,
  battle: BattleSnapshot,
  error: unknown,
) {
  if (!trace) {
    return;
  }
  recordRouteStrategicEvidence({
    helper: 'approachNPC',
    stage: 'preparation-failure',
    campaign: null,
    context: {
      ...trace,
      battle,
      scope:
        'Actual NPC approach boundary and its existing action tape; no campaign snapshot or complete route acceptance.',
    },
    error,
  });
}
