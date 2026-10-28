import type { FightOnArrivalRepository } from './fight-on-arrival.repository.ts';

export type FightOnArrivalRequest = Readonly<{ squadId: string; decisionId: string }>;
export type FightOnArrivalResponse = Readonly<{
  squadId: string;
  sectorId: string;
  decisionId: string;
}>;

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
