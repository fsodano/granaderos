import type { NativeMeleeContactFit } from './melee-contact-fit';
/** The native sampler needs current matrices for every original contact,
 * limb, complete boot and conservative body bound. Unused finger/socket
 * descendants do not enter those checks. Current actor rendering is untouched.
 * Multiplication/composition order of each required matrix stays unchanged. */
export function prunePreviewUpdates(fit: NativeMeleeContactFit) {
  return fit.prunePreviewUpdates();
}
