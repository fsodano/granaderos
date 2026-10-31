import { fight } from './opening-driver.ts';
import { createUspallataOrderHealthJournal } from './uspallata-order-health-journal.mjs';

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
      journal.initial(admitted, roles);
      return admitted;
    },
    executeOrder: journal.executeOrder,
  };
  for (const source of ['controller', 'sharedFallback']) {
    if (typeof options[source] === 'function') {
      observed[source] = (battle, unit) => {
        const order = options[source](battle, unit);
        if (order == null) {
          journal.nullDecision(battle, unit, {
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
  (directory, { roles = null } = {}) =>
  (request, previous, options = {}) => {
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
