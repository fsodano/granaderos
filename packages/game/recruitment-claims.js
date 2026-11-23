import {
  settleServiceGuarantee,
  guaranteeRecord,
  treasuryRefundReason,
} from './service-guarantees.js';
import { characterForOperative, isContractOperative } from './content-character-ids.ts';
import { campaignSectors } from './campaign-definition.js';
import { arrivalSitesFor, arrivalSiteLabel } from './arrival-sites.js';
import { CONTRACT_TERMS, contractQuote } from './contracts.js';

export function recruitmentSiteReason(state, destination) {
  const site = arrivalSitesFor(state).find((s) => s.sector === destination);
  if (!site) {
    return 'Elegí un destino habilitado para reclutar: una posta, un cuartel, un puerto o un embarcadero.';
  }
  if (state.sectors?.[destination]?.owner !== 'patriot') {
    return 'Elegí un destino de reclutamiento que esté bajo tu control.';
  }
  if (
    (state.enemyGroups ?? []).some(
      (g) => g.target === destination && ['waiting', 'stationed', 'engaged'].includes(g.status),
    )
  ) {
    return 'No podés reclutar en ese destino: hay fuerzas enemigas o un combate en curso.';
  }
  if (state.blockade && !site.facilities.some((f) => ['post', 'barracks'].includes(f))) {
    return 'El bloqueo impide reclutar en destinos sin acceso terrestre. Elegí uno con acceso terrestre.';
  }
  return null;
}
export function recruitmentSites(state) {
  return campaignSectors(state)
    .filter((s) => !recruitmentSiteReason(state, s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      infrastructure: arrivalSiteLabel(arrivalSitesFor(state).find((site) => site.sector === s.id)),
    }));
}
/** @returns {import("./public/campaign-types.ts").CampaignRefundableRecruitmentClaim|undefined} */
export function pendingRecruitmentClaim(state, id) {
  return (state.refundableRecruitmentClaims ?? []).find(
    (claim) => claim.operativeId === Number(id),
  );
}
export function cancelRecruitmentClaim(state, id) {
  const claim = pendingRecruitmentClaim(state, id);
  if (!claim) {
    throw Error('No tenés ninguna solicitud de reclutamiento pendiente para cancelar.');
  }
  const reason = recruitmentClaimCancellationReason(state, id);
  if (reason) {
    throw Error(reason);
  }
  settleServiceGuarantee(state, claim, { id: claim.operativeId }, 'cancelled');
  state.resources.treasury += claim.paid;
  state.refundableRecruitmentClaims = state.refundableRecruitmentClaims.filter(
    (candidate) => candidate !== claim,
  );
}
export function recruitmentClaimCancellationReason(state, id) {
  const claim = pendingRecruitmentClaim(state, id);
  if (!claim) {
    return null;
  }
  const guarantee = guaranteeRecord(state, claim);
  return treasuryRefundReason(
    state,
    claim.paid + (guarantee?.state === 'held' ? guarantee.amount : 0),
  );
}
// Supported older snapshots recorded a prepaid recruit who had not departed yet.
// Restoration validates that record before converting it to service or a claim.
export function validateLegacyHiringArrivals(state, roster) {
  if (state.hiringArrivals === undefined) {
    return;
  }
  const need = (ok) => {
    if (!ok) {
      throw Error(
        'Los datos guardados de las solicitudes de reclutamiento anteriores no son válidos.',
      );
    }
  };
  const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  const keys = [
    'operativeId',
    'destination',
    'bookedAt',
    'departedAt',
    'dueAt',
    'travelHours',
    'term',
    'paid',
    'permanent',
    'serviceHours',
  ];
  const seconds = ['bookedSecond', 'departedSecond', 'dueSecond'];
  need(Array.isArray(state.hiringArrivals) && state.hiringArrivals.length <= roster.length);
  const ids = new Set();
  for (const a of state.hiringArrivals) {
    need(
      a &&
        typeof a === 'object' &&
        !Array.isArray(a) &&
        Object.keys(a).every(
          (k) =>
            keys.includes(k) || seconds.includes(k) || k === 'priceScale' || k === 'guaranteeId',
        ) &&
        keys.every((k) => Object.hasOwn(a, k)) &&
        (a.priceScale === undefined ||
          (Number.isFinite(a.priceScale) && a.priceScale > 0 && a.priceScale <= 100)),
    );
    need(
      seconds.every((k) => !Object.hasOwn(a, k) || integer(a[k], 0, 3599)) &&
        Object.hasOwn(a, 'departedSecond') === Object.hasOwn(a, 'dueSecond'),
    );
    const operative = roster.find((o) => o.id === a.operativeId);
    need(
      operative &&
        isContractOperative(state, operative) &&
        !ids.has(a.operativeId) &&
        !state.forceRoster.includes(a.operativeId) &&
        !state.contracts?.[a.operativeId],
    );
    ids.add(a.operativeId);
    need(
      state.operativeState[a.operativeId]?.alive &&
        !state.operativeState[a.operativeId]?.captured &&
        !state.operativeState[a.operativeId]?.serviceEquipmentReturn &&
        arrivalSitesFor(state).some((site) => site.sector === a.destination),
    );
    need(
      integer(a.bookedAt, 0, state.hour) &&
        integer(a.departedAt, a.bookedAt, state.hour) &&
        integer(a.travelHours, 1, 168) &&
        a.travelHours === (characterForOperative(state, a.operativeId)?.arrivalHours ?? 0) &&
        a.dueAt === a.departedAt + a.travelHours,
    );
    const campaignSeconds = state.hour * 3600 + (state.secondOfHour ?? 0),
      booked = a.bookedAt * 3600 + (a.bookedSecond ?? 0),
      departed = a.departedAt * 3600 + (a.departedSecond ?? 0);
    need(
      booked <= departed &&
        departed <= campaignSeconds &&
        a.dueAt * 3600 + (a.dueSecond ?? 0) === departed + a.travelHours * 3600,
    );
    need(Object.hasOwn(CONTRACT_TERMS, a.term));
    const quote = contractQuote(
      { ...state, hiringPriceMultiplier: a.priceScale ?? 1 },
      operative,
      a.term,
    );
    need(
      a.permanent === quote.permanent &&
        a.serviceHours === quote.hours &&
        integer(a.paid, 0, 1e9) &&
        a.paid === quote.price,
    );
  }
}
export function validateRecruitmentClaims(state, roster) {
  const claims = state.refundableRecruitmentClaims;
  if (claims === undefined) {
    return;
  }
  const need = (ok) => {
    if (!ok) {
      throw Error('Los datos guardados de las solicitudes de reclutamiento no son válidos.');
    }
  };
  const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  const keys = [
    'operativeId',
    'destination',
    'bookedAt',
    'term',
    'paid',
    'permanent',
    'serviceHours',
  ];
  need(Array.isArray(claims) && claims.length <= roster.length);
  const ids = new Set();
  for (const claim of claims) {
    need(
      claim &&
        typeof claim === 'object' &&
        !Array.isArray(claim) &&
        Object.keys(claim).every(
          (k) =>
            keys.includes(k) || k === 'bookedSecond' || k === 'priceScale' || k === 'guaranteeId',
        ) &&
        keys.every((k) => Object.hasOwn(claim, k)) &&
        (claim.priceScale === undefined ||
          (Number.isFinite(claim.priceScale) && claim.priceScale > 0 && claim.priceScale <= 100)),
    );
    need(claim.bookedSecond === undefined || integer(claim.bookedSecond, 0, 3599));
    const operative = roster.find((o) => o.id === claim.operativeId);
    need(
      operative &&
        isContractOperative(state, operative) &&
        !ids.has(claim.operativeId) &&
        !state.forceRoster.includes(claim.operativeId) &&
        !state.contracts?.[claim.operativeId],
    );
    ids.add(claim.operativeId);
    need(
      state.operativeState[claim.operativeId]?.alive &&
        !state.operativeState[claim.operativeId]?.captured &&
        !state.operativeState[claim.operativeId]?.serviceEquipmentReturn &&
        arrivalSitesFor(state).some((site) => site.sector === claim.destination),
    );
    need(integer(claim.bookedAt, 0, state.hour));
    need(Object.hasOwn(CONTRACT_TERMS, claim.term));
    const quote = contractQuote(
      { ...state, hiringPriceMultiplier: claim.priceScale ?? 1 },
      operative,
      claim.term,
    );
    need(
      claim.permanent === quote.permanent &&
        claim.serviceHours === quote.hours &&
        integer(claim.paid, 0, 1e9) &&
        claim.paid === quote.price,
    );
  }
}
