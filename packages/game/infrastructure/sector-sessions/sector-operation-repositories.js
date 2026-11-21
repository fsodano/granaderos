import {
  advanceRevision,
  assertExpectedRevision,
  readRevision,
  sectorRevisionDomain,
} from '../shared/revision-policy.ts';

export class SectorOperationTransaction {
  #revision;
  #snapshot;
  constructor(snapshot) {
    this.#snapshot = snapshot;
    this.#revision = readRevision(sectorRevisionDomain, snapshot);
  }
  load() {
    advanceRevision(this.#revision);
    return { snapshot: structuredClone(this.#snapshot), revision: this.#revision };
  }
  commit(snapshot, expectedRevision) {
    assertExpectedRevision(this.#revision, expectedRevision);
    const acceptedRevision = advanceRevision(this.#revision);
    if (snapshot.lastError) {
      return;
    }
    const gameplay = (value) =>
      JSON.stringify(value, (key, field) => (key === 'lastError' ? undefined : field));
    if (gameplay(snapshot) === gameplay(this.#snapshot)) {
      return;
    }
    this.#revision = acceptedRevision;
    sectorRevisionDomain.write(snapshot, acceptedRevision);
    this.#snapshot = snapshot;
  }
}
export class SnapshotExecuteSectorOrderRepository {
  #transaction;
  constructor(transaction) {
    this.#transaction = transaction;
  }
  loadSectorOrder() {
    return this.#transaction.load();
  }
  commitSectorOrder(snapshot, expectedRevision) {
    this.#transaction.commit(snapshot, expectedRevision);
  }
}
export class SnapshotEndSectorTurnRepository {
  #transaction;
  constructor(transaction) {
    this.#transaction = transaction;
  }
  loadSectorTurn() {
    return this.#transaction.load();
  }
  commitSectorTurn(snapshot, expectedRevision) {
    this.#transaction.commit(snapshot, expectedRevision);
  }
}

export class SnapshotResumeSectorOperationRepository {
  #transaction;
  constructor(transaction) {
    this.#transaction = transaction;
  }
  loadSectorOperation() {
    return this.#transaction.load();
  }
  commitSectorOperation(snapshot, expectedRevision) {
    this.#transaction.commit(snapshot, expectedRevision);
  }
}
