/** @type {ReadonlyArray<readonly ['salaryMonthDays' | 'xpStep' | 'xpRaisePercent' | 'warningHours', string, number, number]>} */
export const CONTRACT_RULE_FIELDS = Object.freeze([
  ['salaryMonthDays', 'Días usados para calcular la paga diaria', 1, 90],
  ['xpStep', 'Experiencia necesaria para cada aumento de paga', 1, 10000],
  ['xpRaisePercent', 'Aumento por tramo de experiencia (%)', 0, 100],
  ['warningHours', 'Aviso antes del vencimiento (horas)', 0, 24],
]);

export function validateContractRules(value) {
  if (value === undefined) {
    return [];
  }
  const exact = (v, keys) =>
    v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k));
  const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  if (
    !exact(value, ['days', ...CONTRACT_RULE_FIELDS.map(([key]) => key)]) ||
    !exact(value.days, ['day', 'week', 'month'])
  ) {
    return ['Contratos: configurá los tres plazos y todas las reglas, sin campos adicionales.'];
  }
  const errors = CONTRACT_RULE_FIELDS.flatMap(([key, label, min, max]) =>
    integer(value[key], min, max) ? [] : [`${label}: elegí un entero de ${min} a ${max}.`],
  );
  for (const term of ['day', 'week', 'month']) {
    if (!integer(value.days[term], 1, 90)) {
      errors.push(`Contratos.${term}: elegí un plazo de 1 a 90 días.`);
    }
  }
  if (!(value.days.day < value.days.week && value.days.week < value.days.month)) {
    errors.push('Contratos: los plazos corto, medio y largo deben aumentar.');
  }
  return errors;
}

/** @type {ReadonlyArray<readonly ['cartsHours' | 'flotillaHours' | 'cartsFee' | 'flotillaFee', string, number, number]>} */
export const ARTILLERY_TRANSPORT_FIELDS = Object.freeze([
  ['cartsHours', 'Horas por tramo en carreta', 1, 168],
  ['flotillaHours', 'Horas por tramo en flotilla', 1, 168],
  ['cartsFee', 'Precio por pieza enviada en carreta (pesos)', 0, 1000000],
  ['flotillaFee', 'Precio por pieza enviada en flotilla (pesos)', 0, 1000000],
]);

export function validateArtilleryTransportRules(value) {
  if (value === undefined) {
    return [];
  }
  const keys = ['enabled', ...ARTILLERY_TRANSPORT_FIELDS.map(([key]) => key)];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    return ['Traslado de artillería: configurá todas las reglas, sin campos adicionales.'];
  }
  const errors =
    typeof value.enabled === 'boolean'
      ? []
      : ['Traslado de artillería: el permiso debe estar activado o desactivado.'];
  return errors.concat(
    ARTILLERY_TRANSPORT_FIELDS.flatMap(([key, label, min, max]) =>
      Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max
        ? []
        : [`${label}: elegí un entero de ${min} a ${max}.`],
    ),
  );
}

/** @type {ReadonlyArray<readonly ['bronze4' | 'field8' | 'swivel' | 'reserveLimit', string, number, number]>} */
export const ARTILLERY_SUPPLY_FIELDS = Object.freeze([
  ['bronze4', 'Munición de 4 libras (pesos)', 0, 1000000],
  ['field8', 'Munición de 8 libras (pesos)', 0, 1000000],
  ['swivel', 'Munición de pedrero (pesos)', 0, 1000000],
  ['reserveLimit', 'Máximo de reserva para reposición', 1, 1000],
]);

export function validateArtillerySupply(value) {
  if (value === undefined) {
    return [];
  }
  const keys = ['enabled', ...ARTILLERY_SUPPLY_FIELDS.map(([key]) => key)];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    return ['Munición de artillería: configurá todas las reglas, sin campos adicionales.'];
  }
  const errors =
    typeof value.enabled === 'boolean'
      ? []
      : ['Munición de artillería: el permiso debe estar activado o desactivado.'];
  return errors.concat(
    ARTILLERY_SUPPLY_FIELDS.flatMap(([key, label, min, max]) =>
      Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max
        ? []
        : [`${label}: elegí un entero de ${min} a ${max}.`],
    ),
  );
}

/** @type {ReadonlyArray<readonly ['waypointTicks' | 'energyReserve' | 'restEnergy', string, number, number]>} */
export const MILITIA_PATROL_FIELDS = Object.freeze([
  ['waypointTicks', 'Intervalos por punto de patrulla', 1, 60],
  ['energyReserve', 'Energía que reserva la patrulla', 0, 95],
  ['restEnergy', 'Energía recuperada al descansar la patrulla', 1, 100],
]);

export function validateMilitiaPatrol(value) {
  if (value === undefined) {
    return [];
  }
  const keys = ['enabled', ...MILITIA_PATROL_FIELDS.map(([key]) => key)];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    return ['Patrullas de milicias: configurá todas las reglas, sin campos adicionales.'];
  }
  const errors =
    typeof value.enabled === 'boolean'
      ? []
      : ['Patrullas de milicias: el estado debe estar activado o desactivado.'];
  return errors.concat(
    MILITIA_PATROL_FIELDS.flatMap(([key, label, min, max]) =>
      Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max
        ? []
        : [`${label}: elegí un entero de ${min} a ${max}.`],
    ),
  );
}

/** @type {ReadonlyArray<readonly ['regularThreshold' | 'veteranThreshold' | 'marksmanshipGain' | 'leadershipGain' | 'levelGain', string, number, number]>} */
export const MILITIA_PROGRESSION_FIELDS = Object.freeze([
  ['regularThreshold', 'Puntos para ascender a montonero', 1, 99],
  ['veteranThreshold', 'Puntos para ascender a veterano', 2, 100],
  ['marksmanshipGain', 'Puntería ganada por ascenso', 0, 100],
  ['leadershipGain', 'Liderazgo ganado por ascenso', 0, 100],
  ['levelGain', 'Niveles de experiencia ganados por ascenso', 0, 9],
]);

export function validateMilitiaProgression(value) {
  if (value === undefined) {
    return [];
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !MILITIA_PROGRESSION_FIELDS.some(([key]) => key === k)) ||
    !MILITIA_PROGRESSION_FIELDS.every(([key]) => Object.hasOwn(value, key))
  ) {
    return ['Ascensos de milicias: configurá todas las reglas, sin campos adicionales.'];
  }
  const errors = MILITIA_PROGRESSION_FIELDS.flatMap(([key, label, min, max]) =>
    Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max
      ? []
      : [`${label}: elegí un entero de ${min} a ${max}.`],
  );
  if (value.veteranThreshold <= value.regularThreshold) {
    errors.push('El ascenso a veterano necesita más puntos que el ascenso a montonero.');
  }
  return errors;
}

/** @type {ReadonlyArray<readonly ['minimumSkill' | 'baseHealing' | 'skillStep' | 'dressingPrice' | 'energyCost' | 'fatigueCost' | 'restEnergy' | 'restFatigue' | 'restHealingHours', string, number, number]>} */
export const CARE_RULE_FIELDS = Object.freeze([
  ['minimumSkill', 'Medicina mínima para atender', 0, 100],
  ['baseHealing', 'Salud recuperada por hora (base)', 1, 100],
  ['skillStep', 'Puntos de medicina por cada salud adicional', 1, 100],
  ['dressingPrice', 'Precio de cada venda (pesos)', 0, 10000],
  ['energyCost', 'Energía gastada por hora de atención', 0, 100],
  ['fatigueCost', 'Fatiga por hora de atención', 0, 100],
  ['restEnergy', 'Energía por hora de descanso (base)', 0, 100],
  ['restFatigue', 'Fatiga recuperada por hora de descanso (base)', 0, 100],
  ['restHealingHours', 'Horas de descanso por cada punto de salud', 1, 168],
]);

/** @type {readonly ['bleedingDamagePercent', string, number, number]} */
export const STRATEGIC_BLEEDING_FIELD = [
  'bleedingDamagePercent',
  'Daño horario de hemorragia (%)',
  0,
  100,
];

export function validateCareRules(value) {
  if (value === undefined) {
    return [];
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => !CARE_RULE_FIELDS.some(([key]) => key === k) && k !== 'bleedingDamagePercent',
    ) ||
    !CARE_RULE_FIELDS.every(([key]) => Object.hasOwn(value, key))
  ) {
    return ['Atención y descanso: configurá todas las reglas, sin campos adicionales.'];
  }
  return [
    ...CARE_RULE_FIELDS,
    ...(Object.hasOwn(value, 'bleedingDamagePercent') ? [STRATEGIC_BLEEDING_FIELD] : []),
  ].flatMap(([key, label, min, max]) =>
    Number.isSafeInteger(value[key]) && value[key] >= min && value[key] <= max
      ? []
      : [`${label}: elegí un entero de ${min} a ${max}.`],
  );
}

export function validateCampaignRules(value) {
  if (value === undefined) {
    return [];
  }
  const keys = ['startingTreasury', 'deploymentCartridges', 'enemyCartridges', 'militiaCartridges'];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !keys.includes(key) && !['cartridgePrice', 'startingHour'].includes(key),
    ) ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    return [
      'Reglas: configurá los fondos iniciales y los tres grupos de cartuchos. El precio del cartucho y la hora inicial son opcionales.',
    ];
  }
  return Object.keys(value).flatMap((key) =>
    Number.isSafeInteger(value[key]) &&
    value[key] >= 0 &&
    value[key] <=
      (key === 'startingHour'
        ? 23
        : ['startingTreasury', 'cartridgePrice'].includes(key)
          ? 1000000
          : 100)
      ? []
      : [`Reglas.${key}: valor entero fuera de rango.`],
  );
}
