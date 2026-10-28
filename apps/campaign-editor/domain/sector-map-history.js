import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
const HISTORY_CAPACITY = 100;

export class SectorMapHistory {
  #document;
  #past;
  #future;

  constructor({ document, past = [], future = [] }) {
    this.#document = structuredClone(document);
    this.#past = structuredClone(past).slice(-HISTORY_CAPACITY);
    this.#future = structuredClone(future).slice(0, HISTORY_CAPACITY);
  }

  snapshot() {
    return structuredClone({
      document: this.#document,
      past: this.#past,
      future: this.#future,
      errors: [],
    });
  }

  accept(document, expectedRevision) {
    if (
      this.#document.revision !== expectedRevision ||
      document.id !== this.#document.id ||
      document.revision !== expectedRevision + 1
    )
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.StaleMapRevision);
    this.#past = [...this.#past, this.#document].slice(-HISTORY_CAPACITY);
    this.#document = structuredClone(document);
    this.#future = [];
  }

  undo() {
    if (!this.#past.length) return;
    this.#future = [this.#document, ...this.#future].slice(0, HISTORY_CAPACITY);
    this.#document = { ...this.#past.pop(), revision: this.#document.revision + 1 };
  }

  redo() {
    if (!this.#future.length) return;
    this.#past = [...this.#past, this.#document].slice(-HISTORY_CAPACITY);
    this.#document = { ...this.#future.shift(), revision: this.#document.revision + 1 };
  }
}
