# Strategic medical care

Source: `c64120315a81360c902552555e0d838b5f8b257f`.
[Player guide](../gameplay/characters/strategic-medical-care.md).

The campaign screen can assign serving personnel as doctors or patients. Treatment
requires the same exact controlled cell and no local fight. Doctors need at least
20 medicine, 15 health, no bleeding, more than 10 energy and a dressing. Medical
work and militia instruction are mutually exclusive. Assigned personnel must
return to active service before their squad can travel or deploy.

Each campaign hour, available doctors attend different patients, with bleeding
first and the lowest health fraction next. One personal dressing stops bleeding;
subsequent hours restore `2 + floor(medicine / 20)` health per dressing. Each
working hour costs three energy and adds two fatigue. Treatment stops when nobody
needs it or the doctor lacks resources. These rates are Granaderos tuning.

The existing supplied daily recovery and tactical aid remain unchanged. The new
workshop control buys 1–20 dressings at ten pesos each, up to 1,000 carried. The
recipient must actually be at the selected supplied, controlled workshop. Remote
purchases, invalid quantities and insufficient funds are rejected without charge.

## Acceptance

Six simulation checks and one mounted campaign check cover assignments, bleeding
before healing, finite stock, depletion, paid replenishment, save/reload, recovered
patients and redeployment. Two doctors cannot treat the same patient in one hour;
a doctor cannot treat a patient in another sector. Deployment and competing
militia work are rejected. Contract expiry and dismissal clear the assignment
without refilling supplies; renewed service retains the actual counts. Invalid
saved roles and unqualified doctors are rejected.

The ordinary doctor/patient fixture declares its prepared wounds and synchronizes
the presence ledger before save admission. A separate route uses actual combat
to injure an authored world resident, provides field aid, physically recruits her,
travels to headquarters, assigns care and waits. Saved health improves with spent
dressings. Dismissal and real re-entry find the same resident with that recovered
health. This route does not inject its injury or recovery.

The mounted campaign test opens squad management, uses the actual assignment,
time and purchase controls, observes the deployment block and saves the result.
No live-browser visual or performance acceptance is claimed.

Release checks: **817/817 tests**, zero failures or skips (199,559 ms); type
check; production export (722 files, 632 asset references); 36 baseline checks;
documentation audit (207 requirements, all 50 original and 87 parity rows,
46 evidence records); 171 changed-document local links.
[PR #69](https://github.com/fsodano/granaderos/pull/69) merged after
[CI](https://github.com/fsodano/granaderos/actions/runs/36417819140/job/108913070330)
passed at `5ac433282f4c8d8caea6ab4686c5498391f8607a`.

## Limits

This is hired-personnel doctor/patient care. It does not integrate strategic
bleeding, rest/sleep, automatic bandaging, critical military first aid, militia
care, care for residents outside service, physical kit custody or finite merchant
stock. Exhaustion and unsafe occupation stop work by eligibility, but their full
advanced route acceptance remains open. The separate northern medical-relief
failure is not closed by these checks. Broader JA2 care and full release acceptance
remain partial.
