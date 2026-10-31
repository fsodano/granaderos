import type { CampaignSnapshot } from '../../public/campaign-types.ts';
import type { BattleSnapshot } from '../../public/compatibility-types.ts';
import type { TalkToCharacterRequest } from '../../application/talk-to-character/talk-to-character.request.ts';
import type { TalkToCharacterRepository } from '../../application/talk-to-character/talk-to-character.repository.ts';
import type { TalkToCharacterResponse } from '../../application/talk-to-character/talk-to-character.response.ts';
type ParticipantProjection = {
  apply(campaign: CampaignSnapshot, session: BattleSnapshot, characterId: string): BattleSnapshot;
};
import { CampaignRuleRefusal } from '../shared/campaign-rule-refusal.ts';
import { dispatchCampaign } from '../../campaign.js';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { ConversationParticipantProjection } from './conversation-participant-projection.ts';

export class CampaignTalkToCharacterRepository implements TalkToCharacterRepository<
  CampaignSnapshot,
  BattleSnapshot
> {
  #sourceCampaign: CampaignSnapshot | null;
  #sourceSession: BattleSnapshot | null;
  #revision: number;
  #request: TalkToCharacterRequest | null = null;
  #campaign: CampaignSnapshot | null = null;
  #sectorSession: BattleSnapshot | null = null;
  #closed = false;
  #projection: ParticipantProjection;

  constructor(
    campaign: CampaignSnapshot | null,
    sectorSession: BattleSnapshot | null,
    projection: ParticipantProjection = new ConversationParticipantProjection(),
  ) {
    this.#sourceCampaign = campaign;
    this.#sourceSession = sectorSession;
    this.#revision = campaign?.gameRevision ?? 0;
    this.#projection = projection;
  }

  resolve(request: TalkToCharacterRequest): void {
    this.#assertOpen();
    if (this.#request) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    if (!this.#sourceCampaign || !this.#sourceSession) {
      throw new CampaignRuleRefusal(
        DomainRefusalCode.ConversationUnavailable,
        'Primero entrá al sector para conversar.',
      );
    }
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
        ? {
            dialogueChoice: request.dialogueChoiceId,
            ...(request.dialogueNodeId ? { dialogueNode: request.dialogueNodeId } : {}),
          }
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

  projectParticipants(): void {
    this.#assertOpen();
    if (!this.#campaign || !this.#request || this.#sectorSession || !this.#sourceSession) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
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

  commit(): TalkToCharacterResponse<CampaignSnapshot, BattleSnapshot> {
    this.#assertOpen();
    if (!this.#campaign || !this.#sectorSession) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    this.#closed = true;
    if ((this.#sourceCampaign?.gameRevision ?? 0) !== this.#revision) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    return { campaign: this.#campaign, sectorSession: this.#sectorSession };
  }

  #assertOpen() {
    if (this.#closed) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
  }
}
