// Mechanical condition is separate from firearm ownership and held-hand layout.
// Callers retain their ordinary firearm/capacity checks; older records default to 100.

// A firearm record as the rule reads it: the condition may be absent in older
// saves, and a missing condition means a perfect one.
export type FirearmConditionRecord = Readonly<{
  condition?: number | null | undefined;
}>;

export const BROKEN_FIREARM_REASON = 'El arma está rota: reparala o elegí otra.';

export const firearmServiceable = (gun: FirearmConditionRecord | null | undefined): boolean =>
  Boolean(gun) && (gun?.condition ?? 100) > 0;
