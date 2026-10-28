# EnterSector

`EnterSectorUseCase` opens an admitted sector visit. `SectorEntryRequest` identifies
the visit, sector, participants, and deployment requirement. The repository checks
the supplied campaign entry authority and physical scene before admission.

For a fresh visit, `SectorSession` creates the visit identity and admits each
participant once. Deployment starts when required. Perception starts after the
admitted positions exist. A resumed visit restores the same session, combat,
AP, health, equipment, pending operation, and clock. Restoration does not issue
equipment or budgets again.

`EnterSectorRepository` loads one admitted entry and commits one session at its
expected revision. `SnapshotEnterSectorRepository` maps campaign request fields,
retained scene data, and physical map construction. The legacy `enterSector`
export calls this use case for fresh and resumed visits.

Duplicate participants, wrong-sector snapshots, invalid scene context, and stale
commits are refused. A sector already open in the game uses
[AdmitSectorReinforcements](../admit-sector-reinforcements/README.md).
