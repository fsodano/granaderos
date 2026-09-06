import { readFile, writeFile } from "node:fs/promises";
import { parseMap, serializeMap, validateMap, blankMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
const [action, input, commandFile, output] = process.argv.slice(2);
try {
  if (action === "new") {
    await writeFile(input, serializeMap(blankMap()));
    console.log(input);
  } else if (action === "validate") {
    const doc = parseMap(await readFile(input, "utf8")),
      report = validateMap(doc, { playable: process.argv.includes("--playable") });
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } else if (action === "apply") {
    const doc = parseMap(await readFile(input, "utf8")),
      batch = JSON.parse(await readFile(commandFile, "utf8")),
      result = applyMapCommands(doc, batch.commands ?? batch, {
        expectedRevision: batch.expectedRevision ?? doc.revision,
      });
    if (result.errors.length) throw Error(result.errors.join("\n"));
    if (!output) throw Error("Falta la ruta de salida.");
    await writeFile(output, serializeMap(result.document));
    console.log(output);
  } else
    throw Error(
      "Usage: node tools/edit-map.mjs new MAP.json | validate MAP.json [--playable] | apply MAP.json COMMANDS.json OUTPUT.json",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
