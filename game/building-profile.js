// Heights use the scene's vertical pixel scale; plan dimensions use map tiles.
// These profiles share the same colonial construction vocabulary but have
// different massing. Visual dimensions never change authored collision cells.
const PROFILES = {
  house: { wallHeight: 44, roofRise: 24, roofShape: "hip", eave: 0.2, plinthHeight: 8 },
  posta: { wallHeight: 48, roofRise: 25, roofShape: "hip", eave: 0.25, plinthHeight: 9 },
  barracks: { wallHeight: 54, roofRise: 24, roofShape: "gable", eave: 0.15, plinthHeight: 11 },
  church: { wallHeight: 64, roofRise: 38, roofShape: "gable", eave: 0.17, plinthHeight: 15 },
  chapel: { wallHeight: 53, roofRise: 30, roofShape: "gable", eave: 0.16, plinthHeight: 10 },
  cabildo: { wallHeight: 58, roofRise: 27, roofShape: "hip", eave: 0.2, plinthHeight: 12 },
  pulperia: { wallHeight: 45, roofRise: 24, roofShape: "hip", eave: 0.24, plinthHeight: 8 },
  warehouse: { wallHeight: 53, roofRise: 29, roofShape: "gable", eave: 0.2, plinthHeight: 14 },
  smithy: { wallHeight: 47, roofRise: 21, roofShape: "shed", eave: 0.17, plinthHeight: 12 },
  stable: { wallHeight: 42, roofRise: 30, roofShape: "gable", eave: 0.27, plinthHeight: 7 },
};

export function getBuildingProfile(building = {}) {
  return {
    ...(PROFILES[building.kind] ?? {
      wallHeight: 46,
      roofRise: 30,
      roofShape: "gable",
      eave: 0.18,
      plinthHeight: 7,
    }),
  };
}

/** An entrance-relative, rotation-preserving coordinate frame.
 * u runs across the front facade; v runs into the building. width/depth span
 * wall centrelines (tile-count minus one). at(u,v) returns world tile coords.
 * The first authored exterior door defines front; legacy shells use south.
 */
export function entranceFrame(b) {
  const x0 = b.x,
    y0 = b.y,
    x1 = b.x + b.width - 1,
    y1 = b.y + b.height - 1;
  const door = b.walls?.find(
    (w) => w.type === "door" && (w.x === x0 || w.x === x1 || w.y === y0 || w.y === y1),
  );
  const side =
    !door || door.y === y1 ? "south" : door.y === y0 ? "north" : door.x === x0 ? "west" : "east";
  const origin =
    side === "south"
      ? { x: x1, y: y1 }
      : side === "north"
        ? { x: x0, y: y0 }
        : side === "west"
          ? { x: x0, y: y1 }
          : { x: x1, y: y0 };
  const u =
    side === "south"
      ? { x: -1, y: 0 }
      : side === "north"
        ? { x: 1, y: 0 }
        : side === "west"
          ? { x: 0, y: -1 }
          : { x: 0, y: 1 };
  const v = { x: -u.y, y: u.x };
  const width = side === "north" || side === "south" ? b.width - 1 : b.height - 1;
  const depth = side === "north" || side === "south" ? b.height - 1 : b.width - 1;
  const doorU = door ? (door.x - origin.x) * u.x + (door.y - origin.y) * u.y : width / 2;
  return {
    side,
    origin,
    u,
    v,
    width,
    depth,
    doorU,
    door,
    at: (a, c) => ({ x: origin.x + u.x * a + v.x * c, y: origin.y + u.y * a + v.y * c }),
  };
}
