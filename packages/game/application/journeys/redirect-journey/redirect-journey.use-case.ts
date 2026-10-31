import type { RedirectJourneyRepository } from './redirect-journey.repository.ts';
import type { ArrivalDecisionSnapshot } from '../../../domain/journeys/arrival-decision.ts';

export type RedirectJourneyRequest = Readonly<{
  squadId: string;
  destination: string;
  waypoints?: readonly string[];
}>;
export type RedirectJourneyResponse = Readonly<{
  squadId: string;
  destination: string;
  arrivalDecision?: ArrivalDecisionSnapshot;
}>;

export class RedirectJourneyUseCase {
  readonly #repository: RedirectJourneyRepository;

  constructor(repository: RedirectJourneyRepository) {
    this.#repository = repository;
  }

  execute(request: RedirectJourneyRequest): RedirectJourneyResponse {
    const { journey, revision, nowSeconds } = this.#repository.loadJourney(request.squadId);
    const route = this.#repository.planRoute(journey, request.destination, request.waypoints ?? []);
    journey.redirect(route, nowSeconds);
    this.#repository.commitJourney(request.squadId, journey, revision);
    const arrivalDecision = journey.arrivalDecision;
    return {
      squadId: request.squadId,
      destination: journey.destination,
      ...(journey.awaitingArrivalDecision && arrivalDecision ? { arrivalDecision } : {}),
    };
  }
}
