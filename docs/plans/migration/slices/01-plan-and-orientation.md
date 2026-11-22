# Slice 1: plan and orientation

**Branch:** `migration/plan-and-orientation`
**Intent:** Record the orientation survey and the migration plan so that the
series can be resumed, reviewed, and extended without repeating the survey.

## Why this slice exists

The accepted architecture in `docs/plans/accepted/domain-architecture.md`
describes the target. It does not say which parts of the source already meet
it, which do not, or in what order the remaining work should happen. That
survey was the first piece of work in this series, and it produced findings
that contradict several assumptions, including the belief that the use cases
were unwired.

The survey result is worth keeping for two reasons. A reviewer can check the
migration against a written statement of the current state instead of
re-deriving it. A later session can pick the series up from the notes here.

## What it adds

| File | Content |
| --- | --- |
| `docs/plans/migration/overview.md` | The orientation survey and the gap analysis |
| `docs/plans/migration/plan.md` | The slice sequence, branch flow, version policy, and verification strategy |
| `docs/plans/migration/slices/README.md` | The slice index and its states |
| `docs/plans/migration/slices/01-plan-and-orientation.md` | This note |

It also registers the folder in the plan index at `docs/plans/README.md`.

## What it changes in the source

Nothing. The slice touches no source file, no test, and no configuration.

## Verification

- `npm test` passes unchanged, with the same 452 tests as the baseline.
- `npm run check:format` and `npm run lint` pass over the new Markdown.
- The links in the new documents resolve.

## Version

`0.2.5` to `0.2.6`. The change is documentation only, but the series records
each slice in the version so that a deployment can name the slice it carries.
