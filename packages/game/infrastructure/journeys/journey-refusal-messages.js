import { JourneyRefusalCode } from '../../domain/journeys/arrival-decision.ts';

const messages = Object.freeze({
  [JourneyRefusalCode.ArrivalDecisionAlreadyResolved]: 'La decisión de llegada ya está resuelta.',
  [JourneyRefusalCode.ArrivalDecisionMismatch]:
    'La orden no corresponde a la decisión de llegada actual.',
  [JourneyRefusalCode.ArrivalDecisionNotPending]:
    'La escuadra no tiene una decisión de llegada pendiente.',
  [JourneyRefusalCode.HostileRedirectionOutsideCurrentSegment]:
    'El destino hostil debe ser el sector de esta aproximación.',
  [JourneyRefusalCode.JourneyDestinationNotFound]: 'El destino no existe.',
  [JourneyRefusalCode.JourneyNotFound]: 'La escuadra no tiene un viaje pendiente.',
  [JourneyRefusalCode.JourneyNotPaused]: 'El viaje no está detenido.',
  [JourneyRefusalCode.JourneyNotTravelling]:
    'La escuadra debe estar viajando para cambiar su destino.',
  [JourneyRefusalCode.JourneyRevisionConflict]:
    'El viaje cambió. Volvé a dar la orden desde su posición actual.',
  [JourneyRefusalCode.JourneyRouteUnavailable]: 'No hay una ruta legal desde la posición actual.',
  [JourneyRefusalCode.TooManyJourneyWaypoints]: 'Elegí hasta ocho escalas.',
  [JourneyRefusalCode.RedirectionMustStartAtCurrentSegment]:
    'La ruta debe partir de la posición actual de la escuadra.',
});

export function journeyRefusalMessage(error) {
  if (error?.name !== 'JourneyRefusal') {
    return error?.message ?? String(error);
  }
  return messages[error.code] ?? 'El estado del viaje es inválido.';
}

export function executeJourneyCommand(execute) {
  try {
    return execute();
  } catch (error) {
    if (error?.name === 'JourneyRefusal') {
      error.message = journeyRefusalMessage(error);
    }
    throw error;
  }
}
