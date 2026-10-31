import type {
  SaveStatus,
  SaveState,
  GetSaveStatusRepository,
} from '../../application/get-save-status/get-save-status.repository.ts';
import type { GameSaveIdentity } from '../../application/save-game/save-game.repository.ts';

export class SaveStatusRepository implements GetSaveStatusRepository {
  #state: SaveState = 'unsaved';
  #accepted: GameSaveIdentity | null = null;
  #persisted: GameSaveIdentity | null = null;
  #message: string | null = null;

  accept(identity: GameSaveIdentity): void {
    this.#accepted = {
      sessionId: identity.sessionId,
      revision: identity.revision,
      requestId: identity.requestId,
    };
    this.#state = 'unsaved';
    this.#message = null;
  }

  saving(): void {
    this.#state = 'saving';
    this.#message = null;
  }

  saved(identity: GameSaveIdentity): void {
    if (
      identity.requestId !== this.#accepted?.requestId ||
      identity.sessionId !== this.#accepted.sessionId ||
      identity.revision !== this.#accepted.revision
    ) {
      throw new Error('La respuesta de guardado ya no corresponde a la partida.');
    }
    this.#persisted = {
      sessionId: identity.sessionId,
      revision: identity.revision,
      requestId: identity.requestId,
    };
    this.#state = 'saved';
    this.#message = null;
  }

  refuse(message: string): void {
    this.#state = 'blocked';
    this.#message = message;
  }
  fail(message: string): void {
    this.#state = 'failed';
    this.#message = message;
  }

  read(): SaveStatus {
    return {
      state: this.#state,
      accepted: this.#accepted ? { ...this.#accepted } : null,
      persisted: this.#persisted ? { ...this.#persisted } : null,
      message: this.#message,
    };
  }
}
