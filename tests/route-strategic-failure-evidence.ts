import type { TacticalAction } from '../packages/game/public/compatibility-types.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

interface EvidenceArtifact {
  path: string;
  bytes: number;
  sha256: string;
}
interface StrategicEvidence {
  helper: string;
  stage: string;
  campaign: CampaignSnapshot | null;
  action?: CampaignAction | TacticalAction;
  returnedCampaign?: CampaignSnapshot;
  inputCapture?: string | null;
  context?: unknown;
  error?: unknown;
  preDispatchInputIndependentlyCloned?: boolean;
}
let sequence = 0;
const diagnosticError = (error: unknown) => {
  try {
    process.stderr.write(
      JSON.stringify({ event: 'routeStrategicDiagnosticFailed', message: String(error) }) + '\n',
    );
  } catch {}
};

// Call before the existing native dispatch. Disabled diagnostics never clone.
export function captureRouteStrategicInput(campaign: CampaignSnapshot) {
  if (!process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR']) {
    return null;
  }
  try {
    return structuredClone(campaign);
  } catch (error) {
    diagnosticError(error);
    return null;
  }
}

// Raw observations only: this module has no game imports or executable orders.
export function recordRouteStrategicEvidence({
  helper,
  stage,
  campaign,
  action,
  returnedCampaign,
  inputCapture = null,
  context = null,
  error = null,
  preDispatchInputIndependentlyCloned = false,
}: StrategicEvidence) {
  const directory = process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR'];
  if (!directory) {
    return null;
  }
  try {
    const rawCampaign = structuredClone(campaign),
      rawAction = action === undefined ? undefined : structuredClone(action),
      rawReturned = returnedCampaign === undefined ? undefined : structuredClone(returnedCampaign),
      rawContext = context === null ? null : structuredClone(context);
    const label = `${helper}-${stage}`.replace(/[^\w.-]/g, '_').slice(0, 140),
      root = join(directory, 'strategic-preparation');
    mkdirSync(root, { recursive: true });
    const output = mkdtempSync(join(root, `${process.pid}-${++sequence}-${label}-`));
    const artifacts: EvidenceArtifact[] = [];
    const write = (name: string, value: unknown) => {
      const bytes = JSON.stringify(value, null, 2) + '\n';
      writeFileSync(join(output, name), bytes);
      artifacts.push({
        path: name,
        bytes: Buffer.byteLength(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    };
    write('campaign.json', rawCampaign);
    if (rawAction !== undefined) {
      write('action.json', rawAction);
    }
    if (rawReturned !== undefined) {
      write('returned-campaign.json', rawReturned);
    }
    if (rawContext !== null) {
      write('context.json', rawContext);
    }
    if (error !== null) {
      write(
        'error.json',
        error instanceof Error
          ? {
              name: error.name ?? null,
              message: error.message ?? String(error),
              stack: error.stack ?? null,
            }
          : { message: JSON.stringify(error) },
      );
    }
    const receipt = {
      testFile: basename(process.argv[1] ?? ''),
      pid: process.pid,
      runtime: process.execPath,
      nodeVersion: process.version,
      sourceSnapshot: process.env['GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT'] ?? null,
      buildRevision: process.env['GRANADEROS_CAMPAIGN_BUILD_REVISION'] ?? null,
      helper,
      stage,
      inputCapture,
      rawCampaignIndependentlyCloned: true,
      prePreparationInputIndependentlyCaptured: stage === 'preparation-input',
      preDispatchInputIndependentlyCloned,
      capturePhase:
        stage === 'route-checkpoint'
          ? 'actual existing route checkpoint after its native orders'
          : stage === 'preparation-input'
            ? 'raw helper argument before its save round trip or native orders'
            : stage === 'campaign-action-refusal'
              ? 'actual existing action input and returned rejected state; rejection is not adopted unless the original helper already assigned it'
              : 'actual private helper state at its original thrown failure',
      scope:
        'Passive boundary only. Context contains current caller values and any existing partial helper records; no full campaign tape is claimed.',
      additionalOrders: 0,
      additionalSynchronization: 0,
      saveNormalizationPerformed: false,
      settlementExecuted: false,
      artifacts,
    };
    writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    return output;
  } catch (error) {
    diagnosticError(error);
    return null;
  }
}
