import { isMesh } from './scene-node-types';
import { required } from './required';
import { Group, Quaternion, Vector3 } from 'three';
import { WorldBatch, lathe, seeded } from './world-geometry';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldInput, WorldProp } from './world-types';

/** Generated hearths face free cells inside their admitted room. */
export function visualPropRotation(prop: WorldProp, input: WorldInput) {
  const fallback = prop.rotation ?? 0,
    roomId = prop.roomId,
    prefix = roomId ? `${roomId}:dressing-` : '';
  if (
    prop.rotation !== undefined ||
    prop.type !== 'hearth' ||
    !prop.decorative ||
    !prop.generatedRoomDressing ||
    !roomId ||
    !prop.buildingId ||
    !prop.id.startsWith(prefix) ||
    !/^\d+$/.test(prop.id.slice(prefix.length))
  ) {
    return fallback;
  }
  if (!new Set(input.revealedRooms ?? []).has(roomId)) {
    return fallback;
  }
  const building = input.terrain.buildings?.find((item) => item.id === prop.buildingId),
    room = building?.rooms?.find((item) => item.id === roomId),
    level = prop.tacticalLevel ?? 0;
  if (!room || (room.tacticalLevel ?? room.cells[0]?.tacticalLevel ?? 0) !== level) {
    return fallback;
  }
  const cells = new Set(
    room.cells
      .filter((cell) => (cell.tacticalLevel ?? room.tacticalLevel ?? 0) === level)
      .map((cell) => `${cell.x},${cell.y}`),
  );
  if (!cells.has(`${prop.x},${prop.y}`)) {
    return fallback;
  }
  // The rear must meet the room edge and the opening must lead into the room.
  // Equal runs use the fixed north, east, south, west order.
  let rotation = fallback,
    longest = 0;
  for (const [angle, dx, dy] of [
    [0, 0, -1],
    [90, 1, 0],
    [180, 0, 1],
    [270, -1, 0],
  ] as const) {
    if (cells.has(`${prop.x - dx},${prop.y - dy}`)) {
      continue;
    }
    let run = 0;
    while (cells.has(`${prop.x + dx * (run + 1)},${prop.y + dy * (run + 1)}`)) {
      run++;
    }
    if (run > longest) {
      rotation = angle;
      longest = run;
    }
  }
  return rotation;
}

/** Furniture occupies its authored footprint; only its mesh rotates. */
export function buildProps(
  id: string,
  props: readonly WorldProp[],
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry);
  for (const prop of props) {
    const light = illuminationAt(input, prop),
      width = (prop.footprint?.width ?? 1) * T,
      depth = (prop.footprint?.height ?? 1) * T;
    const x = (prop.x + ((prop.footprint?.width ?? 1) - 1) * 0.5) * T,
      z = (prop.y + ((prop.footprint?.height ?? 1) - 1) * 0.5) * T,
      y = prop.elevation ?? 0;
    const angle = (visualPropRotation(prop, input) * Math.PI) / 180,
      rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -angle);
    const frame = new Group();
    frame.position.set(x, y, z);
    frame.quaternion.copy(rotation);
    frame.updateMatrix();
    const wood = materials.get(prop.material === 'stone' ? 'stone' : 'wood'),
      dark = materials.get('darkwood'),
      iron = materials.get('iron'),
      linen = materials.get('linen'),
      stone = materials.get('stone');
    // Rotated long furniture fits inside the same authoritative cells.
    const w = Math.abs(Math.sin(angle)) > 0.5 ? depth : width,
      d = Math.abs(Math.sin(angle)) > 0.5 ? width : depth;
    const part = new WorldBatch(geometry);
    const box = (
      m: typeof wood,
      a: number,
      b: number,
      c: number,
      wa: number,
      h: number,
      dc: number,
    ) => part.box(m, a, b, c, wa, h, dc, light);
    const pole = (
      m: typeof wood,
      a: readonly [number, number, number],
      b: readonly [number, number, number],
      r: number,
    ) => part.cylinder(m, new Vector3(...a), new Vector3(...b), r, light);
    const h =
      prop.obstacleHeight ??
      {
        table: 0.8,
        bench: 0.45,
        bed: 0.55,
        chest: 0.8,
        barrels: 1.2,
        hay: 1.3,
        cart: 1.2,
        shelf: 1.5,
        hearth: 0.7,
        washstand: 0.8,
        pottery: 0.45,
        sacks: 0.7,
        'broken-timber': 0.3,
        rubble: 0.35,
        candle: 0.3,
        rug: 0.012,
      }[prop.type] ??
      0.7;
    if (prop.destroyed) {
      addStructureDebris(part, materials, {
        ...prop,
        width: w,
        depth: d,
        light,
      });
    } else if (prop.type === 'table' || prop.type === 'bench' || prop.type === 'washstand') {
      const tw = w * 0.8,
        td = d * (prop.type === 'bench' ? 0.35 : 0.68),
        th = 0.07,
        timber = prop.type !== 'washstand' && prop.material !== 'stone';
      if (timber) {
        boards(
          part,
          wood,
          light,
          tw,
          td,
          h - th * 0.5,
          th,
          Math.max(
            prop.type === 'bench' ? 2 : 3,
            Math.min(prop.type === 'bench' ? 4 : 6, Math.round(td / 0.2)),
          ),
        );
      } else {
        box(wood, 0, h - th * 0.5, 0, tw, th, td);
      }
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          box(wood, a * tw * 0.4, (h - th) * 0.5, b * td * 0.33, 0.075, h - th, 0.075);
          if (prop.type !== 'bench') {
            box(dark, a * tw * 0.4, 0.25, b * td * 0.33, 0.09, 0.05, 0.09);
          }
        }
      }
      if (timber) {
        // Narrow rails meet the existing legs, leaving the centre open below
        // the boards. The seat/table keeps its authored top and usable sides.
        for (const a of [-1, 1]) {
          box(wood, a * tw * 0.4, h - 0.14, 0, 0.05, 0.14, td * 0.66 + 0.075);
        }
        for (const b of [-1, 1]) {
          box(wood, 0, h - 0.14, b * td * 0.33, tw * 0.8 + 0.075, 0.14, 0.05);
        }
      } else {
        box(wood, 0, h - 0.18, 0, tw * 0.9, 0.14, td * 0.7);
      }
      if (prop.type === 'washstand') {
        const ceramic = materials.get('ceramic'),
          pitcherX = w * 0.29,
          pitcherZ = -d * 0.16;
        part.primitive('washstand-basin', ceramic, [0, h + 0.012, 0], [1, 1, 1], undefined, light);
        part.primitive(
          'cylinder',
          materials.get('water'),
          [0, h + 0.097, 0],
          [0.145, 0.002, 0.145],
          undefined,
          light,
        );
        part.primitive(
          'washstand-pitcher',
          ceramic,
          [pitcherX, h, pitcherZ],
          [1, 1, 1],
          undefined,
          light,
        );
        part.primitive(
          'washstand-handle',
          ceramic,
          [pitcherX + 0.061, h + 0.122, pitcherZ],
          [0.038, 0.05, 0.038],
          undefined,
          light,
        );
        const drape = Math.min(1, Math.max(0.05, (h - 0.04) / 0.364));
        part.primitive(
          'washstand-towel',
          linen,
          [-w * 0.25, h, d * 0.18],
          [0.18, drape, d * 0.32],
          undefined,
          light,
        );
      }
    } else if (prop.type === 'bed') {
      box(wood, 0, 0.18, 0, w * 0.72, 0.15, d * 0.9);
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          box(wood, a * w * 0.31, 0.15, b * d * 0.4, 0.08, 0.3, 0.08);
        }
      }
      part.primitive(
        'bed-mattress',
        linen,
        [0, h - 0.06, 0],
        [w * 0.69, 0.12, d * 0.84],
        undefined,
        light,
      );
      const drape = Math.min(1, Math.max(0.05, (h - 0.275) / 0.202));
      part.primitive(
        'bed-blanket',
        materials.get('rug'),
        [0, h, d * 0.1],
        [w * 0.7, drape, d * 0.52],
        undefined,
        light,
      );
      part.primitive(
        'bed-pillow',
        linen,
        [0, h + 0.045, -d * 0.29],
        [w * 0.5, 0.09, d * 0.19],
        undefined,
        light,
      );
      box(wood, 0, h * 0.7, -d * 0.45, w * 0.77, h * 0.65, 0.08);
      box(wood, 0, h * 0.5, d * 0.45, w * 0.76, h * 0.4, 0.07);
      // Two support rails close the old platform-to-mattress gap.
      // The seven existing frame parts retain their vertices and dimensions.
      const support = Math.max(0, h - 0.12 - 0.255);
      for (const a of [-1, 1]) {
        box(wood, a * w * 0.25, 0.255 + support * 0.5, 0, 0.075, support, d * 0.72);
      }
    } else if (prop.type === 'chest') {
      const cw = w * 0.68,
        cd = d * 0.51,
        timber = prop.material !== 'stone',
        wall = 0.035;
      if (timber) {
        // A real cavity stays visible when the lid rises. The rim meets the
        // old lid underside; the closed chest still ends at exactly h.
        const bottom = h * 0.025,
          top = h - 0.1,
          sideTop = top - 0.036;
        box(dark, 0, bottom + 0.035, 0, cw - wall * 2, 0.07, cd - wall * 2);
        for (const a of [-1, 1]) {
          box(wood, a * (cw - wall) * 0.5, (bottom + sideTop) * 0.5, 0, wall, sideTop - bottom, cd);
          box(dark, a * (cw - wall) * 0.5, top - 0.018, 0, wall, 0.036, cd);
        }
        for (const b of [-1, 1]) {
          box(
            wood,
            0,
            (bottom + sideTop) * 0.5,
            b * (cd - wall) * 0.5,
            cw - wall * 2,
            sideTop - bottom,
            wall,
          );
          box(dark, 0, top - 0.018, b * (cd - wall) * 0.5, cw - wall * 2, 0.036, wall);
        }
      } else {
        box(wood, 0, h * 0.42, 0, cw, h * 0.79, cd);
      }
      box(dark, 0, 0.04, 0, cw + 0.035, 0.07, cd + 0.035);
      const lid = new WorldBatch(geometry);
      if (timber) {
        // Long lid boards are joined by two underside battens. Flush straps
        // retain the closed height, and all lid fittings follow its hinge.
        boards(
          lid,
          wood,
          light,
          cw,
          cd,
          0.0065,
          0.075,
          Math.max(3, Math.min(5, Math.round(cd / 0.18))),
          -cd * 0.5,
        );
        for (const a of [-1, 1]) {
          lid.box(dark, a * cw * 0.31, -0.04, -cd * 0.5, 0.05, 0.02, cd, light);
          lid.box(iron, a * cw * 0.31, 0.047, -cd * 0.5, 0.034, 0.006, cd, light);
          lid.box(iron, a * cw * 0.31, 0.047, -0.038, 0.075, 0.006, 0.076, light);
          box(iron, a * cw * 0.31, h - 0.105, cd * 0.5 + 0.008, 0.075, 0.11, 0.016);
          pole(
            iron,
            [a * cw * 0.31 - 0.047, h - 0.05, cd * 0.5],
            [a * cw * 0.31 + 0.047, h - 0.05, cd * 0.5],
            0.014,
          );
          // Side handles have open centres rather than solid metal pads.
          const side = a * (cw * 0.5 + 0.036),
            handleY = h * 0.44;
          for (const b of [-1, 1]) {
            box(iron, side, handleY, b * 0.062, 0.014, 0.066, 0.014);
            box(iron, a * (cw * 0.5 + 0.019), handleY + 0.03, b * 0.062, 0.038, 0.032, 0.028);
          }
          box(iron, side, handleY - 0.033, 0, 0.014, 0.014, 0.138);
        }
      } else {
        lid.box(wood, 0, 0, -cd * 0.5, cw, 0.1, cd, light);
      }
      const lidGroup = lid.finish('chest-lid');
      lidGroup.position.set(0, h - 0.05, cd * 0.5);
      if (prop.open) {
        lidGroup.rotation.x = Math.PI * 0.42;
      }
      lidGroup.updateMatrix();
      part.take(lidGroup, lidGroup.matrix);
      for (const a of [-1, 1]) {
        box(iron, a * cw * 0.31, h * 0.42, -cd * 0.51, 0.034, h * 0.78, 0.025);
      }
      box(iron, 0, h * 0.55, -cd * 0.53, 0.07, 0.11, 0.02);
    } else if (prop.type === 'barrels') {
      const count = Math.max(1, Math.min(4, Math.round((w * d) / (T * T)))),
        r = Math.min(0.32, w * 0.3, d * 0.3),
        barrel = lathe([
          [r * 0.76, 0],
          [r, 0.13],
          [r * 1.08, h * 0.48],
          [r, h - 0.13],
          [r * 0.76, h],
        ] as const);
      for (let n = 0; n < count; n++) {
        const a = count > 1 ? ((n % 2) - 0.5) * r * 2.1 : 0,
          b = count > 2 ? (Math.floor(n / 2) - 0.5) * r * 2.1 : 0;
        part.add(barrel, wood, new importMatrix().makeTranslation(a, 0, b), light);
        for (const by of [0.1, h * 0.48, h - 0.1]) {
          part.primitive(
            'torus',
            iron,
            [a, by, b],
            [r * 1.03, r * 1.03, r * 1.03],
            new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI * 0.5),
            light,
          );
        }
        part.primitive('cylinder', dark, [a, h, b], [r * 0.79, 0.025, r * 0.79], undefined, light);
      }
      barrel.dispose();
    } else if (prop.type === 'hay' || prop.type === 'sacks') {
      const m = materials.get(prop.type === 'hay' ? 'thatch' : 'linen');
      for (let n = 0; n < 4; n++) {
        const a = ((n % 2) - 0.5) * w * 0.34,
          b = (Math.floor(n / 2) - 0.5) * d * 0.34,
          kind =
            prop.type === 'hay'
              ? 'box'
              : `storage-sack-${(n + Math.floor(seeded(prop.x, prop.y, 1723) * 2)) % 2}`;
        let fit = 1;
        if (prop.type === 'sacks') {
          const bounds = required(geometry.get(kind).boundingBox),
            rx = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) * w * 0.33,
            rz = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)) * d * 0.31,
            c = Math.cos(n * 0.12),
            s = Math.sin(n * 0.12);
          fit = Math.min(
            1,
            (w * 0.5 - Math.abs(a)) / (c * rx + s * rz),
            (d * 0.5 - Math.abs(b)) / (s * rx + c * rz),
          );
        }
        part.primitive(
          kind,
          m,
          [a, h * (n === 3 ? 0.57 : 0.32), b],
          [w * 0.33 * fit, h * 0.34, d * 0.31 * fit],
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), n * 0.12),
          light,
        );
      }
      if (prop.type === 'hay') {
        for (let n = 0; n < 6; n++) {
          box(dark, (n - 2.5) * w * 0.1, h * 0.66, 0, 0.006, 0.015, d * 0.6);
        }
      }
    } else if (prop.type === 'cart') {
      const cw = w * 0.68,
        cd = d * 0.62,
        bedZ = d * 0.1,
        radius = Math.min(0.36, w * 0.3, d * 0.3),
        axleY = radius * 1.04 * 1.09 + 0.01,
        axleZ = d * 0.1;
      box(wood, 0, 0.61, bedZ, cw, 0.1, cd);
      for (const a of [-1, 1]) {
        box(wood, a * cw * 0.5, 0.87, bedZ, 0.08, 0.5, cd);
        for (const by of [0.76, 0.95]) {
          box(dark, a * cw * 0.51, by, bedZ, 0.02, 0.035, cd);
        }
      }
      box(wood, 0, 0.85, bedZ + cd * 0.5, cw, 0.43, 0.075);
      for (const a of [-1, 1]) {
        pole(wood, [a * cw * 0.39, 0.6, bedZ - cd * 0.45], [a * cw * 0.39, 0.39, -d * 0.45], 0.035);
      }
      // The iron tyre includes the torus tube. Rest its outer edge on the
      // floor and leave the hubs and shafts inside the authored cells.
      pole(iron, [-cw * 0.64, axleY, axleZ], [cw * 0.64, axleY, axleZ], 0.035);
      for (const a of [-1, 1]) {
        wheel(part, materials, light, a * cw * 0.64, axleY, axleZ, radius);
      }
    } else if (prop.type === 'shelf') {
      const sw = w * 0.74,
        sd = d * 0.25;
      for (const a of [-1, 1]) {
        box(wood, a * sw * 0.5, h * 0.5, 0, 0.08, h, sd);
      }
      for (const by of [0.08, h * 0.35, h * 0.65, h - 0.04]) {
        box(wood, 0, by, 0, sw, 0.06, sd);
      }
      if (prop.purpose === 'archive' || prop.purpose === 'office') {
        // Bound ledgers and tied paper belong in administrative rooms.
        // Keep their covers, pages and binding visible at the game camera.
        for (let n = 0; n < 5; n++) {
          const a = (n - 2) * sw * 0.15,
            base = h * (n % 2 ? 0.65 : 0.35) + 0.03,
            bh = 0.2 + (n % 3) * 0.025,
            bw = 0.075,
            bd = Math.min(0.19, sd * 0.78);
          box(n % 2 ? dark : wood, a, base + bh * 0.5, 0, bw, bh, bd);
          box(linen, a, base + bh * 0.5, -0.008, bw * 0.67, bh - 0.028, bd - 0.022);
          box(dark, a, base + bh * 0.5, bd * 0.48, bw + 0.006, bh, 0.016);
          for (const by of [0.045, bh - 0.045]) {
            box(wood, a, base + by, bd * 0.52, bw + 0.012, 0.012, 0.009);
          }
        }
        for (let n = 0; n < 3; n++) {
          const a = (n - 1) * sw * 0.26,
            bh = 0.035 + n * 0.015,
            bd = Math.min(0.18, sd * 0.75);
          box(linen, a, 0.11 + bh * 0.5, 0, sw * 0.21, bh, bd);
          box(dark, a, 0.112 + bh, 0, 0.012, 0.004, bd + 0.004);
        }
      } else {
        const vesselKinds = [
            'shelf-jar',
            'shelf-bottle',
            'shelf-bowl',
            'shelf-jar',
            'shelf-bottle',
          ],
          vesselScale = Math.min(
            1,
            (Math.max(0, Math.min(h * 0.3 - 0.06, h * 0.35 - 0.1)) * 0.94) / 0.257,
          );
        for (let n = 0; vesselScale > 0 && n < 5; n++) {
          const a = (n - 2) * sw * 0.15,
            base = h * (n % 2 ? 0.65 : 0.35) + 0.03;
          part.primitive(
            required(vesselKinds[n]),
            materials.get(n % 2 ? 'ceramic' : 'food'),
            [a, base, 0],
            [1, vesselScale, 1],
            undefined,
            light,
          );
        }
      }
    } else if (prop.type === 'hearth') {
      box(stone, 0, 0.04, 0, w * 0.65, 0.08, d * 0.58);
      box(materials.get('brick'), 0, h * 0.5, d * 0.2, w * 0.68, h, 0.18);
      for (const a of [-1, 1]) {
        box(stone, a * w * 0.27, h * 0.34, 0, w * 0.13, h * 0.68, d * 0.47);
      }
      box(stone, 0, h * 0.73, 0, w * 0.67, 0.18, d * 0.53);
      box(materials.get('ember', { emissive: true }), 0, 0.105, 0, w * 0.24, 0.025, d * 0.18);
      for (const a of [-1, 1]) {
        pole(dark, [a * 0.17, 0.13, -0.12], [-a * 0.17, 0.13, 0.12], 0.035);
      }
      // The authored iron pot hangs in front of the unchanged firebox. Its rolled rim
      // opens into a real cavity, and the bail joins both rim-side hinges.
      const rim = 0.33,
        bailY = rim - 0.012,
        lintel = h * 0.73 - 0.09,
        outside = lintel < bailY + 0.088 + 0.006;
      const potZ = outside ? -d * 0.265 - 0.145 : -d * 0.265 - 0.012;
      part.primitive('hearth-pot', iron, [0, 0.17, potZ], [1, 1, 1], undefined, light);
      part.primitive(
        'hearth-bail',
        iron,
        [0, bailY, potZ],
        [0.132, 0.088, 0.132],
        undefined,
        light,
      );
      for (const a of [-1, 1]) {
        pole(iron, [a * 0.137, bailY, potZ - 0.0125], [a * 0.137, bailY, potZ + 0.0125], 0.008);
      }
      if (outside) {
        // A short firebox stores the same pot on an outside iron arm. Keep
        // its natural size instead of crushing it into the stone lintel.
        const anchorZ = -d * 0.265 + 0.012,
          top = h * 0.73 + 0.09,
          beamY = Math.max(top + 0.006, bailY + 0.1);
        box(iron, 0, beamY, (anchorZ + potZ) * 0.5, 0.02, 0.012, anchorZ - potZ + 0.012);
        pole(iron, [0, top - 0.004, anchorZ], [0, beamY, anchorZ], 0.005);
        pole(iron, [0, bailY + 0.088, potZ], [0, beamY, potZ], 0.005);
      } else {
        const anchorZ = -d * 0.265 + 0.02;
        box(iron, 0, lintel + 0.002, anchorZ, 0.36, 0.012, 0.02);
        box(iron, 0, lintel + 0.002, (anchorZ + potZ) * 0.5, 0.02, 0.012, anchorZ - potZ + 0.012);
        pole(iron, [0, bailY + 0.088, potZ], [0, lintel + 0.002, potZ], 0.005);
      }
    } else if (prop.type === 'pottery') {
      const pot = lathe([
        [0.08, 0],
        [0.14, 0.04],
        [0.18, h * 0.42],
        [0.16, h * 0.76],
        [0.07, h * 0.9],
        [0.07, h],
        [0.06, h],
        [0.06, h * 0.9],
      ] as const);
      part.add(pot, materials.get('ceramic'), new importMatrix(), light);
      pot.dispose();
      for (const a of [-1, 1]) {
        part.primitive(
          'torus',
          materials.get('ceramic'),
          [a * 0.15, h * 0.62, 0],
          [0.065, 0.09, 0.065],
          undefined,
          light,
        );
      }
    } else if (prop.type === 'rug') {
      part.primitive(
        'floor-rug-body',
        materials.get('rug'),
        [0, 0, 0],
        [w, 1, d],
        undefined,
        light,
      );
      part.primitive('floor-rug-trim', linen, [0, 0, 0], [w, 1, d], undefined, light);
    } else if (prop.type === 'candle') {
      part.primitive(
        'cylinder',
        materials.get('brass'),
        [0, 0.02, 0],
        [0.09, 0.035, 0.09],
        undefined,
        light,
      );
      part.primitive(
        'cylinder',
        materials.get('wax'),
        [0, h * 0.45, 0],
        [0.035, h * 0.85, 0.035],
        undefined,
        light,
      );
      part.primitive(
        'cone',
        materials.get('flame', { emissive: true }),
        [0, h + 0.035, 0],
        [0.025, 0.07, 0.025],
        undefined,
        light,
      );
    } else if (prop.type === 'broken-timber' || prop.type === 'rubble') {
      for (let n = 0; n < 7; n++) {
        const a = seeded(prop.x, prop.y, n + 80),
          b = seeded(prop.y, prop.x, n + 31),
          angle = a * 5,
          rubble = prop.type === 'rubble',
          sw = rubble ? 0.15 : 0.07,
          sd = rubble ? 0.16 : Math.min(0.6, d * 0.6);
        const halfX = rubble
            ? Math.hypot(sw, sd)
            : (Math.abs(Math.cos(angle)) * sw + Math.abs(Math.sin(angle)) * sd) * 0.5,
          halfZ = rubble
            ? Math.hypot(sw, sd)
            : (Math.abs(Math.sin(angle)) * sw + Math.abs(Math.cos(angle)) * sd) * 0.5;
        const px = (a - 0.5) * Math.max(0, w - 2 * halfX) * 0.8,
          pz = (b - 0.5) * Math.max(0, d - 2 * halfZ) * 0.8;
        part.primitive(
          rubble ? 'rock' : 'box',
          rubble ? stone : wood,
          [px, h * 0.35, pz],
          [sw, h * 0.3, sd],
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
          light,
        );
      }
    } else {
      // Unknown authored props retain a modest storage silhouette, never a sprite.
      box(wood, 0, h * 0.5, 0, w * 0.68, h, d * 0.68);
      for (const by of [0.12, h - 0.12]) {
        box(iron, 0, by, -d * 0.35, w * 0.69, 0.035, 0.025);
      }
    }
    const built = part.finish(`prop:${prop.id}`);
    if (!prop.destroyed) {
      applyStructureWear(built, prop.structureDamage ?? 0, prop.x, prop.y, h);
    }
    batch.take(built, frame.matrix);
  }
  const group = batch.finish(`props:${id}`);
  group.userData['kind'] = 'props';
  group.userData['semanticIds'] = props.map((prop) => `prop:${prop.id}`);
  return group;
}

/** Destroyed records retain their footprint and identity, with no intact body. */
export function addStructureDebris(
  batch: WorldBatch,
  materials: WorldMaterialSource,
  source: {
    type: string;
    material?: string;
    x: number;
    y: number;
    width: number;
    depth: number;
    light: number;
  },
) {
  const { type, material, x, y, width: w, depth: d, light } = source;
  const masonry = material === 'stone' || ['hearth', 'rubble'].includes(type),
    cloth = ['bed', 'sacks', 'rug'].includes(type);
  const kind = masonry
    ? 'stone'
    : type === 'pottery'
      ? 'ceramic'
      : type === 'hay'
        ? 'thatch'
        : type === 'sacks' || type === 'rug'
          ? 'linen'
          : 'wood';
  for (let n = 0; n < 9; n++) {
    const a = seeded(x, y, n + 611),
      b = seeded(y, x, n + 947),
      angle = a * Math.PI * 2;
    const rock = masonry || type === 'pottery',
      sw = Math.min(w * 0.12, 0.07 + a * 0.06),
      sd = Math.min(d * 0.4, rock ? 0.11 + b * 0.08 : 0.24 + b * 0.28),
      height = rock ? 0.055 + a * 0.04 : 0.035 + a * 0.025;
    // Conservative extents include every rotated vertex, on either level.
    const halfX = rock
        ? Math.hypot(sw, sd)
        : (Math.abs(Math.cos(angle)) * sw + Math.abs(Math.sin(angle)) * sd) * 0.5,
      halfZ = rock
        ? Math.hypot(sw, sd)
        : (Math.abs(Math.sin(angle)) * sw + Math.abs(Math.cos(angle)) * sd) * 0.5;
    const px = (a - 0.5) * Math.max(0, w - 2 * halfX) * 0.84,
      pz = (b - 0.5) * Math.max(0, d - 2 * halfZ) * 0.84;
    batch.primitive(
      rock ? 'rock' : 'box',
      materials.get(kind),
      [px, rock ? height : height * 0.5, pz],
      [sw, height, sd],
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
      light * (0.78 + 0.18 * b),
    );
  }
  if (cloth) {
    batch.primitive(
      'box',
      materials.get('linen'),
      [w * 0.08, 0.035, -d * 0.06],
      [w * 0.4, 0.04, d * 0.35],
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.1),
      light * 0.78,
    );
  }
  if (['cart', 'chest', 'barrels', 'door'].includes(type)) {
    for (let n = 0; n < 2; n++) {
      const angle = n ? -0.4 : 0.5,
        sw = Math.min(0.045, w * 0.08),
        sd = Math.min(0.23, d * 0.28);
      batch.primitive(
        'box',
        materials.get('iron'),
        [(n - 0.5) * w * 0.3, 0.025, (0.5 - n) * d * 0.2],
        [sw, 0.025, sd],
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
        light * 0.88,
      );
    }
  }
}

/** Local wear changes vertex colour only; materials, geometry and light stay shared. */
export function applyStructureWear(
  group: Group,
  damage: number,
  x: number,
  y: number,
  height: number,
  base = 0,
) {
  const strength = Math.max(0, Math.min(1, damage / 100));
  if (!strength) {
    return;
  }
  const phase = seeded(x, y, 281) * Math.PI * 2;
  group.traverse((node) => {
    if (!isMesh(node)) {
      return;
    }
    const position = node.geometry.getAttribute('position'),
      colours = node.geometry.getAttribute('color');
    if (!colours) {
      return;
    }
    for (let n = 0; n < position.count; n++) {
      const patch = 0.5 + 0.5 * Math.sin(position.getX(n) * 8 + position.getZ(n) * 11 + phase),
        upper = Math.min(1, Math.max(0, (position.getY(n) - base) / Math.max(0.1, height))),
        shade = 1 - strength * (0.06 + 0.2 * patch + 0.05 * upper);
      colours.setXYZ(n, colours.getX(n) * shade, colours.getY(n) * shade, colours.getZ(n) * shade);
    }
  });
}

/** Small open joints show the board edges without adding another material. */
function boards(
  batch: WorldBatch,
  material: import('three').MeshStandardMaterial,
  light: number,
  w: number,
  d: number,
  y: number,
  thickness: number,
  count: number,
  z = 0,
) {
  const gap = Math.min(0.008, d * 0.015),
    board = (d - gap * (count - 1)) / count;
  for (let n = 0; n < count; n++) {
    batch.box(
      material,
      0,
      y,
      z - d * 0.5 + board * 0.5 + n * (board + gap),
      w,
      thickness,
      board,
      light,
    );
  }
}

import { Matrix4 as importMatrix } from 'three';
export function wheel(
  batch: WorldBatch,
  materials: WorldMaterialSource,
  light: number,
  x: number,
  y: number,
  z: number,
  radius: number,
) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.5);
  batch.primitive('torus', materials.get('wood'), [x, y, z], [radius, radius, radius], q, light);
  batch.primitive(
    'torus',
    materials.get('iron'),
    [x, y, z],
    [radius * 1.04, radius * 1.04, radius * 1.04],
    q,
    light,
  );
  batch.cylinder(
    materials.get('iron'),
    new Vector3(x - 0.055, y, z),
    new Vector3(x + 0.055, y, z),
    0.075,
    light,
  );
  for (let n = 0; n < 10; n++) {
    const a = n * Math.PI * 0.2;
    batch.cylinder(
      materials.get('wood'),
      new Vector3(x, y, z),
      new Vector3(x, y + Math.sin(a) * radius * 0.93, z + Math.cos(a) * radius * 0.93),
      0.021,
      light,
    );
  }
}
