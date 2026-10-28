import { CampaignRuleRefusal } from '../shared/campaign-rule-refusal.ts';
import { dispatchCampaign } from '../../campaign.js';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { ConversationParticipantProjection } from './conversation-participant-projection.js';

export class CampaignTalkToCharacterRepository {
  #sourceCampaign;
  #sourceSession;
  #revision;
  #request = null;
  #campaign = null;
  #sectorSession = null;
  #closed = false;
  #projection;

  constructor(campaign, sectorSession, projection = new ConversationParticipantProjection()) {
    this.#sourceCampaign = campaign;
    this.#sourceSession = sectorSession;
    this.#revision = campaign?.gameRevision ?? 0;
    this.#projection = projection;
  }

  resolve(request) {
    this.#assertOpen();
    if (this.#request) throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    if (!this.#sourceCampaign || !this.#sourceSession)
      throw new CampaignRuleRefusal(
        DomainRefusalCode.ConversationUnavailable,
        'Primero entrá al sector para conversar.',
      );
    if ((request.expectedRevision ?? this.#revision) !== this.#revision) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    const campaign = dispatchCampaign(this.#sourceCampaign, {
      type: 'talkNPC',
      npcId: request.characterId,
      unitId: request.speakerId,
      approach: request.approach,
      ...(request.serviceTerm ? { term: request.serviceTerm } : {}),
      ...(request.dialogueChoiceId
        ? { dialogueChoice: request.dialogueChoiceId, dialogueNode: request.dialogueNodeId }
        : {}),
      ...(request.questResolution
        ? {
            questResolution:
              request.questResolution === 'recruit' ? 'civic' : request.questResolution,
          }
        : {}),
      ...(request.questWithdrawal ? { questWithdrawal: request.questWithdrawal } : {}),
      sectorState: this.#sourceSession,
    });
    if (campaign.lastError) {
      this.#closed = true;
      throw new CampaignRuleRefusal(DomainRefusalCode.ConversationUnavailable, campaign.lastError);
    }
    this.#campaign = campaign;
    this.#request = request;
  }

  projectParticipants() {
    this.#assertOpen();
    if (!this.#campaign || !this.#request || this.#sectorSession)
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    try {
      this.#sectorSession = this.#projection.apply(
        this.#campaign,
        this.#sourceSession,
        this.#request.characterId,
      );
    } catch (error) {
      this.#closed = true;
      throw error;
    }
  }

  commit() {
    this.#assertOpen();
    if (!this.#campaign || !this.#sectorSession)
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    this.#closed = true;
    if ((this.#sourceCampaign.gameRevision ?? 0) !== this.#revision)
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    return { campaign: this.#campaign, sectorSession: this.#sectorSession };
  }

  #assertOpen() {
    if (this.#closed) throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
  }
}
