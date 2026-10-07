# Church 3D detail review — 7 October 2026

The visual references are the retained
[church exterior](../../assets/previews/buildings/church-exterior.png), the
[building catalogue](../../assets/previews/buildings/catalogue.png), and the
town-parish direction recorded in [the building art guide](buildings.md).
The catalogue renderer's curved masonry pediment is in
`web/app/TacticalBuildingDetails.tsx`. The retained exterior shows a round oculus,
strong corner trim, and tall dark bell openings. These are scale interpretations,
not measured reconstructions of a specific monument.

The 3D church now has a thick curved front crest joined to the existing gable,
a round barred oculus, solid-cell corner pilasters, and arched bell insets on
all four tower faces. The reserved tower foundation does not grow. Compact
churches retain their smaller supported tower. Bell-stage height follows the
actual roof rise, keeping the bell openings above the nave ridge. The complete exterior detail
group disappears when a ground room is inspected, as before.
Authored metric roof slabs and explicit terraces use their flat roof elevation;
their tower and front crest do not inherit the generated pitched-roof rise.
Parish and civic towers omit footprints that intersect an authored walkable
upper surface, including the broad base cornice. Parish towers can use an
intact opposite corner. Blocked upper cells and ground-level surfaces retain
the supported tower. These checks do not change collision or movement rules.

Use **Catálogo de edificios → Iglesia parroquial → Exterior** in the playable
renderer sandbox. Compare all four orientations, then **Primera sala** and
**Interior completo**. Those views use compiled templates and ordinary door and
movement orders. Geometry tests check rotation, shell contact, circular oculus
dimensions, tower support, open door/window/breach paths, and room cutaways.
Tests establish those structural properties. Live captures of the exterior
at 0° and 90°, plus the full interior at 270°, were compared with the retained
exterior and catalogue. The crest, oculus and taller bell stage remain readable;
interior disclosure removes the external details. The plaster surface now uses
the retained sprite material at a consistent size. These samples establish the
stated comparison, not every building variant or a measured reconstruction.
