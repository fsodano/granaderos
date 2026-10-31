import type { Interpolant, KeyframeTrack, TypedArray } from 'three';

// Three installs this method on each track; GLTFLoader replaces it for CUBICSPLINE.
// The installed @types/three package lists only the standard factory methods.
declare module 'three' {
  interface KeyframeTrack {
    createInterpolant(result?: TypedArray): Interpolant;
  }
}

function numericArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'number');
}
export function nativeInterpolant(track: KeyframeTrack) {
  const interpolant = track.createInterpolant();
  return {
    evaluate(time: number): ArrayLike<number> {
      const values: unknown = interpolant.evaluate(time);
      if (
        values instanceof Float32Array ||
        values instanceof Float64Array ||
        numericArray(values)
      ) {
        return values;
      }
      throw new Error(`Invalid native interpolation buffer: ${track.name}`);
    },
  };
}
