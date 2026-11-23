# Slice 43: use the public campaign compiler entry

## Compiler boundary

`CampaignCompiler` in
[`packages/game/application/campaign-compiler/`](../../../../packages/game/application/campaign-compiler/)
applies runtime playability rules and resolves published campaign content.
[`createCampaignCompiler()`](../../../../packages/game/public/campaign-compiler-api.ts)
is the public composition entry; it constructs the compiler with
`CampaignLibraryCompilerRepository`. The repository adapter in
[`packages/game/campaign-library.js`](../../../../packages/game/campaign-library.js)
admits parsed manifest and document data as
[`CampaignDefinition`](../../../../packages/campaign-format/campaign-definition.ts),
the immutable value defined by the shared file contract. It does not read
browser files.

The browser loader is
[`apps/web/lib/campaign-library.ts`](../../../../apps/web/lib/campaign-library.ts).
It reads the registry, manifest, referenced documents, and maps, calls the
public compiler entry, then verifies referenced asset bytes. The static
exporter in [`tools/campaign-export.mjs`](../../../../tools/campaign-export.mjs)
and editor project validation use the same compiler entry.

Current source and public entries do not define or export
`compileCampaignPackage`. It is not the browser loader. The public compiler
entry is the supported composition path from campaign-file data to
runtime-playable content.

## Behavior to preserve

- The compiler receives the manifest and parsed campaign documents and returns
  resolved campaign content or throws a validation error.
- Runtime playability rules, compiled content, and refusal messages remain
  unchanged by the boundary.
- Browser loading stays in `apps/web/lib`; the campaign repository adapter
  stays in `packages/game`.
- Public entries do not export `compileCampaignPackage`; callers use
  `createCampaignCompiler()`.
