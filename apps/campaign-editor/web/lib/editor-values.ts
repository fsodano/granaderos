/** Select an allowed value from an HTML control without widening its domain type. */
export function selectValue<const Value extends string>(
  value: string,
  allowed: readonly Value[],
): Value {
  const selected = allowed.find((candidate) => candidate === value);
  if (selected === undefined) {
    throw new Error(`Valor de selección no válido: ${value}`);
  }
  return selected;
}
export const supplyIds = [
  'rations',
  'torches',
  'medkits',
  'boleadoras',
  'priming',
  'flints',
] as const;
export const questStates = ['not-started', 'active', 'completed', 'failed'] as const;
export const effectQuestStates = ['active', 'completed', 'failed'] as const;
export const characterStates = [
  'alive',
  'dead',
  'serving',
  'present',
  'conscious',
  'unconscious',
  'wounded',
  'bleeding',
  'stable',
  'healthy',
] as const;

/** Undefined in an edit means remove the optional property from the saved document. */
export function applyDraftPatch<Value extends object>(
  value: Value,
  patch: import('../../../../packages/campaign-format/types.ts').DraftPatch<Value>,
): Value {
  const result = { ...value };
  for (const key in patch) {
    const next = patch[key];
    if (next === undefined) {
      delete result[key];
    } else {
      result[key] = next;
    }
  }
  return result;
}

export function isSupplyOption(value: unknown): value is { item: string; label: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'item' in value &&
    typeof value.item === 'string' &&
    'label' in value &&
    typeof value.label === 'string'
  );
}

export function isAlternativeLoad(
  value: {
    family: string;
  } & import('../../../../packages/campaign-format/types.ts').ProjectileProfile &
    Partial<
      Pick<
        import('../../../../packages/campaign-format/types.ts').AlternativeLoad,
        'damage' | 'range' | 'pattern'
      >
    >,
): value is import('../../../../packages/campaign-format/types.ts').AlternativeLoad {
  return (
    typeof value.damage === 'number' &&
    typeof value.range === 'number' &&
    (value.pattern === 'single' || value.pattern === 'cone')
  );
}
