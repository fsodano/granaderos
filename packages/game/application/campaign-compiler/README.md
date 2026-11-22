# CampaignCompiler

## Intention

Turn an admitted `CampaignDefinition` into runtime-playable domain objects. The compiler is the only path from the shared campaign-file contract into the game: it admits the authored documents, applies the runtime rules, resolves the defaults, and refuses a package the game cannot play.

## Actor and trigger

The campaign loader, the campaign editor's project validation, the playtest composition, and the static build exporter invoke the compiler after reading a `manifest.json` and its `content`, `world`, `maps`, `presentation`, and `assets` documents. The editor shows the compiler's refusal messages to the author, so those messages are part of the contract.

## Request

`CampaignCompilerRequest` contains:

- `manifest`: the parsed shared campaign manifest.
- `documents`: the parsed package documents `{ content, world, maps, presentation, assets }`.

Both are `unknown` because admitting them is part of this use case.

## Response

`CampaignCompilerResponse` is the `CompiledCampaignContent`: the authored `CampaignContent` with its resolved `world`, `maps`, `presentation`, `assets`, `scenario`, and `campaignOrigin` (`{ version: 1, id, revision }`).

## Refusals

Expected refusals throw `Error` with the authored message. The messages are stable byte for byte because the editor displays them:

- `La campaña necesita documentos válidos.` when the documents are not an object.
- The joined data-validation errors when the documents are not JSON or are too large or nested.
- `El contenido pertenece a otra campaña.` when the content identity differs from the manifest.
- `El contenido necesita una lista de characters.`, `weapons`, or `placements` when a required list is missing.
- The joined world-validation errors, at most twelve, when the strategic world is invalid.
- `La campaña necesita mapas tácticos.` when no map is present.
- `El mapa <id> tiene otra identidad.` when a map identifier is invalid or differs from its key.
- `Mapa <id>: se necesitan 20 columnas y 16 filas.` when a map is not the fixed campaign size.
- `Mapa <id>: <errors>` when the tactical map is not valid, with at most four map errors joined by `; `.
- `Mapa <id>: falta una aparición adversaria.` when a `generic-v1` map has no enemy spawn.
- `El mapa <id> necesita el estilo <architecture>.` when a building names a style the world does not declare.
- `Falta el mapa de la localidad <sector>.` when a world sector has no map.
- `Falta el mapa de la escena <scene>.` when a scene exit has no map.
- `La campaña necesita presentación y recursos.` when presentation or assets are missing.
- The joined asset errors, at most twelve, when the catalog or a selected asset does not match the package.
- The joined blocked content-report findings when the resolved campaign is not playable.

The shared contract's own admission errors surface unchanged because the repository constructs the `CampaignDefinition` before the compiler applies its rules.

## Invariants

- The repository admits the documents once by constructing `CampaignDefinition`; the compiler never re-admits a different copy.
- A campaign map is exactly 20 columns by 16 rows and keeps the identifier of its index entry.
- A `generic-v1` campaign map has at least one enemy spawn, and its resolved content starts without authored errands, roadside discoveries, or original residents.
- Every building names either no architecture or a style declared in `world.buildings.types`.
- Every world sector and scene exit has a map.
- The asset catalog and every selected asset reference belong to the package.
- The resolved content passes `campaignContentReport` without blocked findings.
- A refusal throws before `commit`, so the compilation context is the only state touched and no partially compiled content leaves the use case.

## Repository

`CampaignCompilerRepository` exposes `load(request)` and `commit(context, outcome)`. `load` returns the compilation context: the admitted `CampaignDefinition`, its manifest, and its immutable documents. `commit` stores the compiled response on the context; the compilation has no persistent store, so the accepted content leaves through `execute`.

`CampaignLibraryCompilerRepository` in `packages/game/campaign-library.js` is the adapter. It keeps the module's role of reading the shared campaign-file contract: it checks that the documents are an object and constructs the `CampaignDefinition`. The compiler lives in the application layer but imports the shared format and the retained runtime rule modules because it is the single declared bridge into the game; `tools/check-architecture.mjs` and `.dependency-cruiser.json` record that exception.

## Domain objects and related terms

- `CampaignDefinition` in `packages/campaign-format` owns the file schemas, content identity, and cross-reference admission.
- `validateCampaignWorld`, `validateMap`, `validateCampaignAssets`, `validateSelectedCampaignAssets`, `resolveContent`, and `campaignContentReport` enforce the runtime rules and produce the resolved content.
- `CampaignCompilerResponse` is the only compiled shape callers receive; the public entry `packages/game/public/campaign-compiler-api.ts` composes the use case with the repository.
