export class CampaignCharacterEquipmentMapper {
  #campaign;

  constructor(campaign) {
    this.#campaign = campaign;
  }

  project(character) {
    const record = this.#campaign.operativeState?.[character.id] ?? {};
    const loadout = this.#campaign.loadouts?.[character.id] ?? {};
    const equipped = {
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
      if (primaryAbsent || record.ammunitionChoice === undefined) delete equipped.ammunitionChoice;
    }
    const bladeReplaced = Object.hasOwn(loadout, 'blade');
    if (loadout.blade === 0 || (bladeReplaced && record.bladeMetadata === undefined))
      delete equipped.bladeMetadata;
    return equipped;
  }
}
