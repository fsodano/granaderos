// A successful local care stroke can steady an explicitly authored caregiver.
// This is shock relief, not extra treatment work or a saved reward receipt.
export const CARE_COMPOSURE_RELIEF = 2;

// A giver whose shock already exceeds this one is not steadied by the care.
const MaximumSteadiedShock = 20;
const CareComposureAbility = 'care_composure';

export type Caregiver = Readonly<{
  id: string | number;
  side?: string | undefined;
  shock?: number | undefined;
  abilities?: readonly string[] | undefined;
}>;

export type CarePatient = Readonly<{
  id: string | number;
  side?: string | undefined;
  hp: number;
  bleeding?: number | undefined;
  bandaged?: number | undefined;
}>;

export type CareTreatment = Readonly<{
  valid: boolean;
  dressingsUsed: number;
  hpAfter: number;
  bleedingAfter: number;
  bandagedAfter: number;
}>;

export type CareObservation = Readonly<{
  targetKind?: string | undefined;
  observed?: boolean | undefined;
}>;

export function careComposureRelief(
  caregiver: Caregiver,
  patient: CarePatient | undefined,
  treatment: CareTreatment | undefined,
  { targetKind = 'unit', observed = false }: CareObservation = {},
): number {
  const shock = caregiver.shock;
  if (
    !Array.isArray(caregiver.abilities) ||
    !caregiver.abilities.includes(CareComposureAbility) ||
    !observed ||
    !patient ||
    !(patient.hp > 0) ||
    !['unit', 'npc'].includes(targetKind) ||
    (targetKind === 'unit' &&
      (String(caregiver.id) === String(patient.id) || caregiver.side !== patient.side)) ||
    !treatment?.valid ||
    !(treatment.dressingsUsed > 0) ||
    shock === undefined ||
    !Number.isFinite(shock) ||
    shock <= 0 ||
    shock > MaximumSteadiedShock
  ) {
    return 0;
  }
  const effective =
    treatment.hpAfter > patient.hp ||
    treatment.bleedingAfter < (patient.bleeding ?? 0) ||
    treatment.bandagedAfter > (patient.bandaged ?? 0);
  return effective ? Math.min(CARE_COMPOSURE_RELIEF, shock) : 0;
}
