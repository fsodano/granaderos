# ADR 002 — Prone combat and incapacitated sprites

Date: 2026-09-06. Status: implemented.

This extends [ADR 001](001-realistic-tactical-sprites.md). The engine analysis in
`docs/web-port/` and all portraits remain unchanged.

## Problem

The tactical scene converted both dead and unconscious people to a prone stance.
The sprite component then chose the same prone idle atlas for all three cases.
It also ignored fire/reload actions when prone and displayed a musket regardless
of the equipped weapon.

The combat rules already allow prone shooting. The missing behavior was visual;
no new combat rule or saved-state field is needed.

## Decision

Use distinct, pre-rendered body poses, with this selection order:

1. **Dead (`hp <= 0`):** relaxed supine pose, one still frame per direction.
2. **Unconscious (alive and `unconscious`):** side-lying pose; eight authored chest
   rise/fall frames at 2 fps, repeating once every four seconds.
3. **Prone and conscious:** braced on elbows, with armed/unarmed variants.
4. Other stances and mounted motion use the existing selection rules.

Death wins even if unconsciousness, mounted status, motion, or a pending fire
animation is still set. Incapacitation cancels path playback. The corpse remains
at the resolved map position. Recovery selects the correct current posture and
weapon again. No whole-image breathing scale or rotation is used.

`hasFirearm()` is the shared equipment rule. An unloaded gun is still visible.
Dropping the firearm or switching to the blade slot selects the no-gun prone
variant. The no-gun variant does not pretend to fire or reload a firearm.

| Family | New sequences, each in eight directions |
|---|---|
| Granadero and Royalist | Prone armed idle/crawl/fire/reload; prone unarmed idle/crawl |
| Granadero, Royalist, civilian | Dead still; unconscious breathing |

Prone firing uses an aligned musket, supporting arms, recoil, and a brief
pre-rendered muzzle flash. Prone reload has its own hand and weapon motion. Combat
actions play once at 10 fps; breathing has its own slower clock and continues when
no unit moves. Death and recovery cancel that clock.

## Implementation

- `game/sprite-state.js`: life-state priority, equipment-aware selection, and
  frame-clock rules.
- `SpriteFigure.tsx`: discrete atlas playback and effect cleanup.
- `TacticalScene.tsx`: distinct posture labels and unchanged unit state passed to
  the sprite renderer; no forced prone substitution.
- `useUnitMotion.ts`: cancel motion when dead or unconscious.
- `assets/rig/render_ground_states.py`: original offline geometry, two-segment
  arm placement, firing, reload, and body poses.
- `assets/rig/pack_pixel_sprites.py`: the current set is **38 atlases, 1,704
  frames**, replacing the old four generic prone atlases in the active manifest.

Ground-state frames use 80×80 native pixels and anchor (40,47), at the same 20
pixels per world unit as standing sprites. Extra space accommodates limbs and the
extended musket without changing human scale. Old generic prone assets are not
selected by the runtime.

## Rebuild and verification

After the infantry and civilian source models from ADR 001 exist:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/rig/render_ground_states.py
python3 assets/rig/pack_pixel_sprites.py
node tools/preview-tactical-sprites.mjs
npm run typecheck
npm test
npm run build
```

Tests cover armed/unarmed selection, empty guns, dropped guns, switched equipment,
prone shooting and ammunition consumption, death priority, breathing timing,
recovery, scene integration, frame coverage, and source pixel changes across each
breathing direction. Packers check alpha and unclipped bounds before installing
any output.

[Direction and state sheet](../../assets/previews/tactical-pixel-art/directions.png).
Animated previews are in `assets/web/pixel/`, including
`granadero-unconscious-breathe-se-preview.webp` and
`granadero-prone-armed-fire-se-preview.webp`.

Validation of the isolated sprite PR: 254 tests passed; type checking and the production build passed.
The build verified 236 exported files and 148 asset references. All 47 recorded
portrait hashes still match.

Enlarged animated previews:
[breathing](../../assets/previews/tactical-pixel-art/granadero-unconscious-breathe-se.webp)
and [prone firing](../../assets/previews/tactical-pixel-art/granadero-prone-armed-fire-se.webp).

These previews are offline renders. Browser interaction has not been tested in
this change. Melee-weapon-specific prone art and full fall-to-ground transitions
are separate work; they are not represented as completed here.
