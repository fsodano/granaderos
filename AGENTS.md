# Repository instructions

## Communication and deliverables

Prefer ASD-STE100-style communication: short, direct sentences, consistent terms,
and explicit actors and actions.

Every finished deliverable must be complete for a first-time reader. State the
current facts, decisions, plan, and requirements directly. Do not include drafting
history, abandoned options, removed figures, or commentary about earlier mistakes
unless the user requests a change log or comparison. Review the whole artifact
before delivery and remove sentences that require conversation history.

## Accepted architecture and ubiquitous language

Before architecture work, domain/application changes, or terminology changes,
read:

- [Accepted domain architecture](docs/plans/accepted/domain-architecture.md).
- [Ubiquitous language](docs/plans/accepted/ubiquitous-language.md).

These documents define the target architecture. Source and dated evidence define
current implementation. Preserve that distinction in plans, documentation, and
status reports. A planning task does not authorize implementation.

Use one glossary term for each concept across class and method names, use cases,
requests/results, repositories, tests, README files, documentation, and Spanish UI
translations. Use matching stems within each use-case folder, with only the
explicit naming pairs recorded in the glossary as exceptions. Before introducing
or renaming a term, define its scope, owner, lifecycle, translation, and naming
rationale in the glossary. Update all affected contracts in the same work slice.

The active sector visit is `SectorSession`; combat within it is `CombatSession`.
`SectorEntryRequest` is entry input. Use `RecruitCombatant` for recruitment and
`campaign-editor` for the editor package. Use the glossary for all other terms.

Existing API/save names may remain in explicit compatibility mappings until
migrated. Do not spread those aliases into new domain code or describe planned
behavior as shipped. Current user instructions take precedence; record changed
decisions in the accepted documents as part of the authorized work.

## Implementation direction

- Use `packages/game/domain`, `packages/game/application`, and `packages/game/infrastructure` inside the game
  package, with the independent editor in `apps/campaign-editor`.
- Give domain classes behavior and invariant ownership. Avoid public mutable
  state bags, unexplained constants, magic domain strings, and compressed source.
- Give each use case its own narrow repository interface over one logical game
  model. Share transaction, identity-map, mapping, and persistence infrastructure.
- Use read-only use cases over the same model. Keep domain and application code
  independent of UI and browser mechanisms.
- Preserve one authoritative character identity and item custodian. World state
  evolves over game time in visible and inactive sectors.
- Hostile arrival requires fight or withdraw and pauses campaign time. Withdrawal
  remains redirectable travel, including immediate reversal at zero elapsed time.
- Make names, types, structure, and methods carry intent. Comments may explain a
  necessary rationale or external rule source; they do not replace readable code.

## Repository layout

- Runnable applications belong in `apps/`; reusable game and file-contract packages
  belong in `packages/`.
- Authored campaigns and art sources belong in `content/`. Prepared browser media
  lives in `apps/web/public` and campaign package assets.
- Plans and evidence belong in `docs/plans` and `docs/evidence`. New local build,
  cache, and diagnostic output belongs in ignored `.output/`.
- The separate native build belongs in `reference/native`. Review applications
  belong in `tools/playgrounds`; they are not production game dependencies.
- Keep filesystem paths distinct from public browser URLs. Use the
  [repository map](docs/development/repository-layout.md) when adding a source or tool.

## Scope and verification

Preserve concurrent work. Inspect repository state, isolate implementation when
needed, and stage only owned paths. Do not clean or overwrite unrelated changes.

Implement accepted plans in scoped, reviewable slices. Test domain invariants,
refusals, partial progress, identity, time, save compatibility, and stale-result
handling as applicable. Use real domain objects in domain tests. Run the affected
tests and required repository checks; match the verification scope to the change.

For documentation-only work, check changed links, terminology, and whitespace.
Do not claim runtime validation from documentation review. Update relevant
use-case READMEs and the glossary when their contracts change.
