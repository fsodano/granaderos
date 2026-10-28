import { initialCampaign } from '../../campaign.js';
import { GameSession } from '../../domain/session/game-session.ts';
import { createGameSessionId } from './game-session-id.js';

export class CampaignCreateGameSessionRepository {
  #newSessionId;

  constructor(newSessionId = createGameSessionId) {
    this.#newSessionId = newSessionId;
  }

  create({ seed, definition }) {
    const campaign = initialCampaign(seed, definition);
    const session = GameSession.create(this.#newSessionId());
    campaign.gameSessionId = session.id;
    campaign.gameRevision = session.revision;
    return campaign;
  }
}
