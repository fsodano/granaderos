import { CampaignRuleRefusal } from './campaign-rule-refusal.ts';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';

export function domainRefusalMessage(error) {
  if (error instanceof CampaignRuleRefusal) return error.messageForPlayer();
  if (!(error instanceof DomainRefusal))
    return error instanceof Error ? error.message : String(error);
  const messages = {
    [DomainRefusalCode.ServiceTermsUnavailable]: 'Los términos de servicio no están disponibles.',
    [DomainRefusalCode.ConversationUnavailable]: 'No se puede conversar en este momento.',
    [DomainRefusalCode.SavedGameUnavailable]: 'No hay una partida guardada para recuperar.',
    [DomainRefusalCode.InvalidGameSeed]: 'La semilla de la campaña no es válida.',
    [DomainRefusalCode.InvalidSquadName]:
      'Escribí un nombre de escuadra de entre 2 y 30 caracteres.',
    [DomainRefusalCode.InvalidSquadMembers]: 'Seleccioná entre uno y seis combatientes distintos.',
    [DomainRefusalCode.SquadUnavailable]:
      'La escuadra tiene un viaje o una visita de sector pendiente.',
    [DomainRefusalCode.SquadLocationMismatch]:
      'Los combatientes deben reunirse en el mismo sector.',
    [DomainRefusalCode.TooManySquads]: 'El ejército ya tiene ocho escuadras ocupadas.',
    [DomainRefusalCode.NotServing]: 'El personaje no tiene un contrato de servicio.',
    [DomainRefusalCode.PermanentService]: 'El servicio permanente no necesita renovación.',
    [DomainRefusalCode.ContractChanged]:
      'El contrato cambió. Revisá los términos antes de renovar.',
    [DomainRefusalCode.DuplicateSectorParticipation]:
      'El personaje ya participa en otro sector activo.',
    [DomainRefusalCode.InsufficientFunds]: 'No hay suficientes pesos en la tesorería.',
    [DomainRefusalCode.CharacterUnavailable]: 'El combatiente no está disponible.',
    [DomainRefusalCode.AlreadyServing]: 'El combatiente ya se encuentra en tus filas.',
    [DomainRefusalCode.InvalidPlacement]: 'Elegí un destino de reclutamiento seguro.',
    [DomainRefusalCode.CandidateIneligible]: 'El personaje no puede ser reclutado.',
    [DomainRefusalCode.RevisionConflict]: 'La partida cambió. Revisá la orden antes de repetirla.',
    [DomainRefusalCode.TransactionClosed]: 'La orden ya fue resuelta.',
    [DomainRefusalCode.InvalidValue]: 'Los datos de la orden no son válidos.',
  };
  return messages[error.code];
}
