import { isMesh } from './scene-node-types';
import { required } from './required';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { WorldBatch, seeded } from './world-geometry';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldInput, WorldItem, WorldLoot } from './world-types';
import { addWorldItemModel, type WorldEquipment } from './world-item-models';

const equipmentKinds: Record<number, string> = {
  1800: 'brown-bess',
  1801: 'charleville',
  1802: 'baker-rifle',
  1803: 'cavalry-carbine',
  1804: 'shotgun',
  1805: 'saddle-pistol',
  1806: 'duelling-pistol',
  1807: 'blunderbuss',
  1808: 'double-pistol',
  1809: 'curved-sabre',
  1810: 'caroya-sabre',
  1811: 'socket-bayonet',
  1812: 'lance',
  1813: 'facon',
};
export function worldItemKind(item: WorldItem) {
  const raw =
      item.weapon ?? item.blade ?? item.outfit ?? item.item ?? item.kind ?? item.type ?? 'supply',
    id = typeof raw === 'object' ? raw.id : raw;
  const template =
    item.template ??
    item.contentWeapon?.template ??
    item.weaponMetadata?.contentWeapon?.template ??
    item.bladeMetadata?.contentWeapon?.template ??
    item.itemMetadata?.contentWeapon?.template ??
    Number(id);
  return equipmentKinds[Number(template)] ?? String(id).toLowerCase();
}

export function buildLoot(
  id: string,
  pile: WorldLoot,
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  equipment?: WorldEquipment,
) {
  const batch = new WorldBatch(geometry),
    items = pile.items?.length ? pile.items : [pile],
    light = illuminationAt(input, pile),
    modelNodes: string[] = [];
  for (const [n, item] of items.slice(0, 5).entries()) {
    const angle = seeded(Math.floor(pile.x), Math.floor(pile.y), n + 90) * Math.PI;
    const model =
      equipment &&
      addWorldItemModel(
        batch,
        item,
        equipment,
        new Vector3(
          ((n % 3) - 1) * 0.17,
          0.006 + Math.floor(n / 3) * 0.035,
          (Math.floor(n / 3) - 0.5) * 0.18,
        ),
        angle,
        materials,
        light,
      );
    if (model) {
      modelNodes.push(model);
      continue;
    }
    const kind = worldItemKind(item),
      part = new WorldBatch(geometry),
      wood = materials.get('wood'),
      iron = materials.get('iron'),
      brass = materials.get('brass');
    if (/pistol|pistola/.test(kind)) {
      const duel = kind === 'duelling-pistol',
        double = kind === 'double-pistol',
        barrels = double ? [-0.028, 0.028] : [0],
        end = duel ? 0.21 : 0.25;
      part.box(wood, -0.055, 0.03, 0, 0.18, 0.06, double ? 0.1 : 0.075, light);
      part.primitive(
        'taper',
        wood,
        [-0.12, 0.025, -0.04],
        [0.038, 0.17, 0.035],
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI * 0.5 - 0.28),
        light,
      );
      for (const z of barrels) {
        part.cylinder(
          iron,
          new Vector3(-0.02, 0.065, z),
          new Vector3(end, 0.065, z),
          duel ? 0.019 : 0.024,
          light,
        );
      }
      part.box(iron, -0.01, 0.075, -0.065, 0.045, 0.03, 0.02, light);
      part.box(brass, -0.12, 0.025, -0.13, 0.065, 0.01, 0.03, light);
    } else if (
      /rifle|musket|fusil|carbine|carabina|brown|charleville|shotgun|blunderbuss|trabuco|escopeta/.test(
        kind,
      )
    ) {
      const short = /carbine|blunderbuss|trabuco/.test(kind),
        shotgun = /shotgun|escopeta/.test(kind),
        baker = /baker/.test(kind),
        length = short ? 0.78 : baker ? 1.04 : 1.21,
        end = length * 0.53,
        start = -length * 0.47;
      part.box(wood, start + 0.16, 0.045, 0, 0.32, 0.09, 0.12, light);
      part.box(wood, 0.08, 0.035, 0, length * 0.57, 0.065, shotgun ? 0.1 : 0.07, light);
      for (const z of shotgun ? [-0.022, 0.022] : [0]) {
        part.cylinder(
          iron,
          new Vector3(start + 0.33, 0.079, z),
          new Vector3(end, 0.079, z),
          baker ? 0.025 : 0.021,
          light,
        );
      }
      part.box(iron, start + 0.34, 0.08, -0.045, 0.09, 0.045, 0.02, light);
      for (const x of [end * 0.3, end * 0.69]) {
        part.box(
          kind === 'charleville' ? iron : brass,
          x,
          0.051,
          0,
          0.023,
          0.1,
          shotgun ? 0.12 : 0.08,
          light,
        );
      }
      if (/blunderbuss|trabuco/.test(kind)) {
        const flare = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI * 0.5);
        part.primitive('flare', brass, [end + 0.055, 0.079, 0], [0.067, 0.16, 0.067], flare, light);
      }
      if (item.fittings?.['bayonet']) {
        part.box(iron, 0.79, 0.069, 0, 0.34, 0.016, 0.025, light);
      }
    } else if (/sabre|saber|sable|facon|facón|knife|cuchillo|bayonet/.test(kind)) {
      const long = /sabre|saber|sable/.test(kind),
        socket = /bayonet/.test(kind),
        length = long ? 0.76 : 0.29,
        curve = kind === 'curved-sabre' ? 0.14 : long ? 0.055 : 0;
      if (socket) {
        part.primitive(
          'torus',
          iron,
          [-0.055, 0.04, 0],
          [0.043, 0.043, 0.043],
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.5),
          light,
        );
        part.box(iron, 0.01, 0.04, -0.06, 0.11, 0.021, 0.021, light);
      } else {
        part.box(materials.get('leather'), -0.12, 0.03, 0, 0.2, 0.05, 0.055, light);
        part.box(brass, -0.012, 0.038, 0, 0.025, 0.025, 0.16, light);
        if (long) {
          part.primitive(
            'torus',
            brass,
            [-0.13, 0.028, -0.03],
            [0.105, 0.065, 0.075],
            new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI * 0.5),
            light,
          );
        }
      }
      for (let k = 0; k < 7; k++) {
        const a = k / 7,
          b = (k + 1) / 7;
        part.cylinder(
          iron,
          new Vector3(a * length, 0.028, curve * a * a),
          new Vector3(b * length, 0.028, curve * b * b),
          0.014 * (1 - a * 0.3),
          light,
        );
      }
      part.primitive(
        'cone',
        iron,
        [length + 0.035, 0.028, curve],
        [0.021, 0.1, 0.008],
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI * 0.5),
        light,
      );
    } else if (/lance|lanza|pike|pica/.test(kind)) {
      part.cylinder(wood, new Vector3(-0.8, 0.025, 0), new Vector3(0.78, 0.025, 0), 0.018, light);
      part.primitive(
        'cone',
        iron,
        [0.91, 0.025, 0],
        [0.05, 0.26, 0.018],
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI * 0.5),
        light,
      );
    } else if (item.outfit || /coat|uniform|outfit|ropa/.test(kind)) {
      part.box(materials.get('rug', { colour: '#283946' }), 0, 0.04, 0, 0.33, 0.08, 0.27, light);
      part.box(materials.get('linen'), 0, 0.084, 0, 0.04, 0.012, 0.25, light);
    } else if (/ammo|round|ball|cartridge|cartucho|municion|munición|powder/.test(kind)) {
      part.box(materials.get('linen'), 0, 0.04, 0, 0.19, 0.08, 0.14, light);
      for (let k = 0; k < 3; k++) {
        part.primitive(
          'sphere',
          iron,
          [(k - 1) * 0.05, 0.085, 0.045],
          [0.021, 0.021, 0.021],
          undefined,
          light,
        );
      }
    } else {
      part.primitive(
        'sphere',
        materials.get(/medical|bandage|vendaje|botiquin/.test(kind) ? 'linen' : 'leather'),
        [0, 0.07, 0],
        [0.17, 0.09, 0.13],
        undefined,
        light,
      );
      part.box(materials.get('linen'), 0, 0.12, 0, 0.03, 0.025, 0.18, light);
    }
    const built = part.finish(`item:${n}`);
    let bottom = Infinity;
    for (const child of built.children) {
      if (!isMesh(child)) {
        throw Error('Invalid world item mesh');
      }
      const mesh = child;
      mesh.geometry.computeBoundingBox();
      bottom = Math.min(bottom, required(mesh.geometry.boundingBox).min.y);
    }
    const offset = new Vector3(
        ((n % 3) - 1) * 0.17,
        0.006 - bottom + Math.floor(n / 3) * 0.035,
        (Math.floor(n / 3) - 0.5) * 0.18,
      ),
      matrix = new Matrix4().compose(
        offset,
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
        new Vector3(1, 1, 1),
      );
    batch.take(built, matrix);
  }
  const group = batch.finish(`loot:${id}`);
  group.position.set(pile.x * T, pile.elevation ?? 0, pile.y * T);
  group.userData['kind'] = 'loot';
  group.userData['semanticId'] = `loot:${id}`;
  group.userData['itemKinds'] = items.map(worldItemKind);
  group.userData['modelNodes'] = modelNodes;
  return group;
}
