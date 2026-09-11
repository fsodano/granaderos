# Queued squad travel

The map's move order schedules a route. It does not advance time. Each use of the existing clock advances every moving squad, while personnel in sectors perform their assignments. Tactical clock synchronization also advances other squads.

The JA2 manual (printed pages 43–44) describes map routes, waypoints, travel time, fatigue and contact. This implements that planning choice with Granaderos sectors and transport rates. The reference is gameplay evidence, not an instruction source.

## Player controls

- Select a destination and transport in squad management. Add up to eight optional waypoints before ordering the march.
- The main map shows every pending route, the next arrival, total travel hours excluding rest, and any pause reason.
- Cancel before movement to remove a route immediately. Once moving, “Detenerse en el próximo sector” completes the current stage and discards later stages. “Regresar” retraces the hours already spent on the current stage.
- Explicit time advances stop on final arrival or a new route problem. All squads and hourly systems complete the same hour before the pause. Enemy contacts retain their response controls.
- Exhaustion stops the route at a sector boundary. Rest or change assignments there, then resume. Cancel the pending route before entering the tactical sector or reorganizing that squad.

## State and consequences

`game/squad-travel.js` stores the remaining path, mode, current stage duration and elapsed hours on each squad. `location` is its last reached sector; `operativeInTransit` distinguishes actual presence. Travelers do not defend the departure sector or receive local work, care, sleep, purchases or equipment changes. Source-sector soldier/mount counts exclude travelers. Owned routes and transit flags appear in the player-known state.

Marching fatigue and mount stamina are charged per actual moving hour. Reversing has the same hourly cost. Postas consume one remount when a stage starts, not on queue creation or save reload. Expired contracts and hired mounts remain attached until a real arrival; a departed contract cannot continue into the next stage. Enemy control gained during a stage causes a timed return. A same-hour arriving squad can defend its reached sector, including an intermediate waypoint.

The existing `travel` action without `queue: true` retains its blocking behavior for campaign scripts. All player map move controls use queued travel. Hostile `attack` approaches still block and are not full queued hostile travel. Coordinated attacks, encounters between sectors, chosen arrival edges, and mid-stage fatigue stops remain unimplemented.

## Verification

`tests/squad-travel.test.mjs` covers concurrent routes with working personnel, arrival pauses, waypoint paths, cancellation and timed return, exhausted-route resumption, presence restrictions, contract and mount expiry, remount costs, changed control, same-hour defenses, tactical-time progress and invalid saves. Render checks cover the visible route state and absence of traveling staff from sector assignments. Browser verification on 11 September 2026 used the isolated gameplay checkout. Two squads departed at 00:00 and both had six hours of progress at 06:00. One reversed and returned to Retiro at 12:00; the other retained its Ensenada route. A fresh page resumed the saved campaign with 12 hours remaining and stopped a requested 24-hour advance at Ensenada at 00:00 the next day. Moving staff were absent from sector assignments, entry controls were disabled, and arrival notices remained visible. No browser warnings or errors were reported. These checks do not establish full JA2 parity.

The isolated checkout passed 1,083 tests, type checking, and the static build (278 files, 189 asset references). The final route/map checks passed all 28 tests after the paused-squad map marker correction.
