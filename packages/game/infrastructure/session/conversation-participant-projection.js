import { applyQuestEscortOrders } from '../../quest-escort.js';
import { applyQuestWithdrawalOrders } from '../../quest-withdrawal.js';
import { projectDialogueMovements } from '../../dialogue-movement.js';
import { createBattle } from '../../tactical.js';
import { addIssuedGriefParticipant } from '../../companion-grief.js';
import { addIssuedConductObserver } from '../../service-objections.js';

const LOCAL_PARTICIPANT_FIELDS = Object.freeze(['x', 'y', 'tacticalLevel', 'facing', 'stance']);

export class ConversationParticipantProjection {
  apply(campaign, sectorSession, characterId) {
    const projected = applyQuestWithdrawalOrders(
      campaign,
      projectDialogueMovements(campaign, applyQuestEscortOrders(campaign, sectorSession)),
    );
    if (campaign.lastConversation?.outcome !== 'recruited') return projected;

    const combatantId = campaign.lastConversation.operativeId;
    const resident = sectorSession.npcs.find((person) => person.id === characterId);
    const authorizedCharacter = campaign.pendingBattle?.squad.find(
      (person) => person.id === combatantId,
    );
    if (!resident || !campaign.recruited.includes(combatantId))
      throw new Error('El reclutamiento perdió al personaje presente.');

    const result = structuredClone(projected);
    result.npcs = result.npcs.filter((person) => person.id !== characterId);
    if (!authorizedCharacter) return result;
    if (result.units.some((participant) => Number(participant.id) === combatantId)) return result;

    const compiled = createBattle([authorizedCharacter], {
      width: sectorSession.width,
      height: sectorSession.height,
      enemies: [],
      exploration: true,
    }).units.find((participant) => participant.side === 'player');
    if (!compiled) throw new Error('No se pudo incorporar al combatiente reclutado.');

    const participant = { ...compiled };
    for (const field of LOCAL_PARTICIPANT_FIELDS) {
      if (resident[field] !== undefined) participant[field] = resident[field];
    }
    result.units.push(participant);
    addIssuedGriefParticipant(result, participant);
    addIssuedConductObserver(result, participant);
    return result;
  }
}
