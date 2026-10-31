// Capture effective mechanics from an injected engine. The reference JSON was
// generated in a separate process against unmodified main at 12ac2d9b. Base
// blade specifications describe templates; heldBlade records actual slot use.
export function captureStockStartup(
  { campaign, abilities, weapons, ammunition, contracts, tactical },
  content = null,
) {
  const state = campaign.initialCampaign(1812, content),
    roster = campaign.rosterFor(state);
  const select = (value, keys) =>
    value ? Object.fromEntries(keys.map((key) => [key, value[key] ?? null])) : null;
  const stats = [
    'id',
    'maxHp',
    'hp',
    'agility',
    'dexterity',
    'strength',
    'leadership',
    'wisdom',
    'marksmanship',
    'mechanical',
    'explosives',
    'medical',
    'experienceLevel',
    'xp',
    'level',
    'stealth',
    'ridingSkill',
    'weeklyPay',
    'monthlyPay',
    'weapon',
    'blade',
    'tier',
    'classId',
  ];
  const mechanics = [
    'id',
    'damage',
    'range',
    'fireAP',
    'aimAP',
    'reloadAP',
    'readyAP',
    'capacity',
    'attackAP',
    'stockAP',
    'stockDamage',
    'stockReach',
    'ap',
    'reach',
    'weight',
    'price',
    'rifled',
    'spread',
    'loadPattern',
    'materialRangeSlope',
    'projectileEnergy',
    'projectileAirDrag',
  ];
  const supplies = [
    'hp',
    'fatigue',
    'alive',
    'xp',
    'rations',
    'torches',
    'condition',
    'startingCartridgesIssued',
    'maxHp',
    'bleeding',
    'bandaged',
    'energy',
    'asleep',
    'sleepCollapsed',
    'medkits',
    'assignment',
    'recoveryHours',
    'toolkitPoints',
    'trainingCredit',
    'morale',
    'moraleRestHours',
    'lastMoralePayAt',
    'bladeCondition',
    'weaponFittings',
    'weaponFittingPattern',
    'bladeFittingPattern',
    'captured',
    'capturedSector',
    'capturedAt',
    'capturedContract',
    'captureSequence',
    'capturedAmmunition',
    'ammo',
    'carriedAmmo',
    'ammunitionVersion',
  ];
  const termIds = Object.keys(contracts.contractTermsFor(state));
  return {
    startup: select(state, [
      'hour',
      'secondOfHour',
      'seed',
      'phase',
      'location',
      'activeSquadId',
      'squads',
      'resources',
      'reputation',
      'sectors',
      'artillerySelection',
      'recruited',
      'squad',
      'flags',
      'routes',
      'blockade',
      'pendingBattle',
      'completed',
      'defeated',
    ]),
    terms: contracts.contractTermsFor(state),
    characters: roster.map((op) => {
      const record = { ...op, ...state.operativeState[op.id] },
        loads = ammunition.ammunitionLoadsFor(record);
      const later = {
        ...state,
        hour: 12,
        secondOfHour: 37,
        operativeState: {
          ...state.operativeState,
          [op.id]: { ...state.operativeState[op.id], xp: 250 },
        },
        contracts: {
          ...state.contracts,
          [op.id]: { term: 'week', started: 0, expiresAt: 168, expiresSecond: 17, paid: 123 },
        },
      };
      return {
        stats: select(op, stats),
        foreign: Boolean(op.foreign),
        traits: op.traits ?? [],
        abilities: abilities.CHARACTER_ABILITIES.filter((a) =>
          abilities.hasCharacterAbility(op, a.id),
        ).map((a) => a.id),
        supplies: select(state.operativeState[op.id], supplies),
        loads,
        primary: (loads.length ? loads : [null]).map((load) =>
          select(
            weapons.weaponSpecification(
              load ? { ...record, ammunitionChoice: load.family } : record,
            ),
            mechanics,
          ),
        ),
        blade: select(weapons.weaponSpecification({ blade: record.blade }, 'blade'), mechanics),
        heldBlade: select(tactical.bladeFor({ ...record, activeSlot: 'blade' }), [
          'id',
          'damage',
          'ap',
          'reach',
        ]),
        quotes: Object.fromEntries(
          termIds.map((term) => [term, contracts.contractQuote(state, op, term)]),
        ),
        renewals: Object.fromEntries(
          termIds.map((term) => [term, contracts.contractRenewalQuote(later, op, term)]),
        ),
      };
    }),
  };
}
