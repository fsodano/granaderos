# Automatic civilian care

The inventory action **Vendar heridos** now covers the squad and visible wounded civilians in a safe sector. Its explanation states that both groups use the medics' existing dressings, time and energy.

The planner uses ordinary stand, equip, movement and typed civilian `useItem` orders. Civilian health and bandaging use their existing health scale. Critical care can repeat until the living patient reaches the first-aid limit, bleeding stops or dressings run out. It grants no energy or full recovery. A bleeding medic still receives self-care priority.

Only civilians currently visible to a conscious friendly observer enter the patient list. A selected medic must also see the civilian before planning treatment. Hidden and departed civilians do not enable the action or appear in its report. If a known patient leaves view, the report states that visibility was lost rather than disclosing current hidden health.

## Verification — 21 September 2026

57 automatic-bandaging, civilian-treatment, campaign-care and inventory-render checks pass, plus type checking and the production build. New cases verify:

- exact replay of ordinary movement and typed civilian treatment orders;
- real time and dressing use, with no patient energy gain;
- repeated critical treatment and finite-supply exhaustion;
- exclusion of hidden and departed civilians;
- named civilian health, consumed supplies and harm/refusal records through synchronization, full saves and sector reentry.

The treatment fixtures provide controlled initial wounds. The campaign fixture uses a paid hire, medical purchase, travel and report flow with an authored resident in a compact test area. These checks do not establish campaign combat balance. The changed civilian automatic-care button has render coverage.

## Live browser check — 21 September 2026

A validated Retiro save used a paid week-long contract for Gaspar Villalba, ordinary sector entry, legal movement to the sargento and equipped medical supplies. The fixture supplied an unknown-source injury of 60 HP to isolate the care action; it did not simulate a player-fired attack.

In the actual equipment panel, opening Más detalles exposed Vendar heridos with its civilian-care explanation. Clicking it reported one patient treated in two seconds. The public game state showed the sargento at 40 HP, zero bleeding and 60 bandaged wound points. Villalba retained one of his two original dressings. Reloading the page and selecting Continuar campaña preserved the 11-second tactical clock, the same civilian condition and the remaining dressing.

This live check covers one adjacent noncritical civilian and save continuation. Repeated critical care, movement to a civilian, blocked paths and hostile interruptions remain simulation evidence rather than this live check.

## Separate rescue work

This does not release campaign prisoners. Tactical rescue still requires coordinated handling in deployment manifests, tactical actor availability, custody, return ledgers, paused contracts and physical exit destinations. Sector conquest remains the current release mechanism. Prison rescue and escape remain open in the parity audit.
