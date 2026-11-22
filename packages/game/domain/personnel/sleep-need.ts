// Classic JA2: profile sleep need, +1/+2/+4 below 75/50/25% health,
// Night Ops reduction, bounded to 4–12. Granaderos profile values are game
// balance data, not historical claims about the named people's sleep habits.

export type SleepProfiles = Readonly<Record<string, number>>;

export type SleepingCombatant = {
  id?: string | number;
  genericCharacter?: boolean;
  hp?: number;
  maxHp?: number;
  traits?: readonly string[];
};

export type SleepNeed = Readonly<{
  base: number;
  wounds: number;
  nightTraining: number;
  hours: number;
}>;

export type SleepRecovery = SleepNeed & Readonly<{ fatigue: number; energy: number }>;

export const SleepNeedRules = Object.freeze({
  DefaultProfileHours: 8,
  MinimumHours: 4,
  MaximumHours: 12,
  FatiguePerEightHours: 64,
  EnergyPerEightHours: 96,
  NightTrainingTrait: 'night_vision',
});

export function sleepNeed(unit: SleepingCombatant, profiles: SleepProfiles): SleepNeed {
  // Older authored stories retain their numeric save slots. Those slots do
  // not grant the historical cast's profile; explicit traits still apply.
  const profileHours = unit.id === undefined ? undefined : profiles[String(unit.id)];
  const base =
    !unit.genericCharacter && profileHours !== undefined
      ? profileHours
      : SleepNeedRules.DefaultProfileHours;
  const health = (unit.hp ?? unit.maxHp ?? 100) / Math.max(1, unit.maxHp ?? 100);
  const wounds = health < 0.25 ? 4 : health < 0.5 ? 2 : health < 0.75 ? 1 : 0;
  const nightTraining = unit.traits?.includes(SleepNeedRules.NightTrainingTrait) ? 1 : 0;
  return {
    base,
    wounds,
    nightTraining,
    hours: Math.max(
      SleepNeedRules.MinimumHours,
      Math.min(SleepNeedRules.MaximumHours, base + wounds - nightTraining),
    ),
  };
}

export function sleepRecovery(unit: SleepingCombatant, profiles: SleepProfiles): SleepRecovery {
  const need = sleepNeed(unit, profiles);
  // Keep the existing healthy eight-hour baseline on the 0–100 game scale.
  // No fractional bank or extra recovery is awarded when an assignment changes.
  return {
    ...need,
    fatigue: Math.max(1, Math.floor(SleepNeedRules.FatiguePerEightHours / need.hours)),
    energy: Math.max(1, Math.floor(SleepNeedRules.EnergyPerEightHours / need.hours)),
  };
}
