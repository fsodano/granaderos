import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import { CampaignProject, type CampaignProjectDocument } from './campaign-project.ts';

const DEFAULT_HISTORY_LIMIT = 50;
export type CampaignProjectHistorySnapshot = {
  past: CampaignProjectDocument[];
  current: CampaignProjectDocument | null;
  future: CampaignProjectDocument[];
};

export class CampaignProjectHistory {
  #past: CampaignProjectDocument[] = [];
  #current: CampaignProjectDocument | null = null;
  #future: CampaignProjectDocument[] = [];
  #limit: number;

  constructor(limit = DEFAULT_HISTORY_LIMIT) {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidHistoryCapacity);
    this.#limit = limit;
  }

  static restore(snapshot: CampaignProjectHistorySnapshot): CampaignProjectHistory {
    const history = new CampaignProjectHistory();
    history.#past = snapshot.past
      .map((document) => new CampaignProject(document).snapshot())
      .slice(-history.#limit);
    history.#current = snapshot.current ? new CampaignProject(snapshot.current).snapshot() : null;
    history.#future = snapshot.future
      .map((document) => new CampaignProject(document).snapshot())
      .slice(0, history.#limit);
    return history;
  }

  snapshot(): CampaignProjectHistorySnapshot {
    return structuredClone({ past: this.#past, current: this.#current, future: this.#future });
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get canRedo(): boolean {
    return this.#future.length > 0;
  }
  current(): CampaignProject | null {
    return this.#current ? new CampaignProject(this.#current) : null;
  }

  record(project: CampaignProject): void {
    if (this.#current) this.#past = [...this.#past, this.#current].slice(-this.#limit);
    this.#current = project.snapshot();
    this.#future = [];
  }

  undo(): CampaignProject | null {
    if (this.#current && this.canUndo) {
      this.#future = [this.#current, ...this.#future].slice(0, this.#limit);
      this.#current = this.#past.pop()!;
    }
    return this.current();
  }

  redo(): CampaignProject | null {
    if (this.#current && this.canRedo) {
      this.#past = [...this.#past, this.#current].slice(-this.#limit);
      this.#current = this.#future.shift()!;
    }
    return this.current();
  }
}
