import type { ArrivalDecisionSnapshot } from '../../../domain/journeys/arrival-decision.ts';

export type RedirectJourneyResponse = Readonly<{
  squadId: string;
  destination: string;
  arrivalDecision?: ArrivalDecisionSnapshot;
}>;
