# Squad orders on the campaign map

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The original interface verification below is from 12 September 2026. The current controls and road costs were updated on 9 October 2026; see [sector road evidence](../../verification/sector-roads-2026-10-09.md). These checks do not establish full JA2 parity.

## Reference and controls

The user supplied [Traveling South](https://www.youtube.com/watch?v=D36iuSGsFdk). The opening minute shows the compact roster with location and destination columns, a map route with an ETA, and the clock on the same screen. The full [92-video gameplay playlist](https://www.youtube.com/playlist?list=PLvqxe4XbcSiHQibcWJweNuoDEUKHwlZuW) is reference material for subsequent work. Only the early movement sequence was sampled for this change; the entire playlist has not been reviewed.

1. Open **Destino** for a person in the left roster. This selects that person's real squad. Map squad markers also select their existing squad.
2. Point at a destination to preview a legal path. Click to choose it. The route controls show the path, travel hours and transport.
3. Click the chosen destination again, or select **Confirmar ruta**, to queue that squad's order.
4. Select **Avanzar** to move time forward. Every marching squad advances, including unselected squads. An enemy approach stops at the boundary for the existing coordinated-assault controls.
5. Escape, right-click, or **Cancelar trazado** removes an unconfirmed draft. Open the person's **Destino** menu to stop, return, or resume an existing journey. Ready assault controls remain explicit on the map.

Squad markers follow actual progress along the current leg. Returning markers move back over elapsed ground. The table shows each squad's actual location, destination and remaining hours. Soldiers in the selected squad are highlighted in the roster; other contracted soldiers remain available for dossier inspection.

At desktop sizes the roster and map share a bounded viewport, with the clock below. Sector and personal controls open in closable dialogs. Narrow screens stack the panels and retain their controls.

## Original interface evidence — 12 September 2026

- `strategic-route.test.mjs`: read-only preview without traversing tactical snapshots; real queued path and ETA; save continuation; independent second-squad orders; pending battles/encounters, assignments, sleep and existing-route rejection; assault-boundary arrival; transport availability and duration.
- `strategic-route-render.test.mjs`: empty Retiro start; resumed destination and travel controls; separate draft path with no dispatch; squad selection versus dossier selection.
- The 1,584-test suite passed before adding four rendering checks. Those four checks and the five new route tests then passed together. The final 48 focused checks, type checking and production build passed both in the isolated gameplay checkout and in the shared checkout.
- Live isolated production components: map-marker and roster selection, invalid Salta destination with disabled confirmation, Escape and right-click cancellation, confirmation by second map click and by button, and two separate squads advancing from 12/24 hours to 10/23 hours. The user's saved campaign was not changed by the test harness.
- Browser layout checks: at 1024 × 640, all four main panels remain in the viewport with no page overflow; at 390 × 844, panels stack with vertical scrolling and zero horizontal overflow. The wider desktop view was inspected visually.

## Remaining scope

Selecting another destination during a draft adds the prior destination as a waypoint. Foot and horse routes choose the fastest open land route using connected road sectors; off-road waypoints permit patrol detours. Adjacent districts of one city cost one hour per step. Direct map editing of committed paths, coordinated multi-selection and a richer uncertain-enemy intelligence model remain open. Attack destinations must be adjacent under the campaign staging rules.

Regional definitions distinguish urban, wetland, river, scrub, foothill, forest and mountain sectors. See [regional terrain and weather](regional-conditions.md) for the implementation and its limits. The road update adds fresh land approaches while preserving authored landmark cores and saved terrain. It does not establish complete environmental parity.
