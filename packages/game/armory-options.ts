import type { CampaignOperative, CampaignSnapshot } from './public/campaign-types.ts';
import type { ArmoryOption } from './public/equipment-types.ts';
import { equipmentKey, equipmentLabel } from './equipment-catalog.ts';
export function armoryOptions(
  state: CampaignSnapshot,
  _operative: CampaignOperative,
  slot: string,
): ArmoryOption[] {
  return state.armoryItems
    .filter((item) => slot === 'weapon' || item.item >= 1809)
    .map((item) => ({
      key: item.id,
      item: equipmentKey(item),
      instanceId: item.id,
      name: equipmentLabel(item),
      condition: item.condition,
      fittings: item.fittings,
      jammed: item.jammed,
    }));
}
