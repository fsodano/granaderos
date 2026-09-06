import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyTacticalAssets, ARCHITECTURE_MATERIALS } from "../tools/verify-tactical-assets.mjs";
test("current tactical atlases, terrain, scenery and architecture satisfy the static build contract", async () => {
  await verifyTacticalAssets(new URL("../web/public", import.meta.url).pathname);
});
test("unconscious frames contain authored breathing while corpses are distinct still images", async () => {
  const meta = JSON.parse(
    await readFile(new URL("../assets/web/pixel/manifest.json", import.meta.url), "utf8"),
  );
  for (const family of ["granadero", "royalist", "civilian"]) {
    const breathing = meta.atlases[`${family}-unconscious-breathe`],
      dead = meta.atlases[`${family}-dead-idle`];
    assert.equal(breathing.fps, 2);
    assert.equal(breathing.frames.length, 64);
    assert.equal(dead.frames.length, 8);
    for (const direction of meta.directions) {
      const frames = breathing.frames.filter((f) => f.direction === direction);
      assert.ok(
        new Set(frames.map((f) => f.source_sha256)).size >= 3,
        `${family} ${direction} must actually breathe`,
      );
      assert.notEqual(
        frames[0].source_sha256,
        dead.frames.find((f) => f.direction === direction).source_sha256,
      );
    }
  }
  for (const family of ["granadero", "royalist"]) {
    const armed = meta.atlases[`${family}-prone-armed-idle`],
      unarmed = meta.atlases[`${family}-prone-unarmed-idle`];
    for (let i = 0; i < 8; i++)
      assert.notEqual(armed.frames[i].source_sha256, unarmed.frames[i].source_sha256);
  }
});
test("native pixel sprites reject stale layouts, missing families, duplicate frames and changed idle pixels", async () => {
  const root = await mkdtemp(join(tmpdir(), "granaderos-pixel-"));
  try {
    await cp(new URL("../web/public/art", import.meta.url), join(root, "art"), { recursive: true });
    const path = join(root, "art/pixel/manifest.json"),
      original = await readFile(path, "utf8");
    for (const alter of [
      (m) => delete m.atlases["cavalry-walk"],
      (m) => (m.atlases["granadero-idle"].cell = 192),
      (m) => (m.atlases["granadero-prone-unarmed-idle"].anchor[1] = 46),
      (m) => (m.atlases["royalist-walk"].frames[1] = m.atlases["royalist-walk"].frames[0]),
      (m) => (m.atlases["granadero-fire"].frames[0].bounds[0] = 0),
    ]) {
      const meta = JSON.parse(original);
      alter(meta);
      await writeFile(path, JSON.stringify(meta));
      await assert.rejects(verifyTacticalAssets(root), /native pixel sprite/);
    }
    await writeFile(path, original);
    const atlas = join(root, "art/pixel/granadero-idle-atlas.png"),
      bytes = await readFile(atlas);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(atlas, bytes);
    await assert.rejects(verifyTacticalAssets(root), /checksum mismatch.*pixel\/granadero-idle/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("all 1704 native frames and their authored exports match the served assets", async () => {
  const root = new URL("../assets/web/pixel/", import.meta.url),
    served = new URL("../web/public/art/pixel/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(
    Object.values(manifest.atlases).reduce((sum, a) => sum + a.frames.length, 0),
    1704,
  );
  for (const name of ["manifest.json", ...Object.values(manifest.atlases).map((a) => a.file)])
    assert.deepEqual(await readFile(new URL(name, root)), await readFile(new URL(name, served)));
});
test("build verification rejects missing dynamic scenery and altered combat pixels before staging", async () => {
  const root = await mkdtemp(join(tmpdir(), "granaderos-assets-"));
  try {
    await cp(new URL("../web/public/art", import.meta.url), join(root, "art"), { recursive: true });
    const scenery = join(root, "art/scenery-poplar-v1.webp"),
      saved = await readFile(scenery);
    await rm(scenery);
    await assert.rejects(verifyTacticalAssets(root), /ENOENT/);
    await writeFile(scenery, saved);
    const atlas = join(root, "art/granadero-fire-atlas.png"),
      bytes = await readFile(atlas);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(atlas, bytes);
    await assert.rejects(verifyTacticalAssets(root), /checksum mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("civilian metadata and pixels reject broken layout, coverage, anchors and checksums", async () => {
  const root = await mkdtemp(join(tmpdir(), "granaderos-civilian-"));
  try {
    await cp(new URL("../web/public/art", import.meta.url), join(root, "art"), { recursive: true });
    const path = join(root, "art/civilian-animation.json"),
      original = await readFile(path, "utf8");
    for (const alter of [
      (m) => (m.anchor[1] = 0.5),
      (m) => (m.frame_size[0] = 256),
      (m) => m.direction_rows.reverse(),
      (m) => (m.fps = 8),
      (m) => delete m.atlases.idle.sha256,
      (m) => (m.atlases.walk.frames[1] = m.atlases.walk.frames[0]),
      (m) => (m.atlases.walk.frames[0].bounds[0] = 0),
    ]) {
      const meta = JSON.parse(original);
      alter(meta);
      await writeFile(path, JSON.stringify(meta));
      await assert.rejects(verifyTacticalAssets(root), /civilian/);
    }
    await writeFile(path, original);
    const atlas = join(root, "art/civilian-walk-atlas.png"),
      bytes = await readFile(atlas);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(atlas, bytes);
    await assert.rejects(verifyTacticalAssets(root), /checksum mismatch.*civilian/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("authored and served civilian metadata and atlases are identical", async () => {
  for (const name of [
    "civilian-animation.json",
    "civilian-idle-atlas.png",
    "civilian-walk-atlas.png",
  ])
    assert.deepEqual(
      await readFile(new URL(`../assets/web/${name}`, import.meta.url)),
      await readFile(new URL(`../web/public/art/${name}`, import.meta.url)),
    );
});

test("every dynamic architecture renderer URL is registered by the static build verifier", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { ArchitectureDefs } = await import("../web/app/TacticalArchitectureMaterials.tsx");
  const { buildBuildingObjects } = await import("../web/app/TacticalBuildings.tsx");
  const { buildBuilding } = await import("../game/buildings.js");
  const base = buildBuilding({ id: "asset-review", x: 2, y: 2, width: 6, height: 5 });
  let markup = render(h("svg", null, h(ArchitectureDefs)));
  for (const roofFinish of ["clay", "aged", "thatch"]) {
    const objects = buildBuildingObjects({
      state: { tiles: base.tiles, buildings: [{ ...base.building, roofFinish }] },
      project: (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 }),
      light: () => 1,
      revealed: new Set(),
    });
    markup += objects.map((o) => render(o.node)).join("");
  }
  const actual = new Set(
    [...markup.matchAll(/href="(\/art\/architecture-[^"]+)"/g)].map((m) => m[1]),
  );
  const expected = new Set(
    ARCHITECTURE_MATERIALS.map((name) => `/art/architecture-${name}-v2.png`),
  );
  assert.deepEqual(actual, expected, "new dynamic material names must extend the build contract");
  const registered = new Set();
  await verifyTacticalAssets(new URL("../web/public", import.meta.url).pathname, (url) =>
    registered.add(url),
  );
  for (const name of actual) assert.ok(registered.has(name), name);
});

test("all six architecture PNGs reject missing files, wrong dimensions and altered pixels", async () => {
  const root = await mkdtemp(join(tmpdir(), "granaderos-architecture-"));
  try {
    await cp(new URL("../web/public/art", import.meta.url), join(root, "art"), { recursive: true });
    for (const material of ARCHITECTURE_MATERIALS) {
      const path = join(root, `art/architecture-${material}-v2.png`),
        original = await readFile(path);
      await rm(path);
      await assert.rejects(verifyTacticalAssets(root), /ENOENT/);
      const dimensions = Buffer.from(original);
      dimensions.writeUInt32BE(256, 16);
      await writeFile(path, dimensions);
      await assert.rejects(verifyTacticalAssets(root), /Invalid architecture material dimensions/);
      const altered = Buffer.from(original);
      altered[altered.length - 1] ^= 1;
      await writeFile(path, altered);
      await assert.rejects(verifyTacticalAssets(root), /architecture material checksum mismatch/);
      await writeFile(path, original);
    }
    await verifyTacticalAssets(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("architecture manifest records require dimensions, a checksum and matching provenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "granaderos-architecture-metadata-"));
  try {
    await cp(new URL("../web/public/art", import.meta.url), join(root, "art"), { recursive: true });
    const path = join(root, "art/manifest.json"),
      original = await readFile(path, "utf8");
    for (const change of [
      (a) => (a.width = 1024),
      (a) => (a.height = 256),
      (a) => (a.format = "WebP"),
      (a) => delete a.sha256,
      (a) => delete a.provenance,
      (a) => (a.provenance.asset = "unknown"),
    ]) {
      const manifest = JSON.parse(original),
        entry = manifest.assets.find((a) => a.path === "architecture-plaster-v2.png");
      change(entry);
      await writeFile(path, JSON.stringify(manifest));
      await assert.rejects(verifyTacticalAssets(root), /Invalid architecture manifest entry/);
    }
    const duplicate = JSON.parse(original);
    duplicate.assets.push(duplicate.assets.find((a) => a.path === "architecture-plaster-v2.png"));
    await writeFile(path, JSON.stringify(duplicate));
    await assert.rejects(verifyTacticalAssets(root), /Invalid architecture manifest entry/);
    const missing = JSON.parse(original);
    missing.assets = missing.assets.filter((a) => a.path !== "architecture-plaster-v2.png");
    await writeFile(path, JSON.stringify(missing));
    await assert.rejects(verifyTacticalAssets(root), /Invalid architecture manifest entry/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  const provenance = JSON.parse(
    await readFile(new URL("../docs/art/architecture-materials-v2.json", import.meta.url), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(new URL("../web/public/art/manifest.json", import.meta.url), "utf8"),
  );
  for (const name of ARCHITECTURE_MATERIALS) {
    const entry = manifest.assets.find((a) => a.path === `architecture-${name}-v2.png`),
      record = provenance.assets.find((a) => a.name === entry.provenance.asset);
    assert.equal(record.path, `web/public/art/${entry.path}`);
    assert.ok(record.prompt.length > 100);
    assert.equal(entry.generator, "OpenAI built-in image_gen");
  }
});
