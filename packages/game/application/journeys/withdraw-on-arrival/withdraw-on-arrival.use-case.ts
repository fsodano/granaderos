import type { WithdrawOnArrivalRepository } from './withdraw-on-arrival.repository.ts';

export type WithdrawOnArrivalRequest = Readonly<{ squadId: string; decisionId: string }>;
export type WithdrawOnArrivalResponse = Readonly<{
  squadId: string;
  destination: string;
  decisionId: string;
}>;

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
