import type { GetRecruitmentCandidatesRequest } from './get-recruitment-candidates.request.ts';
import type { GetRecruitmentCandidatesResponse } from './get-recruitment-candidates.response.ts';
import type { GetRecruitmentCandidatesRepository } from './get-recruitment-candidates.repository.ts';
export class GetRecruitmentCandidatesUseCase {
  readonly #repository: GetRecruitmentCandidatesRepository;
  constructor(repository: GetRecruitmentCandidatesRepository) {
    this.#repository = repository;
  }
  execute(request: GetRecruitmentCandidatesRequest): GetRecruitmentCandidatesResponse {
    return {
      characterIds: this.#repository
        .loadCatalogue()
        .select(request)
        .map((candidate) => candidate.characterId),
    };
  }
}
