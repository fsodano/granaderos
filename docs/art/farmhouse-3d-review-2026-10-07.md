# Farmhouse gallery and chimney review — 7 October 2026

The retained [estancia exterior](../../assets/previews/buildings/estancia-exterior.png)
and [building catalogue](../../assets/previews/buildings/catalogue.png) provide
the rural roof and chimney reference. The current 2D building renderer defines
the front and return galleries and paired side-wall chimneys in
`web/app/TacticalBuildingDetails.tsx`. These are art references, not measured
reconstructions of a named historic building.

The 3D farmhouse now has front and return gallery roof planes joined along one
mitred corner. Timber posts, stone feet, braces and beams remain within solid
authored wall cells. The shared roof edge has a rounded cap; the underside and
outer fascia are closed. Removing either side support omits that return.

Each side can carry a capped chimney on a solid wall cell. Chimney bodies retain
the authored wall finish, with stone caps and dark flues. Chimneys clear the
generated roof ridge and use zero pitched rise for metric slabs or explicit
terraces. Walkable upper cells exclude the corresponding chimney support.
Ordinary ground-room disclosure removes every exterior gallery and chimney
detail, preserving the existing interior view and movement rules.

Use **Catálogo de edificios → Casa de estancia → Exterior**. Compare all four
orientations, then **Primera sala** and **Interior completo**. Focused tests use
the actual compiled estancia template, normal room disclosure and ground-cell
bounds. Additional rays check front doors and edited side windows or breaches.
Live screenshots remain the visual acceptance step.

The live catalogue captured six estancia views without browser errors. Exterior
0° and 90° and interior 270° were visually reviewed against the current building
catalogue. The joined roof planes and both capped chimneys are visible. The
normal complete interior remains clear of exterior supports.
