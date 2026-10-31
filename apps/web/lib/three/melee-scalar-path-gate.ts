import type { NativeMeleeContactFit } from './melee-contact-fit';
/** Exact current complete-boot values serve every original chronological
 * sole/support/velocity check. No warm lower pose or accepted recipe enters
 * this gate. Detached/morph footwear keeps the original native path. */
export function scalarRiflePathGate(
  fit: NativeMeleeContactFit,
  knownPairs: number[][] = [],
) {
  return fit.scalarRiflePathGate(knownPairs);
}
