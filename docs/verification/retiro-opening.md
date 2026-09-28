# Retiro opening: accepted scope and limits

At this checkpoint, new stock campaigns and campaigns launched with the story
editor start with Retiro as the only controlled sector. They have 3,200 pesos, no recruits and no
custom character. Initial daily income is Retiro's 80 pesos. Buenos Aires and
Ensenada must be liberated; an ordinary travel order cannot grant control.

The player can create one free character, hire candidates, or combine both paths.
The first living, uncaptured recruit advances the formation chapter without an
extra academy payment. A paid candidate with a travel time advances it only after
arrival. Cancellation or an unaffordable order cannot unlock the chapter. Day,
week and month terms retain their prices and begin on arrival. Legacy candidates
without authored travel times keep their immediate arrival behavior.

Retiro is the supply origin and headquarters. Its workshop can sell locally
available equipment before Buenos Aires is liberated. Imported rifles still need
Ensenada. Militia instruction still requires control of the whole Buenos Aires
region. Losing Retiro ends the campaign; the initially occupied capital does not.
A free character does not provide free deployment ammunition or equipment.

Old saves keep their territory, treasury and unlocked chapters. The old academy
command remains a harmless repeat after opening, with no second cost or reward.
No refund is invented for money spent in older saves. The old questionnaire-only
character API retains its original fee; the current player character creator
uses the free version-2 profile.

## Evidence

The runtime and tests are recorded in source
`b11d24edd64976064ec30b3d7fa6ed8aa6248deb`. [PR #32](https://github.com/fsodano/granaderos/pull/32)
merged after [exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36360760155)
passed for `94d3c8982e2ed579d94419b81926fff2de2a3884`. The complete local run passed **568/568 tests**, with no
failures or skips, in 179 seconds. TypeScript and production export passed
(721 files, 631 asset references). The reference-value audit passed 36/36
checks, the documentation audit retained all original/parity requirements, and
all 80 local links in changed documentation resolved.

- `tests/retiro-start.test.mjs`: empty force and territory across three seeds;
  stock and authored starts; free custom creation at zero balance; all three
  hired terms with delayed arrival; cancellation and insufficient funds; both
  mixed orders; headquarters supply/loss; existing saves; hostile first entry.
- `tests/retiro-start-render.test.mjs`: optional creation, independent hiring,
  one-person departure, and removal of the obsolete academy payment.
- `tests/retiro-expansion.test.mjs`: unedited seed 8, six paid day hires, real
  combat on the authored Buenos Aires map, active save, casualty settlement,
  campaign reload, peaceful reentry, and no duplicate conquest reward. Both the
  stock and default story-package paths pass. Contracts cost 2,854 pesos; issued
  ammunition costs 60. The stock run takes four turns and 60 actions, with two
  deaths. No area, combatant, money, ammunition or victory is granted by a fixture.
- `tests/retiro-resume.test.mjs`: the actual home component resumes and imports
  empty, pending and hired-only saves to the appropriate desk or map screen.
- Existing subsystem cases now declare any established territory explicitly in
  `tests/controlled-area-fixture.mjs`. They retain their original assertions but
  do not count as fresh-start acceptance. The old historical-squad fixture also
  preserves its original three controlled sectors explicitly.

## Remaining acceptance

The startup state and first hired-squad conquest are verified. A complete fresh
route through San Lorenzo, the north, Cuyo and the ending remains open, as does
balance across seeds and custom-only squads. The same basic combat controller
lost a custom-only seed-8 assault; one-person departure is not a promise that a
solo character can win every battle. No combat rules or enemy strength were
changed to obtain the hired-squad result.

Starting ownership was not editable at this checkpoint. Later deliveries add
[funds and cartridge allotments](campaign-supply-rules.md) and
[starting control and loyalty](starting-territory.md); the stock and default
package retain this opening. The broader rule editor remains separate work.
No new browser playthrough or loaded-combat performance measurement was done here. Existing route failures in the dated
formal audit are retained until their own acceptance passes.

A later [local-recruit opening checkpoint](local-recruit-opening.md) verifies a
created officer with actual local recruits and no bulletin hires through saved
San Lorenzo completion and a subsequent sector visit. It preserves actual paid
care and losses; the earlier scope and figures above remain dated evidence.
