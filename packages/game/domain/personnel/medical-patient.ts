import { isUnconscious } from './actor-condition.ts';

export type MedicalPatient = {
  hp: number;
  energy?: number;
  departure?: unknown;
  fled?: boolean;
  surrendered?: boolean;
  captured?: boolean;
  captive?: boolean;
  detention?: { freed?: boolean };
  routed?: boolean;
};

// Clinical presence is separate from a soldier's ability to obey orders.
// Custody is handled by the prisoner/NPC rules, not military first aid.
export const medicalPatientPresent = (patient: MedicalPatient | null | undefined): boolean =>
  Boolean(
    patient &&
    patient.hp > 0 &&
    !patient.departure &&
    !patient.fled &&
    !patient.surrendered &&
    !patient.captured &&
    !patient.captive &&
    !(patient.detention && !patient.detention.freed),
  );

// A conscious routed soldier refuses care. An unconscious soldier still on
// the field cannot flee or refuse it. Do not trust a stale saved flag.
export function medicalPatientAvailable(patient: MedicalPatient | null | undefined): boolean {
  if (!patient || !medicalPatientPresent(patient)) {
    return false;
  }
  return !patient.routed || isUnconscious(patient);
}
