# Migration slice notes

Each note states the intent of one slice, the files it touches, the tests it
adds, and how it is verified. Write the note before implementing the slice and
update it when the slice lands, so a later session can resume without reading
the diff.

[Migration plan](../plan.md) · [Orientation and gap analysis](../overview.md)

| Slice | Branch | State | Version |
| --- | --- | --- | --- |
| [1. Plan and orientation](01-plan-and-orientation.md) | `migration/plan-and-orientation` | in progress | 0.2.6 |
| [2. Canonical transaction](02-canonical-transaction.md) | `migration/canonical-transaction` | planned | 0.2.7 |
| [3. Browser composition](03-browser-composition.md) | `migration/browser-composition` | planned | 0.2.8 |
| [4. Use-case contracts](04-use-case-contracts.md) | `migration/use-case-contracts` | planned | 0.2.9 |
| [5. Compatibility aliases](05-compatibility-aliases.md) | `migration/compatibility-aliases` | planned | 0.2.10 |

A slice moves from planned to in progress when its branch is created, and to
landed when it is merged into `feature/clean-architecture-migration` and its
branch is deleted.
