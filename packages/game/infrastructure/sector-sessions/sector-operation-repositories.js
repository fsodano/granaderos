import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { nextRevision } from '../shared/revision.js';

export class SectorOperationTransaction {
  #revision;
  #snapshot;
  constructor(snapshot) {
    this.#snapshot = snapshot;
    this.#revision = snapshot.sectorRevision ?? 0;
  }
  load() {
    nextRevision(this.#revision);
    return { snapshot: structuredClone(this.#snapshot), revision: this.#revision };
  }
  commit(snapshot, expectedRevision) {
    if (this.#revision !== expectedRevision) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    const acceptedRevision = nextRevision(this.#revision);
    if (snapshot.lastError) {
      return;
    }
    const gameplay = (value) =>
      JSON.stringify(value, (key, field) => (key === 'lastError' ? undefined : field));
    if (gameplay(snapshot) === gameplay(this.#snapshot)) {
      return;
    }
    this.#revision = acceptedRevision;
    snapshot.sectorRevision = this.#revision;
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
