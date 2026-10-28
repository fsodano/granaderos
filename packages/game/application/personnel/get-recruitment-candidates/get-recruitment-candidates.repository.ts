import type { RecruitmentCatalogue } from '../../../domain/personnel/recruitment-catalogue.ts';
export interface GetRecruitmentCandidatesRepository {
  loadCatalogue(): RecruitmentCatalogue;
}
