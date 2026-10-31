import type { CampaignSnapshot } from '../../public/campaign-types.ts';
import type { BattleSnapshot } from '../../public/compatibility-types.ts';
import { applyQuestEscortOrders } from '../../quest-escort.js';
import { applyQuestWithdrawalOrders } from '../../quest-withdrawal.js';
import { projectDialogueMovements } from '../../dialogue-movement.js';
import { createBattle } from '../../tactical.js';
import { addIssuedGriefParticipant } from '../../companion-grief.js';
import { addIssuedConductObserver } from '../../service-objections.js';

export class ConversationParticipantProjection {
  apply(
    campaign: CampaignSnapshot,
    sectorSession: BattleSnapshot,
    characterId: string,
  ): BattleSnapshot {
    const projected = applyQuestWithdrawalOrders(
      campaign,
      projectDialogueMovements(campaign, applyQuestEscortOrders(campaign, sectorSession)),
    );
    if (campaign.lastConversation?.outcome !== 'recruited') {
      return projected;
    }

    const combatantId = campaign.lastConversation.operativeId;
    const resident = sectorSession.npcs.find((person) => person.id === characterId);
    const authorizedCharacter = campaign.pendingBattle?.squad.find(
      (person) => person.id === combatantId,
    );
    if (!resident || combatantId === undefined || !campaign.recruited.includes(combatantId)) {
      throw new Error('El reclutamiento perdió al personaje presente.');
    }

    const result = structuredClone(projected);
    result.npcs = result.npcs.filter((person) => person.id !== characterId);
    if (!authorizedCharacter) {
      return result;
    }
    if (result.units.some((participant) => Number(participant.id) === combatantId)) {
      return result;
    }

    const compiled = createBattle([authorizedCharacter], {
      width: sectorSession.width,
      height: sectorSession.height,
      enemies: [],
      exploration: true,
    }).units.find((participant) => participant.side === 'player');
    if (!compiled) {
      throw new Error('No se pudo incorporar al combatiente reclutado.');
    }

    const participant = {
      ...compiled,
      x: resident.x,
      y: resident.y,
      ...(resident.tacticalLevel !== undefined ? { tacticalLevel: resident.tacticalLevel } : {}),
      ...(resident.facing !== undefined ? { facing: resident.facing } : {}),
      ...(resident.stance !== undefined ? { stance: resident.stance } : {}),
    };
    result.units.push(participant);
    addIssuedGriefParticipant(result, participant);
    addIssuedConductObserver(result, participant);
    return result;
  }
}
