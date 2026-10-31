import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { RouteBatteryEvent, RouteBatteryOptions } from './route-battery.ts';
export type RouteSupportBatteryEvent =
  | RouteBatteryEvent
  | {
      event: 'finiteSupportProfile';
      requested: 'swivel';
      selected: 'bronze4';
      destination: string;
    };
type SupportBatteryOptions = Omit<RouteBatteryOptions, 'excludeIds' | 'report'> & {
  report?: (event: RouteSupportBatteryEvent) => void;
};
import { prepareRouteBattery } from './route-battery.ts';

// A former shop-based light-gun strategy can use the actual heavier piece
// found in a controlled arsenal. Never replace a lost crew, blocked delivery
// or spent ammunition with another profile to conceal that failure.
export function prepareRouteSupportBattery(
  start: CampaignSnapshot,
  {
    destination = start.location,
    keepServing = [],
    resolveEncounter,
    waypointsFor,
    report = () => {},
  }: SupportBatteryOptions = {},
) {
  try {
    return prepareRouteBattery(start, ['swivel'], {
      destination,
      keepServing,
      resolveEncounter,
      waypointsFor,
      report,
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'No remaining controlled physical arsenal can supply swivel.'
    ) {
      throw error;
    }
    report({
      event: 'finiteSupportProfile',
      requested: 'swivel',
      selected: 'bronze4',
      destination,
    });
    return prepareRouteBattery(start, ['bronze4'], {
      destination,
      keepServing,
      resolveEncounter,
      waypointsFor,
      report,
    });
  }
}
