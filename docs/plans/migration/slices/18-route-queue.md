# Slice 18: the route queue into the domain

**Branch:** `migration/route-queue`
**Intent:** Move the queue that finds the cheapest route into the domain, next
to the journey route planner that uses it.

## Why this slice exists

`packages/game/route-queue.js` holds a data structure that is really a rule:
it orders the cells of a route by cost, and it is deliberately stable, so that
two cells of equal cost keep their insertion order. The comment says why:
replacing the former stable array sort must not change route or replay
decisions.

That stability is a rule about how the game chooses a path, and it belongs
with the journey route planner, which already lives in the domain at
`packages/game/domain/journeys/journey-route-planner.ts`. The queue is
self-contained: it imports nothing.

## What it adds

| File | Content |
| --- | --- |
| `packages/game/domain/journeys/route-queue.ts` | The queue |
| `packages/game/domain/journeys/route-queue.test.ts` | Its tests |

## What it changes

`packages/game/route-queue.js` keeps its module and its export, and becomes a
thin re-export of the domain module. The files that use it keep importing it
from the same place.

The ordering does not change: the cheapest cell comes first, two cells of
equal cost keep their insertion order, and the queue behaves as a priority
queue over the cells it holds.

## Tests

- `packages/game/domain/journeys/route-queue.test.ts` covers the queue: the
  cheapest cell comes out first, two cells of equal cost keep the order they
  were pushed in, a cell pushed later with a lower cost comes out first, the
  queue reports its length, and emptying it yields nothing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.22` to `0.2.23`.
