import type { SleepingCombatant } from '../../../packages/game/domain/personnel/sleep-need.ts';
import { sleepRecovery } from '../../../packages/game/public/game-runtime-api.ts';

export function sleepNeedStatus(unit: SleepingCombatant): string {
  const rate = sleepRecovery(unit);
  return `Necesidad de sueño: ${rate.hours} h de referencia · base ${rate.base}${rate.wounds ? ` + ${rate.wounds} por heridas` : ''}${rate.nightTraining ? ' − 1 por entrenamiento nocturno' : ''}. Descanso: +${rate.energy} energía/h · −${rate.fatigue} fatiga/h.`;
}
