# Physical near-miss feedback — 5 October 2026

This batch addresses playtest items 17 and 21 and part of video requirement V15.
It corrects shot provenance and adds optional event-specific text. It does not
prove recorded voices, full character reaction coverage or campaign completion.

The previous near-shot inference used an enemy's spent charge and selected
target. It could announce a near miss when cover stopped the ball much earlier.
The current [combat reaction rule](../gameplay/characters/combat-reactions.md)
uses actual discharged paths and their physical stops. Contact and injury keep
their separate reactions. The existing synthetic spent-charge near test is
replaced with actual firearm actions and atomic negative controls.

The paid acceptance recruits Inés Aguirre (107) and Acosta (110) for their real
weekly quotes of 588 and 420 pesos, waits six hours and admits the ordinary
Buenos Aires attack through the campaign handoff. All four campaign orders have
official saved replay. A separately declared flat firing boundary supplies only
terrain, positions, facing, initial AP, weather and representative seeds before
its first official admission. Native health, skills, finite kit, charges,
condition and the force supplied by the paid request remain unchanged. This is
a paid firing acceptance, not a native Buenos Aires conquest.

The issued hostile Brown Bess retains the current kinetic-energy and air-drag
definitions. Its seed-3, 12-AP discharge passes close to Acosta while he retains
85 HP. Separate declared controls prove a stone stop, actual wet ignition
failure and a real seed-8 injury. Ordinary and presented execution agree, and
the actual saved continuation retains equipment and paid service. The original
diagnostic weather result remains preserved; it revealed that regional weather
overrode the declared local boundary. The corrected boundary disables that
regional override before admission and earns the actual ignition failure.

The mounted worker acceptance displays the quote after flight, holds input
until the single final commit, and retains the quote through automatic unit
selection. Its ordinary ten-second timeout still removes it. Reloading an
official save cannot repeat the event. This check found that selection cleared
the quote immediately; removing that speech reset fixed the actual display.

## Validation

The final unfiltered `npm run test:quick` passed **4,966/4,966 tests** across
**715/715 selected files** in 384.245 seconds. There were no failed, cancelled,
skipped or todo tests. The eight existing extended files remain outside this
profile; the runner, partition and exclusions were not changed.

The complete affected groups passed 106/106 core tests, 99/99 optional speech
and editor tests, 20/20 mounted feedback tests, and 2/2 paid integration tests.
These groups overlap with the short suite and are not added to its count.
Type checking, the production build, documentation and baseline audits, all
11 runner self-tests, shard coverage, suite partition and whitespace checks
also passed. The static export verified 1,133 files and 1,033 asset references.

The frozen production source digest is
`63dfea068a66de1d151ed878a4c99edcc883d64709a1713c15657c97d29afd59`;
the build identity is `63dfea068a66`. The test and support digest is
`fb3014ccadfe571043831a37e549c3127a135b3232bf6f9c0af096d8751af481`
over 893 paths, including 723 test files. Final gates used these same inputs.
An earlier type check rejected the counter callback's inferred declaration.
That candidate's short run was stopped after the confirmed type failure. A
JSDoc union corrected the declaration without changing executable code, and
the complete short suite then ran again to terminal success. Original failure
logs and receipts remain available locally.

This batch changes reaction data and the existing speech overlay. It adds no
cannon mechanics or 3D rendering work. The running game and its saved state
were not changed. Full campaign acceptance, wider voice and character coverage,
and the eight long extended suites were not proved by these checks.
