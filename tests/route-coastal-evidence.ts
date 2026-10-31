import type { ActiveGame } from './local-contract-fixture.ts';
import type { BattleOrder } from './opening-driver.ts';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

let sequence = 0;
const phases = {
  'before-battle-execution': {
    beforeOriginalBattleExecution: true,
    preExecutionInputIndependentlyCaptured: true,
  },
  'native-combat-result': {
    afterOriginalBattleExecution: true,
    actualNativeCombatResultCaptured: true,
  },
  'replay-initial-pair': { beforeExistingReplay: true, actualReplayInitialPairCaptured: true },
  'after-replay-before-exploration': { afterExistingReplay: true, beforeExistingExploration: true },
  'before-field-aid': { afterExistingExploration: true, beforeExistingFieldAid: true },
  'after-field-aid-before-settlement': {
    afterExistingFieldAid: true,
    beforeExistingSettlement: true,
  },
  'before-existing-settlement': { afterExistingPairSave: true, beforeExistingSettlement: true },
  'native-returned-campaign-after-settlement': {
    afterExistingSettlement: true,
    beforeExistingCampaignSave: true,
  },
  'saved-campaign-before-defeated-assertion': {
    afterExistingSettlement: true,
    afterExistingCampaignSave: true,
    beforeOriginalDefeatedAssertion: true,
  },
  'before-clinic-hire-orders': {
    beforeExistingClinicHireOrders: true,
    beforeExistingClinicHireWait: true,
  },
  'before-clinic-hire-wait': {
    afterExistingClinicHireOrders: true,
    beforeExistingClinicHireWait: true,
  },
  'after-clinic-hire-wait': {
    afterExistingClinicHireWait: true,
    beforeExistingClinicWaitSave: true,
  },
  'before-clinic-survivor-assertion': { beforeOriginalClinicSurvivorAssertion: true },
};

type CoastalStage = keyof typeof phases;
const pairClock = ({ battle, campaign }: ActiveGame) => ({
  turn: battle.turn,
  phase: battle.phase,
  status: battle.status,
  elapsedSeconds: battle.elapsedSeconds,
  hour: campaign.hour,
  secondOfHour: campaign.secondOfHour,
});
interface AcceptedOrder {
  index: number;
  phase: 'replay' | 'postcombat';
  action: BattleOrder;
  before: ReturnType<typeof pairClock>;
  after: ReturnType<typeof pairClock>;
  nativeAccepted: true;
  existingSynchronizationCompleted: true;
}
function replayOrderCount(value: unknown): number | null {
  return value !== null &&
    typeof value === 'object' &&
    'orders' in value &&
    Array.isArray(value.orders)
    ? value.orders.length
    : null;
}

// Opt-in raw observations only. No game imports, native orders, synchronization,
// save normalization, settlement or assertions belong to this recorder.
export function beginRouteCoastalEvidence({
  routeKind,
  sector,
  battleId,
}: {
  routeKind: string;
  sector: string;
  battleId: string;
}) {
  const directory = process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR'];
  if (!directory) {
    return null;
  }
  let output: string | undefined;
  const warn = (error: unknown) => {
    try {
      console.error('Route coastal evidence error:', output ?? directory, String(error));
    } catch {}
  };
  try {
    const parent = join(directory, 'coastal-boundaries');
    mkdirSync(parent, { recursive: true });
    const label = `${routeKind}-${sector}-${battleId}`.replace(/[^\w.-]/g, '_').slice(0, 120);
    const captureDirectory = mkdtempSync(join(parent, `${process.pid}-${++sequence}-${label}-`));
    output = captureDirectory;
    const artifacts = new Map<string, { path: string; bytes: number; sha256: string }>();
    const accepted: AcceptedOrder[] = [];
    const stages: ({ stage: CoastalStage } & (typeof phases)[CoastalStage])[] = [];
    const diagnosticErrors: string[] = [];
    const receipt = {
      testFile: basename(process.argv[1] ?? ''),
      pid: process.pid,
      runtime: process.execPath,
      nodeVersion: process.version,
      sourceSnapshot: process.env['GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT'] ?? null,
      buildRevision: process.env['GRANADEROS_CAMPAIGN_BUILD_REVISION'] ?? null,
      routeKind,
      sector,
      battleId,
      stages,
      diagnosticErrors,
      originalControllerInitialBattleCaptured: false,
      saveNormalizationPerformed: false,
      additionalOrders: 0,
      additionalSynchronization: 0,
      settlementExecuted: false,
      tacticalTrace: {
        scope:
          'Accepted existing local tactical helper calls in this sector: battle replay and postcombat exploration/field aid only.',
        excludes:
          'Controller internal calls, auto-bandage planning calls, campaign dispatches and tactical calls inside other helpers.',
        acceptedOrders: 0,
        replayOrders: 0,
        postcombatOrders: 0,
        expectedReplayOrders: replayOrderCount(null),
        replayCompleted: false,
        postcombatCompleted: false,
        completeFullRouteActionTape: false,
        completeFullClinicalActionTape: false,
      },
    };
    const writeReceipt = () =>
      writeFileSync(
        join(captureDirectory, 'receipt.json'),
        JSON.stringify({ ...receipt, artifacts: [...artifacts.values()] }, null, 2) + '\n',
      );
    const write = (name: string, value: unknown) => {
      const bytes = JSON.stringify(structuredClone(value), null, 2) + '\n';
      writeFileSync(join(captureDirectory, name), bytes);
      artifacts.set(name, {
        path: name,
        bytes: Buffer.byteLength(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    };
    const guarded = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        receipt.diagnosticErrors.push(String(error));
        receipt.tacticalTrace.replayCompleted = false;
        receipt.tacticalTrace.postcombatCompleted = false;
        try {
          writeReceipt();
        } catch {}
        warn(error);
      }
    };
    writeReceipt();
    return {
      capture(stage: CoastalStage, value: unknown) {
        guarded(() => {
          if (!Object.hasOwn(phases, stage)) {
            throw Error('Unknown coastal evidence stage.');
          }
          write(stage + '.json', value);
          receipt.stages.push({ stage, ...phases[stage] });
          if (stage === 'native-combat-result') {
            receipt.tacticalTrace.expectedReplayOrders = replayOrderCount(value);
          }
          if (stage === 'after-replay-before-exploration') {
            receipt.tacticalTrace.replayCompleted =
              receipt.diagnosticErrors.length === 0 &&
              receipt.tacticalTrace.replayOrders === receipt.tacticalTrace.expectedReplayOrders;
          }
          if (stage === 'after-field-aid-before-settlement') {
            receipt.tacticalTrace.postcombatCompleted = receipt.diagnosticErrors.length === 0;
          }
          writeReceipt();
        });
      },
      accepted(
        action: BattleOrder,
        {
          phase,
          before,
          after,
        }: { phase: 'replay' | 'postcombat'; before: ActiveGame; after: ActiveGame },
      ) {
        guarded(() => {
          if (!['replay', 'postcombat'].includes(phase)) {
            throw Error('Unknown coastal tactical trace phase.');
          }
          // The caller reaches this point only after its original tactical helper
          // accepts the native order and completes its existing synchronization.
          accepted.push(
            structuredClone({
              index: accepted.length,
              phase,
              action,
              before: pairClock(before),
              after: pairClock(after),
              nativeAccepted: true,
              existingSynchronizationCompleted: true,
            }),
          );
          write('accepted-local-tactical-orders.json', accepted);
          receipt.tacticalTrace.acceptedOrders = accepted.length;
          receipt.tacticalTrace[phase === 'replay' ? 'replayOrders' : 'postcombatOrders']++;
          writeReceipt();
        });
      },
    };
  } catch (error) {
    warn(error);
    return null;
  }
}
