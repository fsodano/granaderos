import { operativeLocation } from './squads.js';
import { worldOwner } from './world-cells.ts';
import { hasWorkshop } from './campaign-headquarters.js';

export function workshopAccessReason(s, op, supplied) {
  if (s.defeated) {
    return 'La campaña ha terminado.';
  }
  if (s.sectorEntryRequest) {
    return 'Resolvé la escena táctica antes de usar el taller.';
  }
  if (
    !op ||
    !s.forceRoster.includes(op.id) ||
    !s.characters[op.id]?.alive ||
    s.characters[op.id].captured
  ) {
    return 'El combatiente no está disponible.';
  }
  if (operativeLocation(s, op.id) !== s.location) {
    return 'El combatiente debe estar en el mismo taller que la escuadra seleccionada.';
  }
  if (!hasWorkshop(s, s.location) || worldOwner(s, s.location) !== 'patriot' || !supplied) {
    return 'Debes llegar a un taller bajo tu control y comunicado con el cuartel general.';
  }
  return '';
}
