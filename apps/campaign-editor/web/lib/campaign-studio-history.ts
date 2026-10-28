import { CampaignProject } from '../../domain/campaign-project.ts';
import {
  CampaignProjectHistory,
  type CampaignProjectHistorySnapshot,
} from '../../domain/campaign-project-history.ts';
import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';

export type StudioHistory = CampaignProjectHistorySnapshot;
export const emptyStudioHistory = (): StudioHistory => new CampaignProjectHistory().snapshot();

export function changeStudioProject(
  snapshot: StudioHistory,
  document: CampaignProjectDocument,
): StudioHistory {
  if (snapshot.current === document) return snapshot;
  const history = CampaignProjectHistory.restore(snapshot);
  history.record(new CampaignProject(document));
  return history.snapshot();
}

export function undoStudioProject(snapshot: StudioHistory): StudioHistory {
  const history = CampaignProjectHistory.restore(snapshot);
  history.undo();
  return history.snapshot();
}

export function redoStudioProject(snapshot: StudioHistory): StudioHistory {
  const history = CampaignProjectHistory.restore(snapshot);
  history.redo();
  return history.snapshot();
}
