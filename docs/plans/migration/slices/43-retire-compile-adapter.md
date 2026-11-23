# Slice 43: the retained compile adapter goes away

**Branch:** `migration/retire-compile-adapter`
**Intent:** Remove the last retained adapter that stood in front of the
campaign compiler, so the compiler is the only way to compile a campaign.

## Why this slice exists

[Slice 8](08-campaign-compiler.md) gave the game the `CampaignCompiler`
application service and made it the path the game and the campaign editor use.
One retained function was left standing in front of it:
`compileCampaignPackage`, in `packages/game/campaign-library.js`, which the
public entries still exported and `tools/campaign-export.mjs` still called.

The ubiquitous language lists that function as a compatibility name to retire.
With this slice, the compiler is the only path to a compiled campaign.

## What it changes

- `tools/campaign-export.mjs` compiles through the campaign compiler's public
  entry, the way the game and the editor already do.
- The public entries stop exporting the retained function.
- `packages/game/campaign-library.js` keeps the adapter that reads the shared
  campaign-file contract, because the compiler needs it, and loses the
  function that wrapped it.

## What it does not change

The compiled result, the rules the compiler applies, and the messages it
refuses with. The campaign export tool produces the same package.

## Tests

- The existing campaign export and editor validation tests keep passing, which
  proves the tool still compiles the same campaigns.
- A test proves the retained function is no longer exported by the public
  entries.

## Verification

- `npm test` passes, including the new test.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.47` to `0.2.48`.
