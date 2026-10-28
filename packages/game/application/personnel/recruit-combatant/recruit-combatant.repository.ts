import type {
  RecruitmentContext,
  RecruitmentOutcome,
} from '../../../domain/personnel/recruitment-service.ts';
import type { RecruitCombatantRequest } from './recruit-combatant.request.ts';

export interface RecruitCombatantRepository {
  load(request: RecruitCombatantRequest): RecruitmentContext;
  commit(context: RecruitmentContext, outcome: RecruitmentOutcome): void;
}
