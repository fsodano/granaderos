import type { Journey, RedirectJourneyPlan } from '../../../domain/journeys/journey.ts';

export interface RedirectJourneyRepository {
  loadJourney(squadId: string): { journey: Journey; revision: number; nowSeconds: number };
  planRoute(
    journey: Journey,
    destination: string,
    waypoints: readonly string[],
  ): RedirectJourneyPlan;
  commitJourney(squadId: string, journey: Journey, expectedRevision: number): void;
}
