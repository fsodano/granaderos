# Squad orders on the campaign map

On the strategic campaign screen, players preview, queue, cancel, and advance squad routes directly from the left roster and the geographic map.

## Reference and controls

In the [Traveling South](https://www.youtube.com/watch?v=D36iuSGsFdk) JA2 gameplay video (source `V` in [the parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)), the opening minute shows the compact roster with location and destination columns, a map route with an ETA, and the clock on the same screen. The full [92-video gameplay playlist](https://www.youtube.com/playlist?list=PLvqxe4XbcSiHQibcWJweNuoDEUKHwlZuW) is reference material for subsequent work. Only the early movement sequence is used as reference; the entire playlist has not been reviewed.

1. Open **Destino** for a person in the left roster. This selects that person's real squad. Map squad markers also select their existing squad.
2. Point at a destination to preview a legal path. Click to choose it. The route controls show the path, travel hours and transport.
3. Click the chosen destination again, or select **Confirmar ruta**, to queue that squad's order.
4. Select **Avanzar** to move time forward. Every marching squad advances, including unselected squads. An enemy approach stops at the boundary for the existing coordinated-assault controls.
5. Escape, right-click, or **Cancelar trazado** removes an unconfirmed draft. Open the person's **Destino** menu to stop, return, or resume an existing journey. Ready assault controls remain explicit on the map.

Squad markers follow actual progress along the current leg. Returning markers move back over elapsed ground. The table shows each squad's actual location, destination and remaining hours. Soldiers in the selected squad are highlighted in the roster; other contracted soldiers remain available for dossier inspection.

At desktop sizes the roster and map share a bounded viewport, with the clock below. Sector and personal controls open in closable dialogs. Narrow screens stack the panels and retain their controls.

## Remaining scope

Selecting another destination during a draft adds the prior destination as a waypoint. Foot and horse routes choose the fastest open land route using connected road sectors; off-road waypoints permit patrol detours. Adjacent districts of one city cost one hour per step. Direct map editing of committed paths, coordinated multi-selection and a richer uncertain-enemy intelligence model remain open. Attack destinations must be adjacent under the campaign staging rules.

Regional definitions distinguish urban, wetland, river, scrub, foothill, forest and mountain sectors. See [regional terrain and weather](regional-conditions.md) for terrain rules and their limits. Roads add fresh land approaches while preserving authored landmark cores and saved terrain.
