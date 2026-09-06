// Reproducible close views of the actual game renderer, not concept art.
// Run from any directory: node tools/preview-architecture-catalog.mjs [output-directory]
import { register } from "node:module";
register("../tests/tactical-render-loader.mjs", import.meta.url);
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import sharp from "../web/node_modules/sharp/lib/index.js";
import { BUILDING_TEMPLATES } from "../game/map-templates.js";
import { blankMap, serializeMap, validateMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
import { compileMap, reachableMap } from "../game/compile-map.js";
import { propBlocksAt } from "../game/props.js";
const { default: TacticalScene } = await import("../web/app/TacticalScene.tsx");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overviewOnly = process.argv.includes("--overview-only");
const interiorOnly = process.argv.includes("--interior-only");
const selectedNames = process.argv
  .find((arg) => arg.startsWith("--buildings="))
  ?.slice("--buildings=".length)
  .split(",");
const selectedMode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length);
if (selectedNames?.some((name) => !Object.hasOwn(BUILDING_TEMPLATES, name)))
  throw Error("Unknown building in --buildings.");
if (selectedMode && !["exterior", "interior"].includes(selectedMode))
  throw Error("--mode must be exterior or interior.");
if (selectedMode && (overviewOnly || interiorOnly))
  throw Error("Use --mode or a focused shortcut, not both.");
if (overviewOnly && interiorOnly) throw Error("Choose either --overview-only or --interior-only.");
const output = resolve(
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
    resolve(root, "artifacts/architecture-catalog"),
);
const rotations = overviewOnly ? [0] : [0, 90, 180, 270],
  modes = selectedMode
    ? [selectedMode]
    : interiorOnly
      ? ["interior"]
      : overviewOnly
        ? ["exterior"]
        : ["exterior", "interior"];
await mkdir(output, { recursive: true });
let previousReview = [];
try {
  previousReview =
    JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8")).buildings ?? [];
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const allEntries = Object.entries(BUILDING_TEMPLATES),
  entries = allEntries.filter(([id]) => !selectedNames || selectedNames.includes(id)),
  rasterCache = new Map(),
  review = previousReview.filter((v) => !entries.some(([id]) => id === v.id));
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const css = `:root{color-scheme:dark;font:16px/1.5 system-ui;background:#20231f;color:#eee7d7}body{margin:0 auto;max-width:1500px;padding:24px}a{color:#e8c586}h1{font-size:1.65rem}h2{font-size:1.1rem}p{max-width:90ch}nav,fieldset{display:flex;gap:16px;align-items:center;flex-wrap:wrap}fieldset{border:1px solid #666755;margin:20px 0}select,button{font:inherit;background:#34382f;color:inherit;border:1px solid #747866;border-radius:4px;padding:8px}button{cursor:pointer}.catalog{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px}article{border:1px solid #555c4d;padding:16px;border-radius:6px}img{display:block;width:100%;height:auto;background:#b4a387}.catalog img{aspect-ratio:4/3;object-fit:contain}small{display:block;color:#cbc5b5}.stage{background:#b4a387}.stage img{max-height:85vh;object-fit:contain}a.full{display:block;margin:12px 0}.criteria{padding:16px;background:#2c3028}code{color:#e8c586}`;
const html = (title, body) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${css}</style>${body}</html>`;
function apply(document, commands) {
  const result = applyMapCommands(document, commands);
  if (result.errors.length) throw Error(result.errors.join("\n"));
  return result.document;
}
function createDocument(id, template) {
  const side = Math.max(template.building.width, template.building.height) + 6;
  const blank = blankMap({
    id: `architecture-${id}`,
    title: template.name,
    width: side,
    height: side,
  });
  blank.terrain = blank.terrain.map((t) => ({ ...t, type: "road" }));
  return apply(blank, [
    { type: "stampTemplate", id, template, x: 3, y: 3 },
    {
      type: "addObject",
      layer: "spawns",
      object: { id: "review-player", side: "player", x: 1, y: 1 },
    },
  ]);
}
async function embeddedSvg(markup) {
  for (const url of new Set([...markup.matchAll(/href="(\/art\/[^\"]+)"/g)].map((m) => m[1]))) {
    if (!rasterCache.has(url)) {
      const png = await sharp(await readFile(resolve(root, "web/public", `.${url}`)))
        .png()
        .toBuffer();
      rasterCache.set(url, `data:image/png;base64,${png.toString("base64")}`);
    }
    markup = markup.replaceAll(`href="${url}"`, `href="${rasterCache.get(url)}"`);
  }
  return markup;
}
function renderer(map, revealed) {
  const building = map.buildings[0],
    project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
  const corners = [
    [building.x, building.y],
    [building.x + building.width - 1, building.y],
    [building.x, building.y + building.height - 1],
    [building.x + building.width - 1, building.y + building.height - 1],
  ].map(([x, y]) => project(x, y));
  const left = Math.min(...corners.map((p) => p.x)) - 90,
    right = Math.max(...corners.map((p) => p.x)) + 90,
    top = Math.min(...corners.map((p) => p.y)) - 270,
    bottom = Math.max(...corners.map((p) => p.y)) + 88;
  const width = right - left,
    height = bottom - top;
  const state = {
    ...map,
    tiles: map.tiles.filter(
      (t) =>
        t.x >= building.x - 2 &&
        t.x <= building.x + building.width + 1 &&
        t.y >= building.y - 2 &&
        t.y <= building.y + building.height + 1,
    ),
    units: [],
    npcs: [],
    artillery: [],
    smoke: [],
  };
  return renderToStaticMarkup(
    h(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: Math.ceil(width * 2),
        height: Math.ceil(height * 2),
        viewBox: `${left} ${top} ${width} ${height}`,
      },
      h("rect", { x: left, y: top, width, height, fill: "#b4a387" }),
      h(TacticalScene, {
        state,
        interactive: false,
        players: [],
        units: [],
        positions: {},
        poses: {},
        directions: {},
        reachable: [],
        sight: new Set(),
        revealed,
        project,
      }),
    ),
  );
}
for (const [id, template] of entries) {
  let document = createDocument(id, template);
  // A focused refresh retains the other views and their manifest records.
  const variants = (previousReview.find((v) => v.id === id)?.variants ?? []).filter(
    (v) => !rotations.includes(v.rotation) || !modes.includes(v.mode),
  );
  for (let turn = 0; turn < rotations.length; turn++) {
    const degrees = turn * 90,
      map = compileMap(document),
      b = map.buildings[0],
      reachable = reachableMap(map, { x: 1, y: 1 });
    const free = b.rooms.flatMap((r) => r.cells).filter((c) => !propBlocksAt(map, c.x, c.y));
    const errors = validateMap(document, { playable: true }).errors;
    if (errors.length || free.some((c) => !reachable.has(`${c.x},${c.y}`)))
      throw Error(`${id} ${degrees}° has an invalid walking route: ${errors.join("; ")}`);
    await writeFile(resolve(output, `${id}-${degrees}.json`), serializeMap(document));
    for (const mode of modes) {
      const name = `${id}-${degrees}-${mode}`,
        markup = renderer(map, new Set(mode === "interior" ? b.rooms.map((r) => r.id) : []));
      if (/(?:NaN|Infinity)/.test(markup)) throw Error(`${name} contains invalid geometry`);
      const svg = await embeddedSvg(markup);
      await writeFile(resolve(output, `${name}.svg`), svg);
      await sharp(Buffer.from(svg))
        .png()
        .toFile(resolve(output, `${name}.png`));
      variants.push({
        rotation: degrees,
        mode,
        svg: `${name}.svg`,
        png: `${name}.png`,
        map: `${id}-${degrees}.json`,
        freeInteriorTiles: free.length,
      });
    }
    document = apply(document, [{ type: "rotateObject", id }]);
  }
  variants.sort((a, b) => a.rotation - b.rotation || a.mode.localeCompare(b.mode));
  const viewModes = [...new Set(variants.map((v) => v.mode))],
    viewRotations = [...new Set(variants.map((v) => v.rotation))],
    previewMode = viewModes[0];
  review.push({
    id,
    name: template.name,
    kind: template.building.kind,
    width: template.building.width,
    height: template.building.height,
    rooms: template.building.rooms.length,
    previewMode,
    variants,
  });
  await writeFile(
    resolve(output, `${id}.html`),
    html(
      template.name,
      `<nav><a href="index.html">← Complete catalog</a><a href="catalog.json">Import all ${allEntries.length} buildings</a></nav><h1>${escape(template.name)}</h1><p>${template.building.width} × ${template.building.height} tiles · ${template.building.rooms.length} room(s). The view uses the game scene, the map compiler and the same template used by the web editor.</p><fieldset><legend>View</legend><label>Rotation <select id="rotation">${viewRotations.map((r) => `<option value="${r}">${r}°</option>`).join("")}</select></label><label>Roof <select id="mode">${viewModes.map((mode) => `<option value="${mode}">${mode}</option>`).join("")}</select></label><button id="previous">← Rotate</button><button id="next">Rotate →</button></fieldset><div class="stage"><img id="scene" src="${id}-0-${previewMode}.svg" alt="${escape(template.name)} · ${previewMode} · 0 degrees"></div><a class="full" id="full" href="${id}-0-${previewMode}.svg" target="_blank">Open full-size SVG</a><nav><a id="raster" href="${id}-0-${previewMode}.png">PNG image</a><a id="map" href="${id}-0.json">Import this map into the editor</a></nav><script>const name=${JSON.stringify(id)},rotation=document.querySelector('#rotation'),mode=document.querySelector('#mode'),variants=${JSON.stringify(variants.map(({ rotation, mode }) => ({ rotation, mode })))};function update(){for(const option of mode.options)option.disabled=!variants.some(v=>v.rotation==rotation.value&&v.mode===option.value);if(mode.selectedOptions[0].disabled)mode.value=variants.find(v=>v.rotation==rotation.value).mode;const file=name+'-'+rotation.value+'-'+mode.value;document.querySelector('#scene').src=file+'.svg';document.querySelector('#scene').alt=name+' · '+mode.value+' · '+rotation.value+' degrees';document.querySelector('#full').href=file+'.svg';document.querySelector('#raster').href=file+'.png';document.querySelector('#map').href=name+'-'+rotation.value+'.json'}rotation.onchange=mode.onchange=update;document.querySelector('#previous').onclick=()=>{rotation.selectedIndex=(rotation.selectedIndex+rotation.options.length-1)%rotation.options.length;update()};document.querySelector('#next').onclick=()=>{rotation.selectedIndex=(rotation.selectedIndex+1)%rotation.options.length;update()};update();</script>`,
    ),
  );
  console.log(
    `${id}: ${rotations.length * modes.length} refreshed views and ${rotations.length} playable maps`,
  );
}
let catalog = blankMap({
  id: "architecture-catalog",
  title: "Catálogo de arquitectura colonial",
  width: 64,
  height: 64,
});
catalog.terrain = catalog.terrain.map((t) => ({ ...t, type: "road" }));
// Pack from the authored footprints so new templates cannot overflow a fixed grid.
const stamps = [];
let shelfX = 3,
  shelfY = 3,
  shelfHeight = 0;
for (const [id, template] of allEntries) {
  const { width, height } = template.building;
  if (shelfX + width > catalog.width - 3) {
    shelfX = 3;
    shelfY += shelfHeight + 3;
    shelfHeight = 0;
  }
  if (width > catalog.width - 6 || shelfY + height > catalog.height - 3)
    throw Error(`The architecture catalog has no room for ${id}.`);
  stamps.push({ type: "stampTemplate", id, template, x: shelfX, y: shelfY });
  shelfX += width + 3;
  shelfHeight = Math.max(shelfHeight, height);
}
catalog = apply(catalog, [
  ...stamps,
  {
    type: "addObject",
    layer: "spawns",
    object: { id: "review-player", side: "player", x: 1, y: 1 },
  },
]);
const catalogErrors = validateMap(catalog, { playable: true }).errors,
  catalogMap = compileMap(catalog),
  catalogReachable = reachableMap(catalogMap, { x: 1, y: 1 });
if (catalogErrors.length) throw Error(catalogErrors.join("\n"));
for (const b of catalogMap.buildings) {
  const isolated = b.rooms.flatMap((r) => r.cells).find(
    (c) => !propBlocksAt(catalogMap, c.x, c.y) && !catalogReachable.has(`${c.x},${c.y}`),
  );
  if (isolated) throw Error(`${b.id} has an unreachable floor in the complete catalog.`);
}
await writeFile(resolve(output, "catalog.json"), serializeMap(catalog));
for (const entry of review)
  entry.previewMode ??= entry.variants.find((v) => v.rotation === 0)?.mode ?? "interior";
review.sort(
  (a, b) =>
    allEntries.findIndex(([id]) => id === a.id) - allEntries.findIndex(([id]) => id === b.id),
);
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      renderer: "web/app/TacticalScene.tsx",
      projection: { tileWidth: 52, tileHeight: 28 },
      buildings: review,
    },
    null,
    2,
  ) + "\n",
);
const criteria = `<div class="criteria"><strong>Review gates</strong><ul><li>Warm tactile lime plaster, stone and timber fit the approved town parish reference.</li><li>Clay roofs read as curved tile courses, with a ridge, eaves and thickness.</li><li>Towers, porches, chimneys and arcades have volume and join their buildings.</li><li>Every building has a different silhouette and a clear purpose.</li><li>Check all four rotations for gaps, floating parts, z-order defects and clipping.</li><li>Interior cutaways preserve tile-based rooms, furniture and walking routes.</li></ul><p>These files prove what the renderer produces. They do not replace human visual review. Open each close view at full size before accepting the set.</p></div>`;
await writeFile(
  resolve(output, "index.html"),
  html(
    "Colonial architecture review",
    `<h1>Colonial architecture review</h1><p>${review.length} templates · ${review.reduce((sum, v) => sum + v.variants.length, 0)} views · ${new Set(review.flatMap((v) => v.variants.map((view) => view.rotation))).size} rotation(s) · the actual game renderer. Select a building to compare its exterior and interior at a useful size.</p><nav><a href="catalog.json">Import the complete catalog</a><a href="manifest.json">View manifest</a><a href="overview.png">Overview PNG</a></nav>${criteria}<div class="catalog">${review.map((v) => `<article><h2><a href="${v.id}.html">${escape(v.name)}</a></h2><a href="${v.id}.html"><img loading="lazy" src="${v.id}-0-${v.previewMode}.svg" alt="${escape(v.name)} ${v.previewMode}"></a><small>${v.width} × ${v.height} tiles · ${v.rooms} room(s)</small><a href="${v.id}.html">Inspect close views →</a></article>`).join("")}</div>`,
  ),
);
const tileWidth = 720,
  tileHeight = 570,
  composite = [];
for (const [i, v] of review.entries()) {
  const x = (i % 2) * tileWidth,
    y = Math.floor(i / 2) * tileHeight;
  const frame = await sharp(resolve(output, `${v.id}-0-${v.previewMode}.png`))
    .resize(tileWidth, tileHeight - 40, { fit: "contain", background: "#b4a387" })
    .png()
    .toBuffer();
  const title = Buffer.from(
    `<svg width="${tileWidth}" height="40"><rect width="100%" height="100%" fill="#20231f"/><text x="16" y="27" font-family="sans-serif" font-size="20" fill="#eee7d7">${escape(v.name)} · ${v.width} × ${v.height}</text></svg>`,
  );
  composite.push({ input: title, left: x, top: y }, { input: frame, left: x, top: y + 40 });
}
await sharp({
  create: {
    width: tileWidth * 2,
    height: tileHeight * Math.ceil(review.length / 2),
    channels: 4,
    background: "#20231f",
  },
})
  .composite(composite)
  .png()
  .toFile(resolve(output, "overview.png"));
console.log(`Review: ${resolve(output, "index.html")}`);
