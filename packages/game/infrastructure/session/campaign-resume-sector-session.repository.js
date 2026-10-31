import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import {
  restoreGameSession,
  sectorSessionRegistration,
  projectGameSession,
} from './campaign-game-session-mapper.js';
import { CampaignSectorSessionCoordinator } from './campaign-sector-session-coordinator.js';

export class CampaignResumeSectorSessionRepository {
  #transaction;
  #activeSnapshot;
  #game = null;
  #targetId = null;
  #closed = false;

  constructor(transaction, activeSnapshot = null) {
    this.#transaction = transaction;
    this.#activeSnapshot = activeSnapshot;
  }

  load(sectorSessionId) {
    if (this.#closed || this.#game) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    const campaign = this.#transaction.draft;
    const target = campaign.suspendedSectorSessions?.find(
      (record) => record.request.id === sectorSessionId,
    );
    if (!target) {
      throw new Error('La visita suspendida no existe.');
    }
    this.#game = restoreGameSession(campaign);
    this.#targetId = sectorSessionId;
    return { game: this.#game, registration: sectorSessionRegistration(target.request) };
  }

  commit(game) {
    if (this.#closed || game !== this.#game || !this.#targetId) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    const campaign = this.#transaction.draft;
    const coordinator = new CampaignSectorSessionCoordinator(campaign);
    if (campaign.pendingBattle) {
      coordinator.suspendActive(this.#activeSnapshot);
    }
    coordinator.resume(this.#targetId);
    projectGameSession(campaign, game);
    this.#closed = true;
  }
}
