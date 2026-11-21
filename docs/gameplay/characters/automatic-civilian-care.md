# Automatic civilian care

On the tactical battlefield, the inventory action **Vendar heridos** covers the squad and visible wounded civilians in a safe sector. Its explanation states that both groups use the medics' existing dressings, time and energy.

The planner uses ordinary stand, equip, movement and typed civilian `useItem` orders. Civilian health and bandaging use their existing health scale. Critical care can repeat until the living patient reaches the first-aid limit, bleeding stops or dressings run out. It grants no energy or full recovery. A bleeding medic still receives self-care priority.

Only civilians currently visible to a conscious friendly observer enter the patient list. A selected medic must also see the civilian before planning treatment. Hidden and departed civilians do not enable the action or appear in its report. If a known patient leaves view, the report states that visibility was lost rather than disclosing current hidden health.

## Separate rescue work

This does not release campaign prisoners. Tactical rescue still requires coordinated handling in deployment manifests, tactical actor availability, custody, return ledgers, paused contracts and physical exit destinations. Sector conquest remains the current release mechanism. Prison rescue and escape remain open in the [parity requirements](../../requirements/ja2-parity.md).
