import type { BattleSnapshot, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import { mkdirSync, mkdtempSync, appendFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { actBattle, endTurn } from '../packages/game/tactical.js';
import { fight, type FightOptions } from './opening-driver.ts';
import type { PathOrFileDescriptor } from 'fs';

const bodyKeys = [
  'id',
  'name',
  'side',
  'hp',
  'maxHp',
  'bleeding',
  'bandaged',
  'ap',
  'maxAP',
  'carriedAP',
  'morale',
  'energy',
  'fatigue',
  'stance',
  'movementMode',
  'activeSlot',
  'x',
  'y',
  'tacticalLevel',
  'medkits',
  'loaded',
  'ammo',
  'routed',
  'unconscious',
  'knockedDown',
  'asleep',
  'weaponDropped',
  'surrendered',
  'fled',
  'departure',
];
const gunKeys = [
  'id',
  'type',
  'side',
  'x',
  'y',
  'tacticalLevel',
  'loaded',
  'ammo',
  'reloadProgress',
  'facing',
];
const battleKeys = [
  'battleId',
  'sectorId',
  'startSeconds',
  'elapsedSeconds',
  'turn',
  'phase',
  'mode',
  'status',
  'lastError',
];
const fields = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key: PropertyKey) => Object.hasOwn(value, key))
      .map((key: string|number) => [key, structuredClone(value[key])]),
  );
const facts = (battle: BattleSnapshot) => ({
  ...fields(battle, battleKeys),
  units: battle.units
    .filter((unit) => unit.side === 'player')
    .map((unit) => fields(unit, bodyKeys)),
  artillery: (battle.artillery ?? [])
    .filter((gun) => gun.side === 'player')
    .map((gun) => fields(gun, gunKeys)),
});
const nativeOrder = (battle: BattleSnapshot, action: TacticalAction) =>
  action.type === 'endTurn' ? endTurn(battle) : actBattle(battle, action);

// This observer retains actual public-order boundaries. It does not reconstruct
// messages already clipped inside one Native order, or call a game query.
export function createUspallataOrderHealthJournal({
  directory,
  battleId = null,
  executeNative = nativeOrder,
  label = 'uspallata',
  nullDecisionLimit = 2048,
} = {}) {
  if (!directory) {
    return undefined;
  }
  let journalPath: PathOrFileDescriptor|null = null,
    sequence = 0,
    warning = false,
    initialRecorded = false,
    nullAttempts = 0,
    nullWritten = 0,
    nullLimitRecorded = false;
  const nullKeys = new Set();
  const warn = (error) => {
    if (warning) {
      return;
    }
    warning = true;
    try {
      console.error(
        label === 'uspallata'
          ? 'Uspallata health journal diagnostic failed:'
          : 'Hospital health journal diagnostic failed:',
        String(error),
      );
    } catch {}
  };
  const record = (build) => {
    try {
      if (journalPath) {
        appendFileSync(journalPath, JSON.stringify(build()) + '\n');
      }
    } catch (error) {
      warn(error);
    }
  };
  const read = (build) => {
    try {
      return build();
    } catch (error) {
      warn(error);
      return null;
    }
  };
  try {
    if (!isAbsolute(directory)) {
      throw Error('The diagnostic directory must be absolute.');
    }
    if (
      !/^[a-z][a-z0-9-]*$/.test(label) ||
      !Number.isSafeInteger(nullDecisionLimit) ||
      nullDecisionLimit < 1 ||
      nullDecisionLimit > 2048
    ) {
      throw Error('Invalid diagnostic label or observation limit.');
    }
    mkdirSync(directory, { recursive: true });
    journalPath = join(
      mkdtempSync(join(directory, `${process.pid}-${label}-order-health-`)),
      'orders.ndjson',
    );
    record(() => ({
      kind: 'header',
      version: 1,
      battleId,
      pid: process.pid,
      runtime: process.execPath,
      nodeVersion: process.version,
      sourceSnapshot: process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT ?? null,
      buildRevision: process.env.GRANADEROS_CAMPAIGN_BUILD_REVISION ?? null,
      scope:
        label === 'uspallata'
          ? 'One original fight execution; own body and gun facts plus actual returned logs. No campaign snapshots or additional game calls.'
          : 'One original hospital fight execution; actual admitted battle, existing roles, bounded null decisions, own body/gun facts and returned logs. No additional game calls.',
      ...(label === 'uspallata'
        ? {}
        : {
            label,
            nullDecisionLimit,
            nullDeduplication:
              'Existing native-order sequence + callback source + actual battle boundary + own actor facts. Repeated holds at that same boundary are omitted.',
          }),
      limitation: 'A returned log can already omit messages clipped inside that same Native order.',
    }));
  } catch (error) {
    journalPath = null;
    warn(error);
  }
  const executeOrder = (current, action) => {
    const index = ++sequence,
      before = read(() => facts(current)),
      issued = read(() => structuredClone(action));
    let next;
    try {
      next = executeNative(current, action);
    } catch (error) {
      record(() => ({
        kind: 'order',
        sequence: index,
        action: issued,
        before,
        outcome: 'threw',
        error: { name: error?.name ?? null, message: error?.message ?? String(error) },
      }));
      throw error;
    }
    record(() => ({
      kind: 'order',
      sequence: index,
      action: issued,
      before,
      after: facts(next),
      accepted: next.lastError === null,
      returnedLog: [...(next.log ?? [])],
    }));
    return next;
  };
  const initial = (battle, roles = null) => {
    if (initialRecorded) {
      return;
    }
    initialRecorded = true;
    record(() => ({
      kind: 'initial',
      sequence,
      roles: structuredClone(roles),
      battle: structuredClone(battle),
    }));
  };
  const nullDecision = (battle, unit, { source, roles = null, returnedKind = 'null' } = {}) => {
    if (!journalPath) {
      return;
    }
    nullAttempts++;
    try {
      const boundary = fields(battle, battleKeys),
        body = fields(unit, bodyKeys),
        key = JSON.stringify([sequence, source, boundary, body]);
      if (nullKeys.has(key)) {
        return;
      }
      if (nullWritten >= nullDecisionLimit) {
        if (!nullLimitRecorded) {
          nullLimitRecorded = true;
          record(() => ({ kind: 'null-decision-limit', sequence, limit: nullDecisionLimit }));
        }
        return;
      }
      nullKeys.add(key);
      nullWritten++;
      record(() => ({
        kind: 'null-decision',
        sequence,
        source,
        returnedKind,
        boundary,
        unit: body,
        roles: structuredClone(roles),
      }));
    } catch (error) {
      warn(error);
    }
  };
  const nullSummary = () =>
    label === 'uspallata'
      ? {}
      : {
          nullDecisionAttempts: nullAttempts,
          nullDecisionRecords: nullWritten,
          nullDecisionLimit,
          nullDecisionLimitReached: nullLimitRecorded,
        };
  const finish = (result) =>
    record(() => ({
      kind: 'result',
      orders: sequence,
      actions: result.actions,
      orderTape: structuredClone(result.orders),
      after: facts(result.battle),
      returnedLog: [...(result.battle.log ?? [])],
      ...nullSummary(),
    }));
  const failed = (error) =>
    record(() => ({
      kind: 'failure',
      orders: sequence,
      error: { name: error?.name ?? null, message: error?.message ?? String(error) },
      ...nullSummary(),
    }));
  return {
    executeOrder,
    initial,
    nullDecision,
    finish,
    failed,
    get journalPath() {
      return journalPath;
    },
  };
}

// Each invocation gets a separate journal, including the existing victory
// repetition. Entry, deployment, controllers and Native limits stay in fight.
export const journaledUspallataFight = (directory: string) => (request: CampaignPendingBattle, previous: BattleSnapshot|null|undefined, options: FightOptions|undefined) => {
  const journal = createUspallataOrderHealthJournal({ directory, battleId: request.id });
  try {
    const result = fight(request, previous, {
      ...options,
      ...(journal ? { executeOrder: journal.executeOrder } : {}),
    });
    journal?.finish(result);
    return result;
  } catch (error) {
    journal?.failed(error);
    throw error;
  }
};
