# ResumeSectorSession

Resume one suspended sector visit at the accepted campaign time. The request
contains its `sectorSessionId`. The response identifies the active visit.

The use case loads `GameSession` through `ResumeSectorSessionRepository` and
activates the existing registration. The repository saves the current visit,
then restores the selected visit's exact local state. Combat round, AP, equipment,
and unfinished orders remain attached to that visit. World conditions continue
through the common timeline while a visit is suspended.

An unresolved arrival decision prevents this operation. Each person and sector
can belong to only one open visit. Missing visits, duplicate participation,
unsynchronized progress, and stale commits refuse the complete operation.
