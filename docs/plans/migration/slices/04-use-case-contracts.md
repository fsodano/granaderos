# Slice 4: uniform use-case contracts

**Intent:** Give every use case in `packages/game/application` the same
contract shape: a request file, a response file, a repository interface, a
use-case class, and a README.

## Why this slice exists

The accepted architecture requires that each migrated use case has "a readable
request, response, repository interface, class, tests, and short README", and
the repository instructions forbid compressed source and require that a use
case's names, types, and structure explain its behavior.

Every use-case folder already has a README and a repository interface. The
request and response types are unevenly placed: fifteen folders declare them
inside the use-case file or not at all, and `EnterSectorResponse` is declared
inline in `enter-sector.use-case.ts` while its siblings keep their responses
in their own file.

The rule that decides where a type lives is the naming rule in the
[ubiquitous language](../../accepted/ubiquitous-language.md): a use case is
named after one domain intention, and its request, response, repository, and
class share that stem. `EnterSector` with `SectorEntryRequest` is the one
recorded exception, and the glossary already explains it.

## What it changes

For every use-case folder under `packages/game/application`:

- A `<stem>.request.ts` file holds the request type.
- A `<stem>.response.ts` file holds the response type.
- The use-case file keeps the class and imports its request and response.

`EnterSector` keeps its recorded exception: the request stays
`SectorEntryRequest` in `sector-entry.request.ts`, and its response moves to
`enter-sector.response.ts`.

Every importer of a moved type is updated to the new module. No behavior
changes, and no domain name changes: the types keep their current names.

## Tests

- Existing use-case tests exercise the request and response contracts; moving
  the types does not change their names.
- A new test in `packages/game/application/` asserts the contract shape: every
  use-case folder has a README, a repository interface, a use-case class, a
  request module, and a response module, and each request and response module
  exports exactly one type. The test reads the folders from disk, so a future
  use case that skips a file fails the suite.
