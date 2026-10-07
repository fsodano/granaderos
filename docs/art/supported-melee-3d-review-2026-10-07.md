# Supported sabre contact review — 2026-10-07

This repair covers the five native standing sabre strikes against standing or crouched bodies. It preserves the paid variant, native blade rotation, contact marker, finite clock and saved actor cell. The target comes only from the currently admitted visible body. The native pelvis moves between actual supported boots; joint offsets, segment lengths and scales stay unchanged.

The first release closed the diagonal contact gap, but a later independent full-cycle check found a remaining wrist clamp: **14 of 40 pairs**, with a maximum intended-wrist error of **48.166 mm**. Contact and grip alone could not prove a reachable arm. The new gate reconstructs the intended wrist from a separately rendered native source pose and requires it to stay within the original measured arm at every sample. Its correction returns to the native guard before the body completes recovery. An impossible fit retains the original finite animation.

The lead boot first settles while the rear boot stays supported. Rear gather and lead advance then share the preparation interval in proportion to their travel. Their recovery is also serialized. The complete sole baseline returns continuously to the native guard; it does not switch off at 90% of the cycle. Each body and boot advance is bounded by a measured half stride of the same published native blade-walking clip. Full 3D sole speed must stay below that clip's measured native peak; the limit does not come from an invented lunge speed or available floor area.

The accepted path receives the complete **240 Hz** chronological sole and wrist gate. Swept sole rectangles include every native sole-outline vertex, their segment between samples and a **3 mm** margin. Conservative exported skin and clothing bounds test the head, trunk and legs against the disclosed floor union at contact and every fourth path sample. Missing floors, blocked corners and height changes cannot add a fitted route. The legal diagonal case with both side cells blocked keeps the exact original strike.

The independent matrix checks cover both native anatomies, cardinal and diagonal pairs, standing and crouched targets and all five stable paid variants: **40 pairs and 9,640 samples**. They use the actual published blade or hilt triangles, target skin/clothing triangles, native palm/grip, complete boots and separately rendered source wrists. The corrected preview reads current matrices directly after the native update; a forced full hierarchy update gives zero difference for every node matrix, bind inverse, sole, body bound, wrist and pelvis. The real actor retains its normal hierarchy updates. Prior transforms are restored before the mixer, including repeated held-contact ticks.

| Measured quantity | Result across the 40 pairs |
| --- | --- |
| Actual blade/hilt to target triangle gap at contact | 0 |
| Intended wrist clamp / solver hand clamp | 0 / 0 |
| Maximum actual wrist endpoint error | 0.000290 mm |
| Lowest complete boot above its floor | 1.999–7.000 mm |
| Maximum forward pelvis advance | 61 cm male; 68 cm female |
| Maximum lead / rear boot travel | 50 cm / 56.910 cm |
| Native half-stride cap | 77.227 cm male; 73.760 cm female |
| Maximum actual 3D sole-centroid speed | 5.199 m/s male; 4.579 m/s female |
| Measured native walking centroid peak | 5.235 m/s male; 5.023 m/s female |
| Maximum additional pelvis drop during the cycle | 29.000 cm male; 27.000 cm female |

Only admitted `contactTarget` and `contactSupport` data enter the helper. Missing, hidden, failed, stale, unsupported or undisclosed targets retain the source animation. A replaced LOD is fitted from the replacement model. Recovery uses its already admitted own-body plan without reading a hidden target. The same admission works at a **3 m** support height. A missing native walking reference and a real paid empty-cell swing have explicit exact-fallback tests. No target outcome or future hit lookup enters the fit. Health, misses, AP, equipment ownership, ammunition, saved cells and one final completion remain authoritative simulation results.

Candidate pruning caches only the actor's known native wrist path. It rejects impossible candidates with scalar reach math before the complete solved geometry gate. Every accepted sample remains checked. Preview matrices skip redundant traversals only after the exact hierarchy-equivalence proof; sampling and support admission are not reduced.

Cold timing is a remaining performance limit. With asset/fixture/runtime construction excluded, the exact candidate measured **122.228 ms maximum / 89.407 ms p95** wall time across 40 first prepares on a host with load 5.49 / 16.02 / 29.24. Process CPU was **226.365 ms maximum / 116.099 ms p95**; compiler and GC threads can make process CPU exceed wall time. All 800 held ticks reused their admitted plans, with **0.144 ms p95** and **0.674 ms maximum**. Three fresh-process first-base profiles showed about a 6% reduction in full-path wall time from direct preview matrix reads. Host load changed between broader runs, so their complete improvement cannot be assigned to code alone. This cut has no idle prewarm or worker; ordinary first strikes can still pause. A later bounded prewarm/worker cut must preserve all admitted target and full-path checks and report total setup cost, rather than hide it in warm-cache timings.

The current [Granadero strike sheet](../../web/public/art/illustrated/granadero-strike.png) and [woman scout strike sheet](../../web/public/art/illustrated/woman-scout-strike.png) guided the earlier forward weight shift, bent support leg and return to guard. They show rifle butt strikes and cannot establish sabre length, 3D body distance or paired contact. The exact corrected source still needs ordinary paid UI review against those sprites; no new live visual acceptance is claimed here.

The prior released source passed its clean gate and normal paid sabre UI review in `artifacts/three-pr195-cut-review/melee-after/`. That order charged **3.5 PA once** and dealt its authoritative **42 damage once**, with no browser errors. This records the earlier finite gameplay boundary; it does not establish the new full-cycle wrist repair visually.

The focused final gate passes 50 sabre, strict pistol, actor-runtime, admitted-model, rider-support and native/morphed-sole checks, plus the project type check. This boundary changes no GLB, animation bank, equipment dimension or action duration. It preserves the released strict pistol predicate and current climb/rider consumer calls.

The original right boot is still **34–36 mm** above the floor in the native starting and ending guard while the left boot supports the body. Its source stance needs a separate native authoring correction. Pistol rear-gather speed, cold fitting cost, crouched or mounted attackers, paired left-hand equipment, lance, knives and fixed bayonets remain separate body-mechanics work. This is a measured contact repair; it is not a claim that all 3D body polish is complete.
