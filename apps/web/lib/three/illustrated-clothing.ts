import { required } from './required';
import { Mesh, MeshStandardMaterial } from 'three';

export type ClothingPaint = {
  key: string;
  part: 'outfit' | 'legwear';
  appearance: string;
  lod: number;
};

/** These roles belong to the retained native apparel atlas. Replacement
 * models, equipped garments, skin, equipment and horse materials opt out. */
export function clothingPaint(
  mesh: Mesh,
  material: MeshStandardMaterial,
  appearance?: string,
): ClothingPaint | undefined {
  if (!['worker', 'surgeon', 'woman-scout', 'woman-shawl'].includes(appearance ?? '')) {
    return;
  }
  const match = /^Human_(outfit|legwear)_LOD([012])$/.exec(mesh.name);
  const part = match?.[1],
    lod = Number(match?.[2]);
  if (
    !appearance ||
    (part !== 'outfit' && part !== 'legwear') ||
    !material.name.startsWith('Apparel_Atlas') ||
    material.map?.name !== 'Broad_Apparel_Pigment' ||
    material.map.channel !== 0
  ) {
    return;
  }
  return { key: `${appearance}:${part}:lod${lod}`, part, appearance, lod };
}

const vec = (values: number[]) => `vec3(${values.map((value) => value.toFixed(3)).join(', ')})`;
const colours: Record<string, number[][]> = {
  'worker:outfit': [
    [1.2, 1.22, 1.25],
    [0.55, 0.48, 0.4],
  ],
  'worker:legwear': [
    [1, 1, 1],
    [0.24, 0.31, 0.43],
  ],
  'surgeon:outfit': [
    [0.92, 0.88, 0.82],
    [1, 1, 1],
  ],
  'surgeon:legwear': [
    [1, 1, 1],
    [0.72, 0.75, 0.78],
  ],
  'woman-scout:outfit': [
    [0.78, 0.74, 0.7],
    [1, 1, 1],
  ],
  'woman-scout:legwear': [
    [1, 1, 1],
    [0.23, 0.18, 0.14],
  ],
  'woman-shawl:outfit': [
    [1.16, 1.18, 1.2],
    [0.94, 0.76, 0.76],
  ],
};

function garmentDetails(paint: ClothingPaint) {
  const key = `${paint.appearance}:${paint.part}`;
  // LOD0/1 retain a seam-strip palette entry absent from LOD2. Main cloth
  // tiles stay fixed, but later collar/belt tiles shift by one.
  const workerCollar =
    paint.lod === 2
      ? 'clothTile.x == 3.0 && clothTile.y == 3.0'
      : 'clothTile.x == 0.0 && clothTile.y == 2.0';
  const scoutBelt = workerCollar;
  const scoutCollar =
    paint.lod === 2
      ? 'clothTile.x == 0.0 && clothTile.y == 2.0'
      : 'clothTile.x == 1.0 && clothTile.y == 2.0';
  if (key === 'worker:outfit') {
    return `
    float front = smoothstep(0.07, 0.13, p.z);
    float openingWidth = max(0.0, p.y - 1.275) * 0.53;
    float opening = (1.0 - smoothstep(openingWidth - 0.004, openingWidth + 0.004, abs(p.x))) * smoothstep(1.275, 1.295, p.y) * front * secondCloth;
    float textureForm = clamp(dot(sourceCloth, vec3(0.3333)) / 0.093, 0.65, 1.35);
    vec3 linen = vec3(0.54, 0.47, 0.35) * textureForm;
    diffuseColor.rgb = mix(diffuseColor.rgb, linen, opening);
    float edge = exp(-pow((abs(p.x) - openingWidth) / 0.006, 2.0)) * front * secondCloth * smoothstep(1.28, 1.32, p.y);
    diffuseColor.rgb *= 1.0 - 0.40 * edge;
    // A centre fastening and three small horn buttons belong to the waistcoat.
    float buttonHeight = mod(p.y - 1.105 + 0.045, 0.09) - 0.045;
    float buttonDistance = length(vec2(p.x, buttonHeight));
    float buttonRow = step(1.08, p.y) * (1.0 - step(1.30, p.y)) * front * secondCloth;
    float button = (1.0 - smoothstep(0.006, 0.009, buttonDistance)) * buttonRow;
    float buttonEdge = (1.0 - smoothstep(0.009, 0.012, buttonDistance)) * buttonRow;
    diffuseColor.rgb *= 1.0 - 0.45 * buttonEdge;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.13, 0.066), button);
    // Existing wrist cuffs stay cloth. No painted skin replaces missing forearms.
    vec3 cuffDelta = vec3(abs(p.x) - 0.492, p.y - 1.089, p.z - 0.208);
    vec3 forearm = normalize(vec3(0.134, -0.127, 0.189));
    float cuffAlong = dot(cuffDelta, forearm);
    float cuff = exp(-pow((cuffAlong + 0.050) / 0.014, 2.0)) * (1.0 - smoothstep(0.065, 0.090, length(cuffDelta - forearm * cuffAlong))) * step(0.30, abs(p.x));
    diffuseColor.rgb *= 1.0 - 0.27 * cuff * firstCloth;
    float collar = float(${workerCollar}) * step(1.46, p.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.47, 0.35), collar);
  `;
  }
  if (key === 'woman-scout:outfit') {
    return `
    float front = smoothstep(0.07, 0.13, p.z);
    float openingWidth = 0.027 + 0.055 * smoothstep(1.28, 1.47, p.y);
    float frontHeight = smoothstep(1.075, 1.095, p.y) * (1.0 - smoothstep(1.47, 1.50, p.y));
    float opening = (1.0 - smoothstep(openingWidth - 0.004, openingWidth + 0.004, abs(p.x))) * frontHeight * front * firstCloth;
    float textureForm = clamp(dot(sourceCloth, vec3(0.3333)) / 0.101, 0.65, 1.35);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.47, 0.35) * textureForm, opening);
    float edge = exp(-pow((abs(p.x) - openingWidth) / 0.006, 2.0)) * frontHeight * front * firstCloth;
    diffuseColor.rgb *= 1.0 - 0.42 * edge;
    // Two quiet pocket openings and seams, without adding bags or equipment.
    float pocket = (1.0 - smoothstep(0.022, 0.027, abs(abs(p.x) - 0.118))) * exp(-pow((p.y - 1.16) / 0.005, 2.0)) * front * firstCloth;
    diffuseColor.rgb *= 1.0 - 0.32 * pocket;
    // The authored White_Waist_Belt uses the LOD-specific cream tile.
    // Its tile/height boundary excludes the blouse, collar and brass hardware.
    float belt = float(${scoutBelt}) * step(1.038, p.y) * (1.0 - step(1.074, p.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.070, 0.039, 0.020) * clamp(sourceCloth.r / 0.64, 0.8, 1.2), belt);
    float collar = float(${scoutCollar}) * step(1.46, p.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.47, 0.35), collar);
  `;
  }
  if (key === 'woman-shawl:outfit') {
    return `
    float cloth = max(firstCloth, secondCloth);
    float front = smoothstep(0.035, 0.10, p.z);
    float torso = 1.0 - smoothstep(0.19, 0.23, abs(p.x));
    float bottom = 1.105 + 0.76 * abs(p.x + 0.025);
    float wrap = smoothstep(bottom - 0.006, bottom + 0.006, p.y) * torso;
    // Keep shoulder drape, and continue its pigment down the existing blouse.
    wrap = max(wrap, secondCloth * smoothstep(1.32, 1.37, p.y));
    float openingWidth = max(0.0, p.y - 1.255) * 0.44;
    float opening = (1.0 - smoothstep(openingWidth - 0.004, openingWidth + 0.004, abs(p.x))) * front * smoothstep(1.255, 1.285, p.y);
    wrap *= 1.0 - opening;
    float textureForm = clamp(dot(sourceCloth, vec3(0.3333)) / mix(0.48, 0.055, secondCloth), 0.65, 1.35);
    vec3 linen = vec3(0.60, 0.52, 0.38), burgundy = vec3(0.083, 0.018, 0.028);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(linen, burgundy, wrap) * textureForm, cloth);
    float border = exp(-pow((p.y - bottom) / 0.007, 2.0)) * torso;
    float overlap = exp(-pow((p.y - 1.29 - 0.85 * p.x) / 0.008, 2.0)) * front;
    diffuseColor.rgb *= 1.0 - cloth * wrap * (0.32 * border + 0.28 * overlap);
  `;
  }
  return '';
}

/** Pigment follows bind-space cloth coordinates, so it moves with the existing
 * skin and morphs. It does not move vertices or bake a camera/light direction. */
export function paintClothingShader(
  shader: { vertexShader: string; fragmentShader: string },
  paint: ClothingPaint,
) {
  const colour = colours[`${paint.appearance}:${paint.part}`];
  if (!colour) {
    return;
  }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vClothingRest;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClothingRest = position;');
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vClothingRest;',
  );
  const detail =
    paint.part === 'legwear'
      ? `
    // Broad knee and hip compression, with a quiet seam along the outside leg.
    float foldArea = exp(-pow((p.y - 0.55) / 0.11, 2.0)) + 0.45 * exp(-pow((p.y - 0.86) / 0.10, 2.0));
    float fold = sin(p.y * 69.0 + abs(p.x) * 29.0 + p.z * 15.0);
    float seam = exp(-pow((abs(p.x) - 0.135) / 0.009, 2.0)) * smoothstep(0.50, 0.70, p.y);
    float clothForm = 1.0 - 0.27 * max(0.0, fold) * foldArea + 0.08 * max(0.0, -fold) * foldArea - 0.16 * seam;
  `
      : `
    // Folds gather at the waist and elbows. Front plackets stay narrow, and
    // do not darken the face, belt hardware or other atlas palette tiles.
    float waist = exp(-pow((p.y - 1.08) / 0.075, 2.0));
    float elbow = exp(-pow((abs(p.x) - 0.36) / 0.09, 2.0)) * exp(-pow((p.y - 1.22) / 0.12, 2.0));
    float fold = sin(p.y * 63.0 + abs(p.x) * 31.0 + p.z * 18.0);
    float placket = exp(-pow(p.x / 0.007, 2.0)) * smoothstep(0.08, 0.14, p.z) * smoothstep(1.04, 1.10, p.y) * (1.0 - smoothstep(1.39, 1.46, p.y));
    float clothForm = 1.0 - (0.23 * waist + 0.22 * elbow) * max(0.0, fold) + 0.06 * max(0.0, -fold) * (waist + elbow) - 0.23 * placket;
  `;
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `#include <map_fragment>
  #ifdef USE_MAP
    // Four-by-four source palette: folds and broad pigment use only the two
    // cloth tiles. Explicit collar/belt masks below admit their native trim
    // tiles within authored height bounds; other trim and leather stay exact.
    vec2 clothTile = floor(vMapUv * 4.0);
    float firstCloth = float(clothTile.x == 0.0 && clothTile.y == 3.0);
    float secondCloth = float(clothTile.x == 1.0 && clothTile.y == 3.0);
    vec3 p = vClothingRest;
    vec3 sourceCloth = diffuseColor.rgb;
    ${detail}
    vec3 clothPigment = mix(vec3(1.0), ${vec(required(colour[0]))}, firstCloth);
    clothPigment *= mix(vec3(1.0), ${vec(required(colour[1]))}, secondCloth);
    diffuseColor.rgb *= clothPigment * mix(1.0, clamp(clothForm, 0.57, 1.15), max(firstCloth, secondCloth));
    ${garmentDetails(paint)}
  #endif`,
  );
}
