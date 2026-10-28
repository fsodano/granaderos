import type { Journey } from '../../../domain/journeys/journey.ts';

export interface WithdrawOnArrivalRepository {
  loadJourney(squadId: string): { journey: Journey; revision: number };
  commitJourney(squadId: string, journey: Journey, expectedRevision: number): void;
}
