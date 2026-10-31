import { isUnconscious } from './actor-condition.js';

// Clinical presence is separate from a soldier's ability to obey orders.
// Custody is handled by the prisoner/NPC rules, not military first aid.
export const medicalPatientPresent = (patient) =>
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
export const medicalPatientAvailable = (patient) =>
  medicalPatientPresent(patient) && (!patient.routed || isUnconscious(patient));
