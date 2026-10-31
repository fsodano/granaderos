import type { BattleSnapshot, BattleUnit, BattleNpc } from './public/compatibility-types.ts';
export type PhysicalBody = { body: BattleUnit; kind: 'unit' } | { body: BattleNpc; kind: 'npc' };
// A body's storage collection does not change its physical silhouette. Keep
// the collection tag separate from its ID: civilian and soldier IDs may match.
export function physicalBodies(state: Pick<BattleSnapshot, 'units' | 'npcs'>): PhysicalBody[] {
  return [
    ...(state.units ?? [])
      .filter((body) => body.hp > 0 && !body.departure && !body.fled)
      .map((body) => ({ body, kind: 'unit' as const })),
    ...(state.npcs ?? [])
      .filter((body) => (body.hp ?? 100) > 0 && !body.departure && !body.fled)
      .map((body) => ({ body, kind: 'npc' as const })),
  ];
}

