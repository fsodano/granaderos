import type {
  CampaignSnapshot,
  CampaignOperative,
  CampaignOperativeState,
} from '../../public/campaign-types.ts';
export class CampaignCharacterEquipmentMapper {
  #campaign: CampaignSnapshot;

  constructor(campaign: CampaignSnapshot) {
    this.#campaign = campaign;
  }

  project(character: CampaignOperative): CampaignOperative {
    const record: Partial<CampaignOperativeState> =
      this.#campaign.operativeState?.[character.id] ?? {};
    const loadout: Partial<CampaignOperative> = this.#campaign.loadouts?.[character.id] ?? {};
    const equipped: CampaignOperative = {
      ...character,
      ...loadout,
      ...(record.ammunitionChoice !== undefined
        ? { ammunitionChoice: record.ammunitionChoice }
        : {}),
      ...(record.weaponMetadata ? { weaponMetadata: record.weaponMetadata } : {}),
      ...(record.bladeMetadata ? { bladeMetadata: record.bladeMetadata } : {}),
    };
    const primaryReplaced = Object.hasOwn(loadout, 'weapon');
    const primaryAbsent = record.weaponDropped || loadout.weapon === 0;
    if (primaryAbsent || (primaryReplaced && record.weaponMetadata === undefined)) {
      delete equipped.contentWeapon;
      delete equipped.weaponMetadata;
      if (primaryAbsent || record.ammunitionChoice === undefined) {
        delete equipped.ammunitionChoice;
      }
    }
    const bladeReplaced = Object.hasOwn(loadout, 'blade');
    if (loadout.blade === 0 || (bladeReplaced && record.bladeMetadata === undefined)) {
      delete equipped.bladeMetadata;
    }
    return equipped;
  }
}
