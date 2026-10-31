import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

let sequence = 0;

// Retain an observed care failure only. This recorder cannot issue orders,
// synchronize time, settle a deployment, or replace the caller's assertion.
export function recordRouteCareFailure({
  boundary,
  pair,
  counters,
  lastInvocation,
  error,
  initialPair,
  directory = process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR,
}) {
  if (!directory) {
    return;
  }
  let output;
  try {
    mkdirSync(directory, { recursive: true });
    const acute = initialPair !== undefined;
    output = mkdtempSync(
      join(
        directory,
        `${process.pid}-${++sequence}-${acute ? 'acute-field-aid' : 'mendoza-care'}-`,
      ),
    );
    const artifacts = [];
    const write = (name, value) => {
      const bytes = JSON.stringify(value, null, 2) + '\n';
      writeFileSync(join(output, name), bytes);
      artifacts.push({
        path: name,
        bytes: Buffer.byteLength(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    };
    if (acute) {
      write('care-initial-medical-pair.json', initialPair);
    }
    if (boundary) {
      write('care-before.json', boundary.before);
      write('care-action.json', boundary.action);
      if (boundary.nativeAfter !== undefined) {
        write('care-native-after.json', boundary.nativeAfter);
      }
      if (boundary.synchronization !== undefined) {
        write('care-synchronized-after.json', boundary.synchronization);
      }
      if (boundary.saveReturned !== undefined) {
        write('care-save-returned-pair.json', boundary.saveReturned);
      }
    }
    write('care-stopped-pair.json', pair);
    const receipt = {
      testFile: basename(process.argv[1] ?? ''),
      pid: process.pid,
      runtime: process.execPath,
      nodeVersion: process.version,
      sourceSnapshot: process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT ?? null,
      failureStage: acute ? 'created-cuyo-acute-field-aid' : 'stock-mendoza-survivor-care',
      lastInvocation,
      error: { name: error.name, code: error.code ?? null, message: error.message },
      counters,
      captureScope: 'latest tactical invocation only; not a full care action tape',
      preExecutionPairIndependentlyCaptured: Boolean(boundary) && boundary.referenceOnly !== true,
      boundaryOrder: boundary?.order ?? null,
      nativeAfterCaptured: boundary?.nativeAfter !== undefined,
      nativeActionAccepted:
        boundary?.nativeAfter === undefined ? null : boundary.nativeAfter.lastError === null,
      existingSynchronizationCaptured: boundary?.synchronization !== undefined,
      failureOccurredInLatestTacticalInvocation: lastInvocation === 'tactical' && Boolean(boundary),
      ...(acute
        ? {
            initialMedicalPairRetained: true,
            preExecutionPairRetained: Boolean(boundary),
            existingSaveReturnCaptured: boundary?.saveReturned !== undefined,
            stoppedPairStage:
              boundary?.saveReturned !== undefined
                ? 'save-returned'
                : boundary?.synchronization !== undefined
                  ? 'synchronized'
                  : boundary
                    ? 'before-action'
                    : 'initial-medical',
            retention:
              'Actual immutable caller references, serialized only on failure. No copied state is adopted.',
          }
        : {}),
      fullCareOrdersAvailable: false,
      fullCareTapeCaptured: false,
      additionalOrders: 0,
      additionalSynchronization: 0,
      settlementExecuted: false,
      artifacts,
    };
    writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  } catch (evidenceError) {
    // Diagnostics must not hide the original clinical loss or assertion.
    try {
      console.error(
        'Route care failure evidence error:',
        output ?? directory,
        String(evidenceError),
      );
    } catch {}
  }
}

// Observe the existing acute-care closure only. Keep one initial pair and one
// latest action boundary; do not execute, synchronize, save or inspect a game.
// A failed action is terminal. The caller rethrows its exact original error.
export function createRouteAcuteAidFailureObserver(
  initialPair,
  { directory = process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR } = {},
) {
  if (!directory) {
    return undefined;
  }
  let boundary = null,
    pair = initialPair,
    orders = 0,
    recorded = false;
  return {
    before(current, action) {
      boundary = { before: current, action, order: ++orders, referenceOnly: true };
      pair = current;
    },
    nativeResult(battle) {
      boundary.nativeAfter = battle;
    },
    synchronized(current) {
      boundary.synchronization = current;
      pair = current;
    },
    saveReturned(current) {
      boundary.saveReturned = current;
      pair = current;
    },
    failed(error) {
      if (recorded) {
        return;
      }
      recorded = true;
      recordRouteCareFailure({
        directory,
        initialPair,
        boundary,
        pair,
        counters: { orders },
        lastInvocation: boundary ? 'tactical' : 'initial-medical',
        error,
      });
    },
  };
}
