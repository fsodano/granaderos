import { SectorTimeBudget } from './domain/sector-sessions/sector-time-budget.ts';
import {residentPositionsFor,validateResidentPositionContext} from './infrastructure/world/campaign-resident-positions.js';
import { advanceSectorWorld } from './military-remains.js';
import { hasPendingArrivalDecision, nextSquadTravelBoundarySeconds } from './squad-travel.js';
import { reconcileSectorResidents } from './campaign-presence.js';
import { advanceResidentScavenging, acknowledgeRemovedResidents } from './campaign-civilians.js';
import { applyQuestEscortOrders } from './quest-escort.js';
import { regionalWeatherAt, WEATHER_INTERVAL_HOURS } from './regional-weather.js';
import { gainFatigue, recoverFatigue } from './fatigue.js';
import { dispatchCampaign, rosterFor } from './campaign.js';
import { validateAbilityReferences } from './content-character-abilities.js';
import { validateQuestBeneficiaryContext } from './quest-beneficiaries.js';
import {
  validateCampaignServiceObjections,
  validateServiceObjectionContext,
  hasPendingServiceObjections,
} from './service-objections.js';
import { validatePendingCompanionLoss } from './companion-loss.js';
import { validateRepairReserveContext, retainRepairReserves } from './repair-materials.js';
export const COMBAT_ROUND_SECONDS = 6;
export const REST_SECONDS = 600;
export function advanceBattleClock(s, seconds, { resting = false } = {}) {
  SectorTimeBudget.restore(s).assertCanAdvance(seconds);
  const before = (s.startSeconds ?? 0) + (s.elapsedSeconds ?? 0);
  s.elapsedSeconds = (s.elapsedSeconds ?? 0) + seconds;
  const total = (s.startSeconds ?? 0) + s.elapsedSeconds;
  const hours = Math.floor(total / 3600) - Math.floor(before / 3600);
  if (hours)
    for (const unit of s.units ?? []) {
      if (unit.hp <= 0 || unit.departure || unit.fled || unit.surrendered) continue;
      if (resting && s.mode === 'exploration') recoverFatigue(unit, hours, 0);
      else gainFatigue(unit, 2 * hours);
    }
  s.night = total % 86400 < 21600 || total % 86400 >= 72000;
  if (
    s.regionalWeather &&
    Math.floor(before / (WEATHER_INTERVAL_HOURS * 3600)) !==
      Math.floor(total / (WEATHER_INTERVAL_HOURS * 3600))
  )
    s.weather = regionalWeatherAt(s.sectorId, total / 3600, s);
  s.lights = (s.lights ?? [])
    .map((l) =>
      Number.isFinite(l.turns)
        ? {
            ...l,
            remainingSeconds: Math.max(0, (l.remainingSeconds ?? l.turns * 600) - seconds),
            turns: Math.max(0, Math.ceil(((l.remainingSeconds ?? l.turns * 600) - seconds) / 600)),
          }
        : l,
    )
    .filter((l) => l.remainingSeconds !== 0);
}
export function withCampaignTimeBoundary(campaign, battle) {
  const next = { ...battle, gameRevision: campaign.gameRevision ?? 0 };
  const context = battle.sectorId ? battle : campaign.pendingBattle ?? battle;
  const residentPositions = residentPositionsFor(campaign, context);
  if (residentPositions.length) next.residentPositions = residentPositions;
  else delete next.residentPositions;
  if (campaign.gameSessionId) next.gameSessionId = campaign.gameSessionId;
  const now = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
  const duration = hasPendingArrivalDecision(campaign)
    ? 0
    : nextSquadTravelBoundarySeconds(campaign);
  if (duration === null) delete next.worldTimeLimitSecond;
  else next.worldTimeLimitSecond = now + duration;
  return next;
}

export function syncBattleTime(campaign, battle) {
  try {
    if (
      !campaign.pendingBattle ||
      (battle.battleId && battle.battleId !== campaign.pendingBattle.id)
    )
      return { campaign, battle, error: 'El reloj no corresponde al despliegue.' };
    validateResidentPositionContext(campaign, battle);
    validateRepairReserveContext(campaign.pendingBattle, battle);
    if (campaign.pendingBattle.resumeSnapshot)
      validateRepairReserveContext(campaign.pendingBattle, campaign.pendingBattle.resumeSnapshot);
    validateCampaignServiceObjections(campaign, rosterFor(campaign));
    validatePendingCompanionLoss(campaign, rosterFor(campaign));
    validateServiceObjectionContext(campaign, battle, rosterFor(campaign));
    validateQuestBeneficiaryContext(campaign, campaign.pendingBattle, {
      request: null,
      issued: true,
    });
    validateAbilityReferences(campaign, battle);
    validateQuestBeneficiaryContext(campaign, battle);
    if (campaign.pendingBattle.resumeSnapshot)
      validateAbilityReferences(campaign, campaign.pendingBattle.resumeSnapshot);
    if (campaign.pendingBattle.resumeSnapshot)
      validateQuestBeneficiaryContext(campaign, campaign.pendingBattle.resumeSnapshot);
    const elapsed = battle.elapsedSeconds ?? 0;
    const next = dispatchCampaign(campaign, {
      type: 'syncTacticalTime',
      battleId: campaign.pendingBattle.id,
      elapsedSeconds: elapsed,
      sectorState: battle,
    });
    if (next.lastError) return { campaign, battle, error: next.lastError };
    const units = battle.units.map((u) => {
      const horse = u.mount && next.horseState?.horses.find((h) => h.id === u.mount.id);
      return horse
        ? { ...u, mount: { ...u.mount, condition: Math.min(u.mount.condition, horse.condition) } }
        : u;
    });
    let syncedBattle = applyQuestEscortOrders(
      next,
      structuredClone({
        ...battle,
        units,
        syncedSeconds: elapsed,
        savedHour: next.hour,
        savedSecond: next.secondOfHour ?? 0,
      }),
    );
    advanceSectorWorld(syncedBattle, next.hour * 3600 + (next.secondOfHour ?? 0));
    acknowledgeRemovedResidents(next, syncedBattle);
    reconcileSectorResidents(next, syncedBattle);
    advanceResidentScavenging(next, syncedBattle, next.hour * 3600 + (next.secondOfHour ?? 0));
    syncedBattle = withCampaignTimeBoundary(next, syncedBattle);
    return { campaign: next, battle: syncedBattle, error: null };
  } catch (error) {
    return { campaign, battle, error: error.message };
  }
}
