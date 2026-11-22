import type { WithdrawOnArrivalRepository } from './withdraw-on-arrival.repository.ts';
import type { WithdrawOnArrivalRequest } from './withdraw-on-arrival.request.ts';
import type { WithdrawOnArrivalResponse } from './withdraw-on-arrival.response.ts';

export class WithdrawOnArrivalUseCase {
  readonly #repository: WithdrawOnArrivalRepository;

  constructor(repository: WithdrawOnArrivalRepository) {
    this.#repository = repository;
  }

  execute(request: WithdrawOnArrivalRequest): WithdrawOnArrivalResponse {
    const { journey, revision } = this.#repository.loadJourney(request.squadId);
    journey.chooseWithdrawal(request.decisionId);
    this.#repository.commitJourney(request.squadId, journey, revision);
    return {
      squadId: request.squadId,
      destination: journey.destination,
      decisionId: request.decisionId,
    };
  }
}
