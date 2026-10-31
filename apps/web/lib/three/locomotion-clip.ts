import { required } from './required';
import { AnimationClip } from 'three';
import { boundClip, type LoadedActor } from './actor-assets';
import { locomotionReference } from './locomotion-reference';
const cache = new WeakMap<AnimationClip, WeakMap<AnimationClip, AnimationClip>>();
/** Preserve lance carry arms and fingers; replace the old short-stride lower
 * body with the reviewed gait. Both sets of tracks cover the same full cycle. */
export function boundLocomotionClip(asset: LoadedActor, semantic: string) {
  const source = boundClip(asset.clips, asset.animation.animations, semantic),
    reference = locomotionReference(semantic);
  if (reference === semantic) {
    return source;
  }
  const base = boundClip(asset.clips, asset.animation.animations, reference);
  let variants = cache.get(source.clip);
  if (!variants) {
    variants = new WeakMap();
    cache.set(source.clip, variants);
  }
  let clip = variants.get(base.clip);
  if (!clip) {
    const bones = asset.manifest.bones,
      lower = new Set([bones['root'], bones['hips']]);
    for (const role of ['footLeft', 'footRight']) {
      const foot = asset.body.scene.getObjectByName(required(bones[role])),
        thigh = foot?.parent?.parent;
      if (!thigh || thigh.parent?.name !== bones['hips']) {
        throw Error(`Missing native leg chain: ${semantic}:${role}`);
      }
      thigh.traverse((node) => lower.add(node.name));
    }
    const isLower = (name: string) => lower.has(name.slice(0, name.lastIndexOf('.')));
    const upper = source.clip.tracks
      .filter((track) => !isLower(track.name))
      .map((track) => {
        const copy = track.clone();
        copy.scale(base.clip.duration / source.clip.duration);
        return copy;
      });
    clip = new AnimationClip(
      source.clip.name,
      base.clip.duration,
      [...base.clip.tracks.filter((track) => isLower(track.name)), ...upper],
      source.clip.blendMode,
    );
    variants.set(base.clip, clip);
  }
  const stride = base.spec.nativeStrideSpeed ?? base.spec.locomotionSpeed;
  if (!(stride && stride > 0)) {
    throw Error(`Missing reviewed gait stride: ${reference}`);
  }
  return {
    clip,
    spec: {
      ...source.spec,
      duration: clip.duration,
      nativeStrideSpeed: stride,
      locomotionSpeed: stride,
      playbackRate: base.spec.playbackRate ?? 1,
    },
  };
}
