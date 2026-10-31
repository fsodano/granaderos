'use client';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import { useBattlePreview, type BattlePreviewState } from './useBattlePreview';
import type { GroupMovePreview, GroupMovePreviewRequest } from './battle-preview.ts';

export function useGroupMovePreview(
  battle: BattleSnapshot,
  request: GroupMovePreviewRequest | null,
): BattlePreviewState<GroupMovePreview> {
  const result = useBattlePreview(battle, request, 'group-preview');
  return {
    ...result,
    preview: result.failed
      ? {
          ok: false,
          reason: 'No se pudo calcular la vista previa. La ruta se comprobará al dar la orden.',
          members: [],
        }
      : result.preview,
  };
}
