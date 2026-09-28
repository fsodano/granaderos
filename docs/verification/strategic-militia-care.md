# Finite local medical care for militia

Runtime/test source: `eec006720ea3283304835b0099c2a74dad3d4536`.

The campaign's medical screen includes **Médico de milicias**. A serving doctor
in a controlled, unloaded sector treats one existing local garrison soldier per
hour. Bleeding takes priority, then the lowest health fraction and stable
identity order. Two doctors cannot treat the same soldier in that hour. Looking
for patients does not create a cohort or issue equipment.

The assignment uses the campaign's authored minimum skill, healing rate, work
energy/fatigue costs and dressing price. Each effective hour consumes one of the
doctor's personal dressings. It first stops bleeding; later work restores health
up to that soldier's maximum. The treated soldier recovers breath/fatigue at the
configured rest rate, and its consciousness is refreshed. Complete garrisons
consume no further supplies. An empty medical stock stops work.

The doctor cannot march, deploy or instruct militia while assigned. Another
squad can travel while that doctor continues working locally. A doctor in another
cell cannot treat the garrison remotely. Loaded garrisons keep their tactical
wounds; this assignment cannot add a second treatment during a deployment.

Health stays with the existing garrison identity through saving, normal return
and reentry. Weapon, ammunition and supply quantities are not replenished. Real
casualties remain bodies and are not recreated as patients. Saved health, wound,
bandage, energy and fatigue bounds are validated before care can normalize them.
The screen lists the current active location's existing garrison health.

## Verification

Six simulation tests and one mounted production campaign-screen test pass.
The shared fixture authors controlled Buenos Aires and its port, pays for a real
training course and physician contracts, waits the actual training interval,
and uses a real enemy pistol shot or blade attack in compact barrier geometry.
It is a local care fixture, not a fresh liberation or defense acceptance route.

The checks cover:

- Bleeding before healing, finite work costs and supplies, actual dressing
  purchases, no further expenditure on complete patients, saves and reentry.
- Two doctors sharing one patient without double treatment; authored healing,
  effort and dressing price.
- Locality, travel/deployment/training conflicts and actual care by a doctor
  left at headquarters while another squad marches.
- Loaded-sector exclusion, a real tactical bleeding death and its ordinary
  garrison casualty settlement.
- An actual enemy casualty remaining a corpse with unchanged troop counts.
- Strict saved health bounds and rejection of an unqualified or unhired doctor.
- The actual assignment control, visible garrison health, hourly stock changes,
  a paid purchase, saved care and restored deployment after returning to service.

The existing medical, garrison and militia group passes 14 tests. The reviewed
seven new checks pass, as do types and all 36 baseline comparisons. Complete
release regression passes **939/939 tests**, zero failures or skips
(221,710.723 ms). Production export passes (722 files, 632 asset references),
along with the documentation audit (227 requirements and 66 evidence records,
retaining all 50 original and 87 parity rows). Published through [PR #89](https://github.com/fsodano/granaderos/pull/89)
on 28 September 2026 at 18:06:24 UTC.
[CI](https://github.com/fsodano/granaderos/actions/runs/36460805665/job/109058554695)
passed at 18:05:29 UTC for exact head
`0de9e91aa277a88a2a3300bc80dc1eb89e1c58e6`; the merge commit is
`934d195379b65ae17c09ae093aecfec5603ae98d`.

## Limits

This extends local care for existing militia identities. Untreated militia
outside a loaded sector do not yet use the recruited-person hourly wound rule;
that clock, strategic militia deaths and their physical remains are separate
work. This does not add militia travel, capture/rescue custody, automatic sleep,
new equipment transfers, distant treatment or a complete defense route.
Mounted checks do not establish live-browser performance or full-game parity.

New paid promotion courses subsequently preserve those individual soldiers; see
the [promotion verification](militia-training-identities.md) and its separate
publication status.

The subsequent [unloaded militia wound integration](unloaded-militia-wounds.md)
tracks hourly loss and retained local bodies separately, with its own publication
status and compatibility limits.
