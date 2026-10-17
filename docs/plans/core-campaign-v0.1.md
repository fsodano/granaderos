# Core campaign: manual testing handoff

Updated: 17 October 2026.

PR #426 is being delivered for the user's manual testing. The user requested
that the remaining local test run stop and that the committed work merge to
main. This handoff does not claim a complete campaign test pass.

## Delivered scope

The committed campaign integration retains ordinary game orders, finite
supplies, paid contracts, actual casualties, medical care, travel and the
original battle and preparation limits. The published game README remains
unchanged.

Production fixes label ground money as Pesos, clear a refused autonomous enemy
order before a valid player interruption, preserve the inspected inventory
slot, make visible 3D doors reachable by pointer and keep the interruption
notice clear of the desktop toolbar. Build identity excludes generated Python
cache files while retaining sensitivity to real source changes.

## Local validation

Private production export `0.1.14 / 4707546fceec` was built from `2af4f524`.
Documentation and baseline audits, production build, TypeScript and diff checks
passed. All eight build preservation comparisons and HOME passed. The build
processes were collected and reaped.

The subsequent unfiltered 1,115-file local run was stopped at the user's
request. Its partial report has 12 of 1,115 files finished: seven pass and five
fail, with 1,103 unfinished. No final case totals are available. All five
before/after preservation comparisons pass. This is not a complete passing
receipt. Separate
qualified components include healthy northern return (20 cases), stationary
local care and civilian safety (36 cases), medical wall detours (20 cases),
reserve rest (5 cases), pre-contact battery work (23 cases) and build identity
(2 cases). Their scopes overlap; these are not one aggregate test result.

## Known automated failures

| Route | Observed result |
| --- | --- |
| Opening | The Córdoba defence at H294 ends in defeat. The earliest recorded force has four living soldiers. Its roof guard retains a pistol while an unloaded owned musket remains packed. |
| Northern, historical loss and Cuyo | Three files reach the same byte-identical Córdoba battle and lose. Nine living soldiers deploy, but no cannon orders occur. Healthy crew assembly before contact remains unresolved. |
| Recovery | The route completes and settles the Mendoza battle, then its whole test file fails. The exact later failure still needs diagnosis. |
| Loose-seed ending | Arsenal physician preparation attempts to renew service through the entire unused preparation allowance. The actual inner state runs out of treasury during these advance payments. |

The proposed roof-equipment and contract-payment changes remain outside the
checkout, unapplied and unrun. They are not part of this delivery. Keep the
original route assertions, permanent losses and finite-resource requirements.

## Manual test focus

- Start the installed Granaderos campaign from the normal desktop launcher.
- Check recruitment, equipment, travel, recovery and contract notices.
- Use two soldiers on distinct cells beside a cannon. Check its named crew,
  fire, reload, leave the cannon and use a personal firearm without moving.
- Complete the coastal, northern, Yatasto, Cuyo and mountain objectives.
- Verify the actual ending, export/import and 48 campaign hours of continued
  play, including income, service expiry and tactical reentry.

Desktop posture controls, inventory, wall and door access, saves and worker
playback have bounded prior browser evidence. Manual cannon operation, an
earned ending and 48-hour desktop continuation remain unaccepted. No phone
support or phone testing is included.

Every push to main builds and publishes GitHub Pages. Verify the actual live
revision after the merge before using the public site for this handoff.
