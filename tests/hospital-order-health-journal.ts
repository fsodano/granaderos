import { present } from './assert-present.ts';
import type { CampaignPendingBattle } from '../packages/game/public/campaign-types.ts';
import { fight } from './opening-driver.ts';
import { createUspallataOrderHealthJournal } from './uspallata-order-health-journal.ts';

// Observe existing callback results only. In particular, a null decision does
// not authorize a sight, path, cover, weapon or treatment query. Its duplicate
// key and 2048-row cap affect diagnostic output only, never Native control.
export function hospitalOrderHealthObservation(
  options,
  { directory, battleId = null, roles = null, nullDecisionLimit = 2048 } = {},
) {
  if (!directory) {
    return { options, journal: undefined };
  }
  const journal = createUspallataOrderHealthJournal({
    directory,
    battleId,
    label: 'hospital',
    nullDecisionLimit,
    executeNative: options.executeOrder,
  });
  const observed = {
    ...options,
    admitBattle(initial) {
      const admitted = options.admitBattle ? options.admitBattle(initial) : initial;
      present(journal).initial(admitted, roles);
      return admitted;
    },
    executeOrder: present(journal).executeOrder,
  };
  for (const source of ['controller', 'sharedFallback']) {
    if (typeof options[source] === 'function') {
      observed[source] = (battle, unit) => {
        const order = options[source](battle, unit);
        if (order == null) {
          present(journal).nullDecision(battle, unit, {
            source,
            roles,
            returnedKind: order === null ? 'null' : 'undefined',
          });
        }
        return order;
      };
    }
  }
  return { options: observed, journal };
}

// Keep the ordinary fight's entry, limits and existing executor. A paired
// executor, when supplied, remains the sole delegate and returns its own body.
export const journaledHospitalFight =
  (directory: string, { roles = null } = {}) =>
  (request: CampaignPendingBattle, previous: BattleSnapshot|null|undefined, options = {}) => {
    const observed = hospitalOrderHealthObservation(options, {
      directory,
      battleId: request.id,
      roles,
    });
    try {
      const result = fight(request, previous, observed.options);
      observed.journal?.finish(result);
      return result;
    } catch (error) {
      observed.journal?.failed(error);
      throw error;
    }
  };
