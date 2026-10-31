import type {
  CampaignPendingBattle,
  CampaignSnapshot,
} from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { FightResult } from './opening-driver.ts';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { syncBattleTime } from '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';

interface EvidenceArtifact {
  path: string;
  bytes: number;
  sha256: string;
}
interface RouteBattleFailure {
  campaign: CampaignSnapshot;
  request: CampaignPendingBattle;
  previous: BattleSnapshot | null | undefined;
  result: FightResult & { pair?: { campaign: CampaignSnapshot; battle: BattleSnapshot } };
  expectedOutcome: BattleSnapshot['status'];
  controller?: { readonly name: string } | undefined;
  deploy?: { readonly name: string } | undefined;
  executeBattle?: { readonly name: string } | undefined;
  returnedCampaign?: CampaignSnapshot;
  failureStage?: string;
}
let sequence = 0;

// Opt-in diagnostics for a real failed route. Capture the actual result once;
// do not choose more orders, repeat deployment or settle the campaign.
export function recordRouteBattleFailure({
  campaign,
  request,
  previous,
  result,
  expectedOutcome,
  controller,
  deploy,
  executeBattle,
  returnedCampaign,
  failureStage = 'battle-outcome',
}: RouteBattleFailure) {
  const directory = process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR'];
  if (!directory) {
    return;
  }
  let output: string | undefined;
  try {
    const id = String(request.id)
      .replace(/[^\w.-]/g, '_')
      .slice(0, 120);
    mkdirSync(directory, { recursive: true });
    const captureDirectory = mkdtempSync(join(directory, `${process.pid}-${++sequence}-${id}-`));
    output = captureDirectory;
    const artifacts: EvidenceArtifact[] = [];
    const writeBytes = (name: string, bytes: string) => {
      writeFileSync(join(captureDirectory, name), bytes);
      artifacts.push({
        path: name,
        bytes: Buffer.byteLength(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    };
    const write = (name: string, value: unknown) =>
      writeBytes(name, JSON.stringify(value, null, 2) + '\n');
    write('native-input.json', { campaign, request, previous });
    write('native-result.json', result);
    // A caller can supply its already completed settlement. Capture that value
    // without dispatching another campaign action or changing the battle result.
    if (returnedCampaign !== undefined) {
      write('returned-campaign.json', returnedCampaign);
    }
    const receipt = {
      testFile: basename(process.argv[1] ?? ''),
      pid: process.pid,
      runtime: process.execPath,
      nodeVersion: process.version,
      sourceSnapshot: process.env['GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT'] ?? null,
      battleId: request.id,
      sector: request.sector,
      expectedOutcome,
      actualOutcome: result.battle.status,
      failureStage,
      returnedCampaignProvided: returnedCampaign !== undefined,
      inputCapturePhase: 'retained arguments after execution and reporting',
      preExecutionInputIndependentlyCaptured: false,
      previousExists: previous !== undefined,
      ordersAvailable: Array.isArray(result.orders),
      orders: result.orders?.length ?? null,
      controller: controller?.name ?? null,
      deploy: deploy?.name ?? null,
      executeBattle: executeBattle?.name ?? null,
      trueInitialBattleCaptured: false,
      officialTerminalPair: false,
      additionalOrders: 0,
      settlementExecuted: false,

      terminalPairSource: result.pair
        ? 'actual-per-order-execution'
        : 'derived-end-only-synchronization',
      artifacts,
    };
    let officialTerminalPairError: string | null = null;
    try {
      // Raw input stays separate: clock synchronization and save decoding can add
      // saved fields. Neither operation may alter the actual route result.
      const pair = result.pair
        ? {
            campaign: structuredClone(result.pair.campaign),
            battle: structuredClone(result.pair.battle),
            error: null,
          }
        : syncBattleTime(structuredClone(campaign), structuredClone(result.battle));
      if (result.pair) {
        assert.deepEqual(pair.battle, result.battle);
        assert.equal(pair.campaign.pendingBattle?.id, request.id);
        assert.equal(pair.battle.syncedSeconds, pair.battle.elapsedSeconds);
      }
      assert.equal(pair.error, null);
      const save = encodeSave(pair.campaign, pair.battle),
        restored = decodeSave(save);
      assert.deepEqual(restored.campaign, pair.campaign);
      assert.deepEqual(restored.battle, pair.battle);
      writeBytes('terminal.save.json', save + '\n');
      receipt.officialTerminalPair = true;
    } catch (error) {
      officialTerminalPairError = String(error);
    }
    writeFileSync(
      join(output, 'receipt.json'),
      JSON.stringify({ ...receipt, officialTerminalPairError }, null, 2) + '\n',
    );
  } catch (error) {
    // A diagnostic failure must not replace or suppress the victory assertion.
    console.error('Route failure evidence error:', output ?? directory, String(error));
  }
}
