# Faction policy implementation

Implemented 2026-09-05 as part of the continuing full-game objective. These are
explicit game-balance rules, not claims about historical tariff percentages.

- Foreign reputation changes actual imported cargo prices: 60+ grants 20% off,
  40+ grants 10% off, below 20 adds 20%. Negative standing still prevents orders.
  Existing 72–120-hour arrival and blockade rules remain authoritative.
- A paid renewal for a foreign recruit adds 5 foreign reputation, at most once
  per recruit in 24 hours. The saved pay marker prevents repeated rewards from
  buying extra days at the same time, including after reload. Domestic renewals,
  free service and rejected payments do not add foreign reputation. This makes
  Brown's existing 30-reputation requirement reachable with modern contracts.
- Every seven days the Directory requests 120 pesos. The Cabildo offers payment
  once per period (+8 reputation). A missed period costs 8 reputation at the next
  deadline. This is a voluntary player decision with a persisted period marker.
- Weekly neglect of either emancipation or officer commissions loses 3 Pardo
  reputation. Both existing decisions remove that continuing penalty.
- Requisitions grant 200 pesos and require 14 days between uses. The shared
  cooldown survives saves.
- A Cuyo frontier requisition grants 160 pesos, reduces indigenous/gaucho
  standing and local loyalty, and breaks an existing parliament. Hostile frontier
  relations cause weekly recovery raids against an owned Cuyo sector: up to 100
  pesos lost and three days of regional economic disruption.

Entry points: Escritorio → Cabildo and Maestranza. Tests in
`tests/politics-web.test.mjs` exercise reducer orders, real import charges,
weekly deadlines, finite requisitions, consequences, and malformed-save rejection.

Still outstanding from the original faction specification: privateering prize
contracts, full individual estate livestock recovery, dedicated frontier combat
encounters and broad faction-specific military doctrines. This document does not
claim those systems are complete.
