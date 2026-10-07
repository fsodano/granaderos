# Posta and work canopy review — 7 October 2026

The current 2D building renderer defines the posta masonry veranda, warehouse
loading porch and smithy forge porch in `web/app/TacticalBuildingDetails.tsx`.
The retained [warehouse exterior](../../assets/previews/buildings/warehouse-exterior.png)
and [catalogue](../../assets/previews/buildings/catalogue.png) provide the broader
roof, timber and masonry reference. They do not establish measured historic
dimensions for these canopies.

The posta now uses masonry shafts with stone feet and capitals. Warehouse and
smithy canopies use timber posts, braces and beams. All three roofs have a
closed underside, timber fascia and slope-local texture coordinates. Authored
roof finishes remain authoritative. Ground supports stay within solid authored
wall cells; canopies require two intact supports and enough shell height to
clear standing doorways. Work canopies disappear when either entrance support
becomes a door, window or breach. Normal room disclosure removes the exterior
detail group.

Use **Catálogo de edificios** and select **Posta colonial**, **Almacén de
abastos** or **Herrería**. Review each exterior at four orientations, then
**Primera sala** and **Interior completo**. These are ordinary compiled maps
with normal movement, door and room rules. Focused tests check their actual
rotated ground cells and disclosure. The browser check captured 18 live views across these three templates without
errors. Exterior 0° and 90° captures and the warehouse 270° full interior were
visually compared with the retained catalogue. The posta piers meet the existing
shell and are subtle at this review scale. This is a supported canopy increment;
it does not establish final acceptance of every building detail.
