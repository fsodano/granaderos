# Coarse outer garment fit trial

[Art index](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Keep the worker LOD2 vest and shawl LOD1/2 unchanged. The bounded trials did not
show a clear improvement in shape or finish at the normal 44 and 88 pixel sizes.
No trial was installed. This closes the trial; it does not claim that every
contact is corrected or that every possible repair is infeasible.

Earlier close inspection showed small shirt/overlay contacts. Some contacts are
hidden inside folded cloth. A raw triangle crossing count cannot establish a
visible defect. The original-overlay trial therefore kept the native materials,
openings, connected triangles and skin weights. It moved only a few interior
vertices near measured outside contacts.

| Trial | Largest required move | Normal-size result |
| --- | --- | --- |
| Worker LOD2 vest | 7.28 mm with openings fixed | Exceeds the 6 mm bound; no candidate render or install. |
| Shawl LOD1 | 1.72 mm across three interior vertices | No pixel changes by more than 3/255 at either size. No clear improvement. |
| Shawl LOD2 | 2.04 mm across eight interior vertices | Sixteen pixels change by more than 3/255 at 88 pixels; eight at 44 pixels. No clear improvement. |

The [paired difference sheet](tactical-reference-2026-10-08/outer-garment-rejected-fit.png)
shows the exact native materials before and after. Magenta marks differences;
10x pixel magnification helps find the small contact areas. A highlighted
change does not prove an improvement. These are fixed selected contact frames,
not an accepted moving-clearance test.

The earlier coat-coupled shell trial also failed. It could clear the rest mesh
but produced contacts under native arm poses. Keep those rejected files private.
A future repair must preserve openings and weights, stay within its displacement
bound, improve the actual outside surface at both play sizes, and show no worse
visible contacts in motion. Do not alter pigment to hide a contact.

Private evidence is retained under `/tmp/granaderos-overlay-envelope-probe/`.
It includes exact native pose checks, original boundary/topology hashes, fixed
render controls and frame hashes. Research has stopped so work can continue on
the larger visible differences in character posture and the environment.
