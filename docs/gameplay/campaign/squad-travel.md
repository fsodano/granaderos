# Queued squad travel

On the strategic campaign screen, the map's move order schedules a route. It does not advance time. Each use of the existing clock advances every moving squad, while personnel in sectors perform their assignments. Tactical clock synchronization also advances other squads.

The [original JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf) (printed pages 43–44) describes map routes, waypoints, travel time, fatigue and contact. This implements that planning choice with Granaderos sectors and transport rates. The reference is gameplay reference material, not an instruction source.

## Player controls

- Select a destination and transport in squad management. Add up to eight optional waypoints before ordering the march.
- Foot and horse routes use the physical sector grid and choose the fastest open land path. Roads connect through shared sector edges. Select off-road waypoints to detour around a reported patrol; the clock and ordinary enemy contact rules still apply.
- Adjacent sectors in one city take one hour, including the Buenos Aires–Retiro boundary. Rural road steps take two hours on foot, compared with four hours across open ground. Mountain road steps take four hours, compared with eight hours off road. Horses halve rural durations. A trip between city anchors can cross several districts and takes one hour per district step.
- The main map shows every pending route, the next arrival, total travel hours excluding rest, and any pause reason.
- Cancel before movement to remove a route immediately. Once moving, “Detenerse en el próximo sector” completes the current stage and discards later stages. “Regresar” retraces the hours already spent on the current stage.
- Explicit time advances stop on final arrival or a new route problem. All squads and hourly systems complete the same hour before the pause. Enemy contacts retain their response controls.
- Exhaustion stops the route at a sector boundary. Rest or change assignments there, then resume. Cancel the pending route before entering the tactical sector or reorganizing that squad.

## State and consequences

`game/squad-travel.js` stores the remaining path, mode, current stage duration and elapsed hours on each squad. `location` is its last reached sector; `operativeInTransit` distinguishes actual presence. Travelers do not defend the departure sector or receive local work, care, sleep, purchases or equipment changes. Source-sector soldier/mount counts exclude travelers. Owned routes and transit flags appear in the player-known state.

Marching fatigue and mount stamina are charged per actual moving hour. Reversing has the same hourly cost. Postas consume one remount when a stage starts, not on queue creation or save reload. Expired contracts and hired mounts remain attached until a real arrival; a departed contract cannot continue into the next stage. Enemy control gained during a stage causes a timed return. A same-hour arriving squad can defend its reached sector, including an intermediate waypoint.

An old saved journey keeps the duration stored for its current leg. New legs use the current road costs. Previously visited tactical sectors keep their saved terrain and damage; fresh rural and district maps draw roads only toward connected road neighbors. Postas, carts and flotillas retain their organized locality transport networks. Assault approaches between named campaign neighbors retain their existing staging rules; adjacent city approaches use the shorter city duration.

The existing `travel` action without `queue: true` retains its blocking behavior for campaign scripts. All player map move controls use queued travel. The map also queues adjacent hostile approaches and stages coordinated attacks at the sector boundary; see [coordinated attacks](coordinated-assault.md). Opposing routes produce [arrival contact](route-crossings.md). Exhausted soldiers finish the current stage, then [collapse and recover](../characters/sleep.md) before further travel, consistent with the classic source. Player-selected arrival positions are described in [sector arrival placement](sector-arrival-placement.md).
