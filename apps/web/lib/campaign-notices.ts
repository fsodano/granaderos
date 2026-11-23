import type { CampaignSnapshot } from '../../../packages/game/public/campaign-types.ts';
import { hasPendingArrivalDecision } from '../../../packages/game/public/game-runtime-api.ts';

const changed = <Value>(before: Value, after: Value) =>
  after && JSON.stringify(before) !== JSON.stringify(after);

export function strategicClockInterrupt(
  before: CampaignSnapshot,
  after: CampaignSnapshot,
): string | null {
  if (after.lastError) {
    return after.lastError;
  }
  if (hasPendingArrivalDecision(after)) {
    return 'Elegí combatir o retirarte. El tiempo de campaña está detenido.';
  }
  if (after.defeated) {
    return 'La campaña ha terminado.';
  }
  if (after.pendingEncounter || after.sectorEntryRequest) {
    return 'Un sector necesita órdenes de combate.';
  }
  if (after.travelNotice && changed(before.travelNotice, after.travelNotice)) {
    return after.travelNotice.events.map((e) => `${e.name}: ${e.text}`).join(' ');
  }
  for (const id of after.forceRoster ?? []) {
    const old = before.characters?.[id],
      next = after.characters?.[id];
    for (const [skill, value] of Object.entries(next?.trainedStats ?? {})) {
      if (value > (old?.trainedStats?.[skill] ?? 0)) {
        return 'Un combatiente mejoró una habilidad.';
      }
    }
  }
  if (changed(before.assignmentAttention?.notice, after.assignmentAttention?.notice)) {
    return 'Hay novedades en las asignaciones: revisá el aviso.';
  }
  if (changed(before.contractAttention?.notice, after.contractAttention?.notice)) {
    return 'Un contrato necesita atención.';
  }
  if (changed(before.logisticsNotice, after.logisticsNotice)) {
    return 'Hay novedades en suministros y entregas.';
  }
  const questEvent = (after.contentQuestEvents ?? [])
    .slice(before.contentQuestEvents?.length ?? 0)
    .at(-1);
  if (questEvent) {
    const title =
      after.contentCampaign?.package.quests?.find((q) => q.id === questEvent.quest)?.title ??
      'Un encargo';
    return `${title}: ${questEvent.to === 'failed' ? 'no pudo completarse.' : 'hay novedades.'}`;
  }
  if (after.completed && !before.completed) {
    return 'Se completó la campaña.';
  }
  return null;
}
