import profile from './locomotion-profile.json';
import type { AnimationClockClip } from './animation-clock';

function hasKey<Value extends object>(
  value: Value,
  key: string,
): key is Extract<keyof Value, string> {
  return Object.hasOwn(value, key);
}

/** Resolve only authored appearance and action identifiers. */
export function nativeAnimationClip(
  appearance: string,
  name: string,
): AnimationClockClip {
  if (!hasKey(profile.appearances, appearance)) {
    throw new Error(`Missing animation appearance: ${appearance}`);
  }
  const bank = profile.appearances[appearance];
  if (!hasKey(profile.banks, bank)) {
    throw new Error(`Missing animation bank: ${bank}`);
  }
  const actions = profile.banks[bank].actions;
  if (!hasKey(actions, name)) {
    throw new Error(`Missing native action timing: ${appearance}:${name}`);
  }
  return actions[name];
}
