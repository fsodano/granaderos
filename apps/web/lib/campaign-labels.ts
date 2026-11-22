import type { CampaignContext } from '../../../packages/game/public/compatibility-types.ts';
import { transportOptionsFor } from '../../../packages/game/public/game-runtime-api.ts';
export { campaignFactionName } from '../../../packages/game/public/game-runtime-api.ts';

export function campaignTransportName(context: CampaignContext, id: string) {
  return (
    transportOptionsFor(context).find((mode) => mode.id === id)?.name ??
    (id === 'march' ? 'Marcha a pie' : id === 'horse' ? 'A caballo' : id)
  );
}
