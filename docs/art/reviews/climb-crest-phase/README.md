# Remove the even-rung roof crest pose jump

This small correction keeps each foot on its actual final ladder rung at the roof crest. It removes the even-rung pose jump at paid fraction .76. It does not claim complete natural climbing motion, palm floor clearance or low ceiling acceptance.

## Physical change

The prior contact plan always assigned the source left/right crest rungs. An even rung count finishes with the opposite foot high. At .76, the plan could move a foot directly to the other rung. The revised plan retains the real final side. The left foot reaches the roof at the existing .82 endpoint; with that support, the right foot takes the existing last rung over .82–.85, then follows its original .85–.91 roof transfer. The bridge is marked moving rather than planted. Its bounded 45 mm toe lift and 30 mm backward arc provide clearance between those existing support points.

The runtime fitter keeps the existing source bend poles and contact frames through .82 on even ladders, then returns smoothly to the original solver by .85. The actual roof hand turn uses the existing source −90° × roofWeight recipe from `assets/source/characters-3d/authoring/climbing_motion.py`. Hand contact strength also follows the existing paid hand weight. Odd ladders retain their prior path.

Native banks, rig lengths, bone offsets/scales, Root rotation, pelvis channels, paid clocks, saved actor travel, ladder/roof geometry, collision and AP rules are unchanged. Root/spine phase adaptation remains the already merged rung implementation. No ActorRuntime or body-phase helper is changed. The .65 m foot/fading-hand fallback, finite nativeFraction fallback and reachable-hand admission remain intact. The original 3 m cardinal native reference and all poses at or after .85 remain exact.

## Focused evidence

The portable paired proof uses the exact rung predecessor helper (231daa09…) and original geometry (b7ad2737…). It samples actual published weighted meshes: 96 anatomy/LOD/direction/height/span cases, 37,608 poses and 864 edge comparisons. Heights are 2, 3, 4.2 and 5.6 m; same-cell and cardinal ladders are on raised foundations. It measures complete boots, headwear, bodies and clothes. Root world position/orientation, action/mixer clocks and bank bytes are compared explicitly.

The largest complete-surface movement at .76 ±.000001 is 547.461851 mm before and 0.018044 mm current. Shrinking intervals and an independent 8 m/s crest bound reject a remaining fixed crest jump. From .85 onward, the maximum measured before/current surface difference is below 0.000001 mm. Exact decoded clip duration is 4.616666793823242 s; actual paid duration is used for velocity. No 4.633333 s assumption remains in the accepted proof.

The full .735–1 interval is sampled at 240 Hz. For each case, its continuous peak cannot exceed its exact predecessor peak by more than .001 m/s; the old .76 jump is excluded. This is a case-peak regression check, not a pointwise speed reduction or natural-motion acceptance. The worst old/current case peaks across the set are 140.143137 / 98.041994 m/s. Odd-rung rapid native motion remains exact. At each later edge, shrinking-interval skin movement is unchanged within a ten-nanometre allowance.

All 156 affected tests pass: 22 crest/geometry tests, 24 appearance/item tests and 110 prior climb/contact/timing tests. They cover all eight appearances and three LODs, ascent/descent, diagonal source cases, complete real rifle/pistol/sabre/lance/medical items, worn overlays, hand/rung reach, standing reference poses, held phases and finite fallbacks. TypeScript passes. The 31 actual input hashes include the unchanged 28 rung predecessor models, banks and garments. This is not a performance or garment-collision acceptance claim.

## Normal controls

The visible sandbox checker uses Azoteas a distintas alturas and normal Subir/Bajar controls. Eight paid actions and four resets pass: 5.6 m/base 1.2 m, 4.2 m same-cell/base 1.1 m, 6 m/base 1.7 m and 2 m same-cell/base .4 m. AP is 100→80→65 internally (25→20→16.25 on the HUD), energy is 100→88→80; saved cells, levels and elevations remain exact. Page errors and failed HTTP responses are empty.

The before/current crest images and raised hatch/low return endpoints were viewed. The corrected last-rung sequence is visible. Overlay phase metadata can lag a screenshot by one frame; these ordinary images establish route and appearance, while the CPU proof establishes sub-frame continuity. The private UI retains the accepted prior renderer inputs. Root must repeat the route on its current composed main renderer before publication.

## Retained defects and rejected trials

The fast folded-leg motion remains open. At Granadero LOD1, 2 m cardinal ascent, paid fraction .784 (decoded native time 3.619466766357422 s), complete legwear surface speed is 136.624318 m/s before and 27.668701 m/s current. Exact vertex positions and source pins are in `retained-folded-leg-pace.json`. The former ~136.135 value used an incorrect duration denominator; this receipt corrects it. Continuous motion is not proof of natural pace.

The native later roof transfer and landing remain rapid. A universal 8 m/s trial failed and is retained, rather than widening that limit. An earlier .76–.82 source fade increased a dense continuous peak to 65.435379 m/s against 42.689487 m/s; that candidate was rejected. The final .82–.85 fade passes the paired whole-interval check.

The independent strict −4 mm palm floor test also failed; its raw failure is retained. The bounded regression checks now require that full palm penetration does not increase against the exact predecessor, while the complete sole retains the independent −4 mm bound. Eight retained sampled palm failures remain, worst −4.047580 mm; they are explicitly reported in `surface-continuity.json`. This preserves the safety measurement without calling the existing defect accepted support. Broader previously recorded palm-plane cases and the real low-ceiling/headwear collisions after paid return remain separate open work. No roof or hat was hidden or resized.

## Reproduce

Run from the repository root with the existing web dependencies:

```sh
node --test tests/climb-crest-contact-plan.test.mjs tests/characters-climb-crest-continuity.test.mjs tests/characters-climb-crest-appearance.test.mjs
node --test tests/characters-climb-phase-continuity.test.mjs tests/characters-tall-climbing-contact.test.mjs tests/characters-climbing-support.test.mjs tests/climb-playback-timing.test.mjs
npm run typecheck
node tools/verify-three-climb-crest-preservation.mjs --before-helper=docs/art/reviews/climb-crest-phase/before-climb-contact-fit.ts.txt --before-geometry=docs/art/reviews/climb-crest-phase/before-climb-geometry.js.txt
node tools/verify-three-climb-crest-pace.mjs
```

The visible route uses `tools/verify-three-climb-crest-route.mjs` with the ordinary `GRANADEROS_REVIEW_URL`, `GRANADEROS_REVIEW_OUTPUT`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` settings. It does not inject battle state, pose or clocks.
