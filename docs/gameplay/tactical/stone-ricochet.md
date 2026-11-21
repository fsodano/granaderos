# Glancing shots against stone

During tactical exploration and turn-based combat, a continued firearm ray—whether a single lead ball or one of the nine finite pellets in a shot load—can ricochet once in the horizontal plane when it strikes an exposed vertical face of explicit stone cover at a glancing angle. The existing aiming intent,
loaded charge, ignition, shot variation, AP, wear, time and body-passage rules
remain authoritative. Cannon flight and 3D assets have separate ownership.

## Rule and limits

The incoming ray must enter through one unique exposed vertical face. An
ambiguous corner, zero-depth touch, interior shared wall face or top/bottom
contact does not qualify. A high resistance value alone does not identify stone.
Wood, adobe, hay, ground and floor slabs keep their existing behavior.

The maximum absolute dot product between the incoming unit direction and face
normal is **0.3**. A qualifying contact retains **half the current abstract
force**, and a ray can reflect **once**. These are explicit Granaderos tuning,
not historical measurements or classic JA2 constants. Reflection is decided at
the entry face, before penetration could spend force inside that material. The
reflected direction mirrors the horizontal component at that face. Its original
height and exact vertical derivative continue.

The original flight-distance budget stays fixed. Distance already travelled and
force already spent remain spent. Far-shot drop keeps its original cumulative
onset at twice the selected effective range; reflection does not start another
straight-distance allowance. Map edges, remaining force, actual ground/floors,
bodies and the remaining range bound stop the continued leg. Body contacts use
the actual height and typed identity. A body can receive only one contact per
ray, and reflection geometry adds no random draw. Cover tuning cannot restore
force lost in reflection.

Observed previews, bystander warnings and enemy choices use the same shot rule
with known geometry. Unobserved objects or bodies cannot disclose a reflected
path, material identity, name or endpoint. Actual private geometry can still
change an observed person's real injury. The player can reduce risk by changing
position or aiming away from a glancing stone face.

## Physical evidence and adaptation

[Nishshanka and colleagues' 2024 primary experiment](https://kar.kent.ac.uk/107376/)
observed outgoing spherical lead pellets after contact with ceramic floor tiles.
Recovered projectiles and witness screens showed angle-dependent deformation
and fragmentation. This supports a real lead-projectile rebound phenomenon;
it does not calibrate an 1812 musket ball against a natural-stone wall. Applying
one ideal reflected direction to the game's stone faces is a declared game
adaptation. The 0.3 threshold, half-force retention and reflection cap are not
inferred measurements from that study. Fragmentation, other surface reflection
and a supported projectile mass/velocity model remain open.

The reviewed classic and Stracciatella source establishes spent force, body
passage and far-shot drop. It establishes no reflected projectile path.
Reflection is therefore a Granaderos rule, not exact classic ricochet parity. It
introduces no modern equipment or door explosives.

## Parallel 3D integration

Rendering uses the current cell-centred horizontal coordinates, tactical level
and separate absolute body height. Asset scale and camera projection translate
those coordinates; they do not change the collision model or body heights.

The renderer consumes **observed presentation frames**, including their clipped
`shotVisual.source`, `impact`, `outcome` and optional `discharge` fields.
Later observed legs use `discharge: false`, so one paid shot produces one muzzle
cue. Raw physical segment models, private obstacle IDs and force records remain
inside resolution. They are not renderer input and do not enter a save.

Reflected firearm playback consumes the shared resolution result rather than
resolving another shot in the renderer. The actual campaign/battle result
remains equal through ordinary, presented and saved execution.
