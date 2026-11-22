import type { SaveStatus } from './get-save-status.response.ts';

export interface GetSaveStatusRepository {
  read(): SaveStatus;
}
