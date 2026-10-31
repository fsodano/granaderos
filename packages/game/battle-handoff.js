import { AdmitSectorReinforcementsUseCase } from './application/sector-sessions/admit-sector-reinforcements/admit-sector-reinforcements.use-case.ts';
import { SnapshotAdmitSectorReinforcementsRepository } from './infrastructure/sector-sessions/sector-reinforcement-repository.js';
import { applyQuestEscortOrders } from './quest-escort.js';
import { syncBattleTime, withCampaignTimeBoundary } from './time.js';
import { enterSector } from './world.js';
import { validateQuestBeneficiaryContext } from './quest-beneficiaries.js';
import { validateRepairReserveContext } from './repair-materials.js';

// A timed-out encounter resumes its exact turn, AP, wounds and departure receipts.
/** @param {import('./public/campaign-types.ts').CampaignSnapshot|null} [campaign]
 * @returns {import('./public/compatibility-types.ts').BattleSnapshot} */
export function battleFromRequest(request, campaign = null, options = {}) {
  if (campaign === null && request.sector === undefined && !request.resumeSnapshot) {
    request = { ...request, sector: request.id };
  }
  if (request.resumeSnapshot) {
    validateRepairReserveContext(request, request.resumeSnapshot);
    if (campaign) {
      validateQuestBeneficiaryContext(campaign, request.resumeSnapshot, { request });
    }
    const resumed = enterSector(request, null, options);
    return campaign ? withCampaignTimeBoundary(campaign, resumed) : resumed;
  }
  const previous =
    (request.sceneId
      ? campaign?.sceneStates?.[request.sceneId]
      : campaign?.sectorStates?.[request.sector]) ?? null;
  const boundary = campaign ? withCampaignTimeBoundary(campaign, {}) : {};
  return enterSector(
    {
      ...request,
      ...boundary,
      hour: request.hour ?? campaign?.hour ?? 8,
      secondOfHour: request.secondOfHour ?? campaign?.secondOfHour ?? 0,
    },
    previous,
    options,
  );
}

// Immediate enemy initiative can advance the tactical clock before the UI opens.
// Publish campaign and battle together so the first autosave is loadable.
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} campaign @returns {{campaign: import('./public/campaign-types.ts').CampaignSnapshot, battle: import('./public/compatibility-types.ts').BattleSnapshot | null, error: string | null}} */
export function prepareCampaignBattle(campaign, options = {}) {
  if (!campaign?.pendingBattle) {
    return { campaign, battle: null, error: 'No hay un despliegue pendiente.' };
  }
  const battle = applyQuestEscortOrders(
    campaign,
    battleFromRequest(campaign.pendingBattle, campaign, options),
  );
  return syncBattleTime(campaign, battle);
}

/** @returns {import('./public/compatibility-types.ts').BattleSnapshot} */
export function admitSectorReinforcements(snapshot, request, { placements = {} } = {}) {
  const repository = new SnapshotAdmitSectorReinforcementsRepository(snapshot, request, placements);
  new AdmitSectorReinforcementsUseCase(repository).execute();
  return repository.result;
}
