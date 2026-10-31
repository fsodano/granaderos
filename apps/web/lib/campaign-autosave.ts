import { domainRefusalMessage } from '../../../packages/game/infrastructure/shared/domain-refusal-message.js';
import {
  DomainRefusal,
  DomainRefusalCode,
} from '../../../packages/game/domain/shared/domain-refusal.ts';
import { SaveGameUseCase } from '../../../packages/game/application/save-game/save-game.use-case.ts';
import { GetSaveStatusUseCase } from '../../../packages/game/application/get-save-status/get-save-status.use-case.ts';
import { SaveStatusRepository } from '../../../packages/game/infrastructure/persistence/save-status-repository.ts';
import { createGameSessionId } from '../../../packages/game/infrastructure/persistence/game-session-id.js';
import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import type {
  GameSaveIdentity,
  SaveGameRepository,
} from '../../../packages/game/application/save-game/save-game.repository.ts';
import type { SaveStatus } from '../../../packages/game/application/get-save-status/get-save-status.repository.ts';
import type { CampaignSaveRequest } from './campaign-save-values.ts';
import type { BrowserSaveWriter } from './browser-save-writer.ts';

export type QueuedCampaignSave = CampaignSaveRequest & { key: string };
export interface CampaignSaveWorker {
  postMessage(request: QueuedCampaignSave): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
}
type EncodeCampaignSave = (campaign: CampaignSnapshot, battle: BattleSnapshot | null) => string;
type WriteCampaignSave = (text: string, key: string) => void;
type SaveWriter = Pick<BrowserSaveWriter, 'write' | 'owns' | 'claim' | 'close'>;
export type CampaignAutosaveOptions = {
  worker?: CampaignSaveWorker | null;
  encode: EncodeCampaignSave;
  onSaved?: () => void;
  onError?: (error: Error) => void;
  onStatus?: (status: SaveStatus) => void;
} & ({ writer: SaveWriter; write?: never } | { writer?: never; write: WriteCampaignSave });
export interface CampaignAutosave {
  submit(campaign: CampaignSnapshot | null, battle: BattleSnapshot | null, key: string): void;
  flush(): void;
  status(): SaveStatus;
  close(): void;
}
function replyRecord(
  value: unknown,
): value is GameSaveIdentity & { text?: unknown; error?: unknown } {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return (
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'revision' in value &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    'requestId' in value &&
    typeof value.requestId === 'string'
  );
}

function writeSavedText(options: CampaignAutosaveOptions, text: string, key: string): void {
  if (options.writer) {
    options.writer.write(key, text);
  } else {
    options.write(text, key);
  }
}

function sameRequest(left: GameSaveIdentity | null, right: GameSaveIdentity | null) {
  return (
    left?.sessionId === right?.sessionId &&
    left?.revision === right?.revision &&
    left?.requestId === right?.requestId
  );
}

class AutosaveRepository implements SaveGameRepository {
  readonly #latest: () => QueuedCampaignSave | null;
  readonly #snapshot: QueuedCampaignSave;
  readonly #text: string | undefined;
  readonly #encode: EncodeCampaignSave;
  readonly #write: WriteCampaignSave;

  constructor(
    latest: () => QueuedCampaignSave | null,
    snapshot: QueuedCampaignSave,
    text: string | undefined,
    encode: EncodeCampaignSave,
    write: WriteCampaignSave,
  ) {
    this.#latest = latest;
    this.#snapshot = snapshot;
    this.#text = text;
    this.#encode = encode;
    this.#write = write;
  }

  current() {
    const current = this.#latest();
    if (!current) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    return current;
  }
  serialize() {
    return this.#text ?? this.#encode(this.#snapshot.campaign, this.#snapshot.battle);
  }
  persist(text: string, identity: GameSaveIdentity) {
    if (!sameRequest(identity, this.current())) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    this.#write(text, this.#snapshot.key);
  }
}

export function createCampaignAutosave(options: CampaignAutosaveOptions): CampaignAutosave {
  let worker = options.worker;
  const {
    encode,
    writer,
    onSaved = () => {},
    onError = (_error) => {},
    onStatus = (_status) => {},
  } = options;
  let latest: QueuedCampaignSave | null = null;
  let inFlight: QueuedCampaignSave | null = null;
  let sequence = 0;
  let closed = false;
  const queueId = createGameSessionId();
  const status = new SaveStatusRepository();
  const statusQuery = new GetSaveStatusUseCase(status);
  const notify = () => onStatus(statusQuery.execute());
  const saved = () => sameRequest(latest, statusQuery.execute().persisted);
  const failProgress = (cause: unknown) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    status.fail(domainRefusalMessage(error));
    notify();
    onError(error);
  };
  const persist = (snapshot: QueuedCampaignSave, text: string | undefined) => {
    if (closed || !sameRequest(snapshot, latest) || saved()) {
      return;
    }
    try {
      const repository = new AutosaveRepository(
        () => latest,
        snapshot,
        text,
        encode,
        (value, key) => writeSavedText(options, value, key),
      );
      new SaveGameUseCase(repository).execute(snapshot);
      status.saved(snapshot);
      notify();
      onSaved();
    } catch (error) {
      failProgress(error);
    }
  };
  const fallback = (snapshot: QueuedCampaignSave) => persist(snapshot, undefined);
  const failedWorker = () => {
    if (closed) {
      return;
    }
    worker?.terminate();
    worker = null;
    inFlight = null;
    if (latest && !saved() && (!writer || writer.owns(latest.key))) {
      fallback(latest);
    }
  };
  const pump = () => {
    if (closed || !latest || saved()) {
      return;
    }
    if (writer && !writer.owns(latest.key)) {
      writer.claim(latest.key, pump, (message) => {
        status.refuse(message);
        notify();
        onError(new Error(message));
      });
      return;
    }
    if (inFlight) {
      return;
    }
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
      if (closed || !inFlight || !replyRecord(data) || !sameRequest(data, inFlight)) {
        return;
      }
      const snapshot = inFlight;
      inFlight = null;
      if (typeof data.error === 'string') {
        if (sameRequest(snapshot, latest)) {
          failProgress(new Error(data.error));
        } else {
          pump();
        }
        return;
      }
      if (typeof data.text !== 'string') {
        failedWorker();
        return;
      }
      persist(snapshot, data.text);
      if (!sameRequest(snapshot, latest)) {
        pump();
      }
    };
    worker.onerror = failedWorker;
    worker.onmessageerror = failedWorker;
  }
  return {
    submit(campaign, battle, key) {
      if (closed || !campaign) {
        return;
      }
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
        if (!writer || writer.owns(latest.key)) {
          fallback(latest);
        } else {
          pump();
        }
      }
    },
    status() {
      return statusQuery.execute();
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      worker?.terminate();
      worker = null;
      inFlight = null;
      writer?.close();
    },
  };
}
