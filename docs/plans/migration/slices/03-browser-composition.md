# Slice 3: browser composition

**Branch:** `migration/browser-composition`
**Intent:** Move the construction of game object graphs out of the React
components and into the browser composition layer, and make the architecture
checker keep it there.

## Why this slice exists

The accepted architecture places browser composition in `apps/web`, and the
repository map says the player interface lives in `apps/web/app` while browser
adapters live in `apps/web/lib`. The source blurs that boundary:

- `apps/web/app/Recruitment.tsx` builds `GetRecruitmentCandidatesUseCase` and
  `CampaignGetRecruitmentCandidatesRepository` inside the render body, on every
  render, and reaches directly into the game application and infrastructure
  layers.
- `apps/web/app/page.tsx` builds `CampaignTalkToCharacterRepository` and
  `TalkToCharacterUseCase` inside an event handler and reaches into the same
  layers.
- `apps/web/app/Campaign.tsx` imports `ArrivalDecisionSnapshot`,
  `JourneyMode`, and `JourneyModeValue` from `packages/game/domain`.
- `apps/web/app/SaveProgress.tsx` imports `SaveState` and `SaveStatus` from an
  application repository interface.

A component states an intention and renders a result. Constructing the object
graph is composition, and composition belongs to `apps/web/lib`.

## What it adds

| File | Content |
| --- | --- |
| `apps/web/lib/recruitment-catalogue.ts` | The browser composition that reads the recruitment catalogue |
| `apps/web/lib/talk-to-character.ts` | The browser composition that runs a conversation |
| `packages/game/public/journey-types.ts` | The journey types the interface renders |
| `packages/game/public/save-types.ts` | The save status types the interface renders |
| `packages/game/public/refusal-api.ts` | The refusal message the interface shows |
| `tools/architecture-rules.ts` | The boundary rules the architecture checker applies, as testable functions |
| `tools/architecture-rules.test.ts` | Tests for those rules |

## What it changes

- `apps/web/app/Recruitment.tsx` reads the catalogue through the composition
  module and derives it with `useMemo`, so the query runs once per change of
  its inputs instead of once per render.
- `apps/web/app/page.tsx` runs a conversation through the composition module
  and reads the refusal message from the public entry.
- `apps/web/app/Campaign.tsx` and `apps/web/app/SaveProgress.tsx` read their
  types from the public entries.
- `packages/game/public/campaign-editor-api.ts` and
  `packages/game/public/game-persistence-api.ts` keep their current contents.
  `packages/game/package.json` publishes the three new entries.
- `packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js`
  gains the type annotations its callers now rely on.
- `tools/check-architecture.mjs` applies the new rule.

## The new rule

A file under `apps/web/app` may not import from `packages/game/domain`,
`packages/game/application`, or `packages/game/infrastructure`. The player
interface reaches the game through `packages/game/public` or through a browser
composition adapter under `apps/web/lib`.

`apps/web/lib` is the composition layer and keeps its access to the game
layers. The retained compatibility modules at the root of `packages/game` stay
reachable from the interface for now; moving them behind the public entries is
a later slice.

## Tests

- `tools/architecture-rules.test.ts` proves the rule refuses an interface file
  that imports a game layer, refuses it for each of the three layers, accepts a
  public entry, accepts a composition adapter, and accepts a retained
  compatibility module.
- `tests/recruitment-catalogue.test.ts` proves the composition module returns
  the same candidate identifiers the use case returns for the same campaign,
  and that the recruitment screen still finds a candidate by identifier.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.7` to `0.2.8`.
