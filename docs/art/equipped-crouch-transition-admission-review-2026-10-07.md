# Crouched equipped guard entry and return

The existing supported side-step consumer admitted idle only. A real crouched
raised gun or supported brace could therefore use a raw 120 ms quaternion
blend instead. After the source loops were fixed, those raw guard blends
still reached 50.068 mm below ground for men and 44.520 mm for women.

This consumer cut changes one admission expression. Crouched aim and brace
can use the existing bounded idle/side-step support plan when the selected
gait carries measured native support metadata. Standing guard admission,
unsupported movements, equipment ownership, hidden actor admission, gameplay
costs, motion clocks, bank outputs and ActorRuntime hooks remain unchanged.
The equipped crouched loop source and native guard source cuts are required.

The existing plan preserves native limb offsets/scales and all upper local
rotations. Its immutable planted target remains supported while the other
foot recovers. The measured equipped crouch paths need no temporary Root
settle. The stop plan retains the supporting foot until the recovering foot
lands, and returns to the exact native guard over 0.8 seconds.

Local proof on main 5f8c77ed plus the two named source cuts:

- 175 source-consumer checks pass in 43.27 seconds, including all existing
  standing/unarmed crouch cases, delayed first frames, held phases, changed
  floors and finite unsupported reach fallback. Two extra equipped aim held
  phase and finite reach checks pass in 1.72 seconds.
- 132 complete runtime routes cover both directions, five owned equipment
  categories, compatible idle/aim/brace guards, both anatomies and all LODs.
  Complete boots clear the floor by at least 1.126 mm. Nearest support stays
  within 2.340 mm. Planted world foot speed stays below 0.00855 mm/s; maximum
  recovery is 5.843 m/s and release is 0.980 m/s. No fit is rejected and native
  reach error is zero. Native offset/scale/upper/socket/held transforms and
  saved wrapper placement have zero measured error. Body settle is zero.
- 48 real paid simulation/presentation cases cover rifle, pistol, sabre, knife,
  lance, free, medical, supply, tool, object, selected offhand and paired guns.
  The original AP payment, saved facing and every owned ammo/equipment field
  remain exact. Nonweapon states use the supported unarmed path.
- Normal browser controls complete 20 candidate routes (five owned categories,
  both anatomies, both directions), plus eight before routes. All five actors
  load, the saved cell and facing are correct, and no browser error occurs.
  Review data changes only the fixture's finite owned item/posture. Renderer,
  native body and ordinary controls are unchanged.
- Thirty-eight rifle/pistol contact and motion clock regressions, native assets,
  unchanged locomotion profile and type checks pass.

CPU review separately measures 20 native LOD0 actors over five full start/stop
cycles at 60 Hz for crouched rifle aim/brace, pistol aim and lance brace. It
includes native mixers, held equipment and complete support fitting, and
compares the helper enabled/disabled. Active frame p95 is 1.816–2.871 ms;
idle p95 is 0.581–0.647 ms. Twenty simultaneous cold admissions reach
32.218 ms before GPU work (the first rifle aim case); later modes peak below
5.579 ms. This disclosed cold frame limit remains. This CPU measurement
does not certify GPU frame rate.

The isolated UI is at port 3170. The review script uses `Posturas`, selects
`Agachado` / `Arrastre femenino`, verifies the owned main hand, then uses normal
Alt+Enter lateral movement. Letter rows are map Y; number columns are map X.
Male endpoints are J5/K5; female endpoints P5/Q5. The image evidence includes
entry, planted pull, recovery, late cycle, stop and exact idle.

## Integrated current gameplay review

The two source builders and the one-expression consumer are integrated
together on main `43bcc8ad`, retaining the merged bayonet, prone rifle and
standing reach-gesture tracks. Each builder runs against the current complete
banks. Its named preservation proof retains every other native channel; the
locomotion profile hash remains exact.

The compiled `Agachado con equipo` scene owns two real combatants and a normal
equipment selector for rifle, pistol, sabre, knife and lance. Reset and item
selection create fresh legal battle snapshots. They do not issue renderer
poses. Both anatomies use ordinary equipment and Alt+Enter movement controls.
The saved cells are J5/K5 for the male and P5/Q5 for the female; facing stays
unchanged. The browser completed eight source-before and twenty source-after
routes with 168 entry, pull, recovery, late, stop and idle captures and no
errors. All nine captured source/runtime/asset hashes stayed exact throughout.

The male rifle before/after pull and idle, and female lance recovery and idle
were inspected against the current `granadero-crouch-walk-atlas.png`. The
retained rifle grip and compact crouched silhouette remain readable. The
source-before pass has an extended unsupported trailing foot; the repaired
route returns to the supported native crouched guard. This image review is
limited to the shown weapons and base clothing. It does not certify long
skirts, all garments or final art polish.

The combined local gate passes 156 source/guard/consumer checks in 47.45
seconds, 113 existing gait/loading/clock checks in 26.88 seconds, and eleven
fixture checks in 1.46 seconds. Native library, calibration, Python compilation,
TypeScript, documentation and all 38 baseline checks pass. Production static
export passes with 1,244 files and 1,039 asset references, build
`f692319d4888`. The previously recorded cold twenty-actor admission limit
remains open; these browser captures do not establish sustained frame rate.
