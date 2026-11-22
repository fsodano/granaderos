import type { GetRecruitmentCandidatesRequest } from '../../../packages/game/application/personnel/get-recruitment-candidates/get-recruitment-candidates.request.ts';
import type { GetRecruitmentCandidatesResponse } from '../../../packages/game/application/personnel/get-recruitment-candidates/get-recruitment-candidates.response.ts';
import { GetRecruitmentCandidatesUseCase } from '../../../packages/game/application/personnel/get-recruitment-candidates/get-recruitment-candidates.use-case.ts';
import type {
  CampaignOperative,
  CampaignSnapshot,
} from '../../../packages/game/public/campaign-types.ts';
import { CampaignGetRecruitmentCandidatesRepository } from '../../../packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js';

/** Read the recruitment catalogue for the interface without changing the campaign. */
export function getRecruitmentCandidates(
  campaign: CampaignSnapshot,
  roster: CampaignOperative[],
  request: GetRecruitmentCandidatesRequest,
): GetRecruitmentCandidatesResponse {
  const repository = new CampaignGetRecruitmentCandidatesRepository(campaign, roster);
  return new GetRecruitmentCandidatesUseCase(repository).execute(request);
}
