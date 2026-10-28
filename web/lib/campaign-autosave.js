import { domainRefusalMessage } from '../../game/infrastructure/shared/domain-refusal-message.js';
import { DomainRefusal, DomainRefusalCode } from '../../game/domain/shared/domain-refusal.ts';
import { SaveGameUseCase } from '../../game/application/save-game/save-game.use-case.ts';
import { GetSaveStatusUseCase } from '../../game/application/get-save-status/get-save-status.use-case.ts';
import { SaveStatusRepository } from '../../game/infrastructure/persistence/save-status-repository.ts';
import { createGameSessionId } from '../../game/infrastructure/persistence/game-session-id.js';

function sameRequest(left, right) {
  return (
    left?.sessionId === right?.sessionId &&
    left?.revision === right?.revision &&
    left?.requestId === right?.requestId
  );
}

class AutosaveRepository {
  #latest;
  #snapshot;
  #text;
  #encode;
  #write;

  constructor(latest, snapshot, text, encode, write) {
    this.#latest = latest;
    this.#snapshot = snapshot;
    this.#text = text;
    this.#encode = encode;
    this.#write = write;
  }

  current() {
    return this.#latest();
  }
  serialize() {
    return this.#text ?? this.#encode(this.#snapshot.campaign, this.#snapshot.battle);
  }
  persist(text, identity) {
    if (!sameRequest(identity, this.current()))
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    this.#write(text, this.#snapshot.key);
  }
}

export function createCampaignAutosave({
  worker,
  encode,
  write,
  writer,
  onSaved = () => {},
  onError = (_error) => {},
  onStatus = (_status) => {},
}) {
  let latest = null;
  let inFlight = null;
  let sequence = 0;
  let closed = false;
  const queueId = createGameSessionId();
  const status = new SaveStatusRepository();
  const statusQuery = new GetSaveStatusUseCase(status);
  const notify = () => onStatus(statusQuery.execute());
  const saved = () => sameRequest(latest, statusQuery.execute().persisted);
  const failProgress = (error) => {
    status.fail(domainRefusalMessage(error));
    notify();
    onError(error);
  };
  const persist = (snapshot, text) => {
    if (closed || !sameRequest(snapshot, latest) || saved()) return;
    try {
      const repository = new AutosaveRepository(
        () => latest,
        snapshot,
        text,
        encode,
        (value, key) => (writer ? writer.write(key, value) : write(value, key)),
      );
      new SaveGameUseCase(repository).execute(snapshot);
      status.saved(snapshot);
      notify();
      onSaved();
    } catch (error) {
      failProgress(error);
    }
  };
  const fallback = (snapshot) => persist(snapshot, undefined);
  const failedWorker = () => {
    if (closed) return;
    worker?.terminate();
    worker = null;
    inFlight = null;
    if (latest && !saved() && (!writer || writer.owns(latest.key))) fallback(latest);
  };
  const pump = () => {
    if (closed || !latest || saved()) return;
    if (writer && !writer.owns(latest.key)) {
      writer.claim(latest.key, pump, (message) => {
        status.refuse(message);
        notify();
        onError(new Error(message));
      });
      return;
    }
    if (inFlight) return;
    const snapshot = latest;
    status.saving();
    notify();
    if (!worker) {
      fallback(snapshot);
      return;
    }
    inFlight = snapshot;
    try {
      worker.postMessage(snapshot);
    } catch {
      failedWorker();
    }
  };
  if (worker) {
    worker.onmessage = ({ data }) => {
      if (closed || !sameRequest(data, inFlight)) return;
      const snapshot = inFlight;
      inFlight = null;
      if (data.error) {
        if (sameRequest(snapshot, latest)) failProgress(new Error(data.error));
        else pump();
        return;
      }
      persist(snapshot, data.text);
      if (!sameRequest(snapshot, latest)) pump();
    };
    worker.onerror = failedWorker;
    worker.onmessageerror = failedWorker;
  }
  return {
    submit(campaign, battle, key) {
      if (closed || !campaign) return;
      const identity = {
        sessionId: campaign.gameSessionId ?? queueId,
        revision: campaign.gameRevision ?? 0,
        requestId: `${queueId}:${++sequence}`,
      };
      latest = { ...identity, id: sequence, campaign, battle, key };
      status.accept(identity);
      notify();
      pump();
    },
    flush() {
      if (!closed && latest && !saved()) {
        if (!writer || writer.owns(latest.key)) fallback(latest);
        else pump();
      }
    },
    status() {
      return statusQuery.execute();
    },
    close() {
      if (closed) return;
      closed = true;
      worker?.terminate();
      worker = null;
      inFlight = null;
      writer?.close();
    },
  };
}
