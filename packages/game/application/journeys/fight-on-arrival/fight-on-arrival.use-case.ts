import type { FightOnArrivalRepository } from './fight-on-arrival.repository.ts';
import type { FightOnArrivalRequest } from './fight-on-arrival.request.ts';
import type { FightOnArrivalResponse } from './fight-on-arrival.response.ts';

export class FightOnArrivalUseCase {
  readonly #repository: FightOnArrivalRepository;

  constructor(repository: FightOnArrivalRepository) {
    this.#repository = repository;
  }

  execute(request: FightOnArrivalRequest): FightOnArrivalResponse {
    const { journey, revision } = this.#repository.loadJourney(request.squadId);
    const sectorId = journey.nextSector;
    journey.chooseFight(request.decisionId);
    this.#repository.commitJourney(request.squadId, journey, revision);
    return { squadId: request.squadId, sectorId, decisionId: request.decisionId };
  }
}
