import { restoreCampaignValue } from '../../../packages/game/campaign.js';
import { validateBattleSnapshot } from '../../../packages/game/validate-battle.js';
import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';

export interface SaveRequestIdentity {
  id: number;
  sessionId: string;
  revision: number;
  requestId: string;
}
export interface CampaignSaveRequest extends SaveRequestIdentity {
  campaign: CampaignSnapshot;
  battle: BattleSnapshot | null;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function sequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function readSaveRequestIdentity(value: unknown): SaveRequestIdentity {
  if (
    !record(value) ||
    !sequence(value['id']) ||
    typeof value['sessionId'] !== 'string' ||
    !value['sessionId'] ||
    !sequence(value['revision']) ||
    typeof value['requestId'] !== 'string' ||
    !value['requestId']
  ) {
    throw new Error('La solicitud de guardado no tiene una identidad válida.');
  }
  return {
    id: value['id'],
    sessionId: value['sessionId'],
    revision: value['revision'],
    requestId: value['requestId'],
  };
}
export function readCampaignSaveRequest(value: unknown): CampaignSaveRequest {
  const identity = readSaveRequestIdentity(value);
  if (!record(value)) {
    throw new Error('La solicitud de guardado no es válida.');
  }
  const campaign = restoreCampaignValue(value['campaign']);
  if (
    (campaign.gameSessionId && campaign.gameSessionId !== identity.sessionId) ||
    campaign.gameRevision !== identity.revision
  ) {
    throw new Error('La revisión enviada al guardado no coincide con la partida.');
  }
  const battle =
    value['battle'] === null ? null : validateBattleSnapshot(value['battle'], campaign);
  return { ...identity, campaign, battle };
}
