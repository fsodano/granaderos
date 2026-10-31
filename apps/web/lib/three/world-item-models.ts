import { isMesh } from './scene-node-types';
import { Box3, Quaternion, Vector3, MeshStandardMaterial } from 'three';
import type { LoadedActor } from './actor-assets';
import { ACTOR_VISUAL_SCALE } from './actor-visual-scale';
import type { WorldBatch } from './world-geometry';
import type { WorldItem } from './world-types';
import type { WorldMaterialSource } from './world-materials';

export type WorldEquipment = Pick<LoadedActor, 'manifest' | 'equipment'>;
export function worldEquipmentReference(item: WorldItem) {
  const raw =
      item.weapon ??
      item.blade ??
      item.outfit ??
      item.item ??
      item.kind ??
      item.type ??
      'supply',
    id = typeof raw === 'object' ? raw.id : raw;
  const template =
    item.template ??
    item.contentWeapon?.template ??
    item.weaponMetadata?.contentWeapon?.template ??
    item.bladeMetadata?.contentWeapon?.template ??
    item.itemMetadata?.contentWeapon?.template;
  return String(template ?? id).toLowerCase();
}

/** Reuse the carried model without changing its shared geometry or materials. */
export function addWorldItemModel(
  batch: WorldBatch,
  item: WorldItem,
  assets: WorldEquipment,
  offset: Vector3,
  angle: number,
  materials: WorldMaterialSource,
  light = 1,
) {
  const reference = worldEquipmentReference(item),
    key = assets.manifest.equipment.aliases?.[reference] ?? reference,
    spec = assets.manifest.equipment.items[key];
  if (!spec || key === 'item') {
    return null;
  }
  const source = assets.equipment.scene.getObjectByName(spec.node);
  if (!source) {
    throw Error(`Missing ground item model: ${spec.node}`);
  }
  const object = source.clone(true);
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.setScalar(ACTOR_VISUAL_SCALE * (spec.scale ?? 1));
  // The lance is authored upright for its hand socket. Other equipment already
  // lies along its native long axis; bags and tools retain their real shape.
  if (spec.category === 'lance') {
    object.rotation.z = Math.PI / 2;
  }
  for (const fitting of Object.values(item.fittings ?? {})) {
    const fit = assets.manifest.equipment.fittings?.[fitting?.fittingPattern];
    if (!fit) {
      continue;
    }
    const model = assets.equipment.scene.getObjectByName(fit.node);
    if (!model) {
      throw Error(`Missing ground item fitting: ${fit.node}`);
    }
    const attachment = model.clone(true);
    attachment.position.fromArray(fit.position ?? [0, 0, 0]);
    attachment.rotation.set(
      fit.rotation?.[0] ?? 0,
      fit.rotation?.[1] ?? 0,
      fit.rotation?.[2] ?? 0,
    );
    attachment.scale.setScalar(fit.scale ?? 1);
    object.add(attachment);
  }
  object.quaternion.premultiply(
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
  );
  const bounds = new Box3().setFromObject(object),
    centre = bounds.getCenter(new Vector3());
  object.position.set(
    offset.x - centre.x,
    offset.y - bounds.min.y,
    offset.z - centre.z,
  );
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (isMesh(child)) {
      if (!(child.material instanceof MeshStandardMaterial)) {
        throw Error(`Unsupported ground item material group: ${spec.node}`);
      }
      batch.add(
        child.geometry,
        materials.equipment(child.material),
        child.matrixWorld,
        light,
      );
    }
  });
  return spec.node;
}
