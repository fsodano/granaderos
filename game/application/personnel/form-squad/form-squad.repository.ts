import { Squad } from '../../../domain/personnel/squad.ts';
import type {
  SquadFormation,
  SquadMemberAvailability,
} from '../../../domain/personnel/squad-formation-service.ts';
import type { FormSquadRequest } from './form-squad.request.ts';
export type FormSquadContext = Readonly<{
  squads: readonly Squad[];
  target: Squad;
  candidates: readonly SquadMemberAvailability[];
}>;
export interface FormSquadRepository {
  load(request: FormSquadRequest): FormSquadContext;
  commit(formation: SquadFormation): void;
}
