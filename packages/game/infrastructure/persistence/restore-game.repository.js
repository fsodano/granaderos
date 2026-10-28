import { GameSnapshotMapper } from './game-snapshot-mapper.js';

export class SerializedRestoreGameRepository {
  #text;
  #mapper;

  constructor(text, mapper = new GameSnapshotMapper()) {
    this.#text = text;
    this.#mapper = mapper;
  }
  read() {
    return this.#text;
  }
  restore(text) {
    return this.#mapper.restore(text);
  }
}
