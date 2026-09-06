import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const cli = new URL("../tools/edit-map.mjs", import.meta.url);
test("CLI creates, validates and edits maps atomically with revision checks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "granaderos-map-cli-"));
  try {
    const map = join(dir, "map.json"),
      commands = join(dir, "commands.json");
    const run = (...args) =>
      spawnSync(process.execPath, [cli.pathname, ...args], { encoding: "utf8" });
    assert.equal(run("new", map).status, 0);
    assert.equal(run("validate", map).status, 0);
    await writeFile(
      commands,
      JSON.stringify({
        expectedRevision: 0,
        commands: [{ type: "paintTerrain", cells: [{ x: 1, y: 1 }], terrain: "road" }],
      }),
    );
    assert.equal(run("apply", map, commands, map).status, 0);
    const saved = await readFile(map, "utf8");
    assert.equal(JSON.parse(saved).revision, 1);
    assert.equal(run("apply", map, commands, map).status, 1);
    assert.equal(await readFile(map, "utf8"), saved);
    await writeFile(
      commands,
      JSON.stringify([
        { type: "paintTerrain", cells: [{ x: 1, y: 1 }], terrain: "mud" },
        { type: "paintTerrain", cells: [{ x: 999, y: 1 }], terrain: "water" },
      ]),
    );
    assert.equal(run("apply", map, commands, map).status, 1);
    assert.equal(await readFile(map, "utf8"), saved);
    assert.equal(run("validate", map, "--playable").status, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
