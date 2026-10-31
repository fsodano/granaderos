import type { AnimationClip, Object3D } from 'three';
import type { ClipSpec } from '../../../../apps/web/lib/three/actor-assets.ts';
export type ReviewWeapon = 'rifle' | 'pistol' | 'sabre' | 'knife';
export interface PreparedCharacter {
  scene: Object3D;
  animations: AnimationClip[];
  weapons: Record<ReviewWeapon, Object3D>;
  muzzles: Record<'rifle' | 'pistol', Object3D>;
  bayonet: Object3D;
  manifest: {
    clips: (ClipSpec & { events?: Record<string, number> | undefined })[];
    locomotionSpeed: Record<string, number | undefined>;
  };
}
