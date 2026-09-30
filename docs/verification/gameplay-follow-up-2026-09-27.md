# Gameplay follow-up — 27 September 2026

The campaign has its main chapters and core tactical systems. This follow-up
closes specific control and information gaps. It does not establish a complete
playable campaign or full JA2 parity. The [parity audit](ja2-parity-audit.md)
remains the requirement baseline.

## Implemented in this follow-up

- **New campaign introduction:** four animated scenes introduce the setting,
  San Martín's commission and the independence objective before the desk.
  The last scene opens hiring or character creation directly. Skip, pause,
  replay and reduced-motion support preserve the existing save. Source notes
  stay in the project documentation, outside the game. See [opening sequence](../gameplay/campaign/campaign-intro.md).
- **Failed second pistol:** R and the existing weapon control prepare a failed
  held second pistol without swapping hands. Each pan uses its own normal AP
  and priming-powder cost. Partial preparation retains the unfinished gun.
  Loading an empty usable main gun takes priority over servicing the spare.
  AI uses the same finite preparation rules. See [paired priming](../gameplay/equipment/paired-pistol-reprime.md).
- **Blocked deliveries:** an explicit wait stops once when overdue production,
  imported equipment, cargo or a convoy cannot arrive. The notice gives the
  existing cause and survives reload. Repeating a wait does not repeat an
  unchanged blockage. Paid cargo stays queued and only the ordinary delivery
  path credits it. See [logistics attention](../gameplay/campaign/logistics-attention.md).
- **Rescue information:** firearm previews warn about visible allies and
  civilians in the direct line or a legal missed-shot path. The preview does
  not reveal unseen bodies or change the shot. The prisoner panel distinguishes
  an escort order from a prisoner currently fleeing or taking shelter.

The existing free one-person start, lower walking fatigue, campaign performance
work, scroll/pinch controls, portrait centering and individual route replacement
remain recorded in the [earlier same-day record](gameplay-and-campaign-performance-2026-09-27.md).

## Remaining acceptance work

1. **A complete fresh campaign.** Prove recruitment through the ending with
   ordinary orders, actual losses, paid contracts, finite supplies, deterministic
   battle replay and complete saves. A successful isolated battle does not prove
   that the full route reaches it with the same force and resources.
2. **Recovery and rescue under pressure.** Resolve attacks during medical care,
   then finish care for the actual living patients at their actual locations.
   Win a physical prisoner rescue and leave through the authorized map boundary.
   The current Humahuaca attempts lose the guard fight; no successful evacuation
   is claimed. See [current rescue evidence](../evidence/humahuaca-rescue-2026-09-27.json).
   The fresh route now passes paid Córdoba recovery, its actual defense, and a
   Tucumán victory. The next helper fails when a wounded location has no fit
   local medic. It must arrange real relief. See [current campaign evidence](../evidence/campaign-progress-cordoba-2026-09-27.json).
3. **Sustained performance.** Check cold map entry, larger battles, changing
   lights, room reveals, group movement and repeated save/reload. The measured
   single-merc long walk does not prove every scene meets the frame budget.
   Individual route replacement is implemented; group movement still uses
   sequential orders and needs its own interruption/animation acceptance.
4. **Editable story integration.** Connect the other task's content model to
   campaign progression, roles, dialogue and missions, including validation and
   save compatibility. This follow-up does not change its content architecture.
5. **Remaining parity systems.** Examples include casualty carrying,
   self-directed prison escape, vaulting and water traversal, garment wear and
   repair, further projectile/explosive behavior, and transport passenger rules.
   These need their own usable controls, persistence and acceptance scenarios.
   The audit also retains contract, relationship, civilian and AI extensions.
   Head/torso/leg equipment slots already exist; they are not missing work.
6. **Presentation and player guidance.** Finish approved equipment-specific
   character artwork and check that a new player can understand recruitment,
   equipment, combat, recovery and campaign objectives without developer help.

## Player check

A short opening session is useful before a complete playthrough: recruit or
create one merc, move a long distance, replace the destination, run, pan/zoom,
center the camera, fight, save and reload. Record the location, action, expected
result and observed result. Difficulty spikes and unclear instructions are
valid findings even when no technical error appears.

## Validation

- Full current-worktree run: **2,951 tests, 2,944 passed, four failed, three
  skipped**, in 285.1 seconds. The failures are the fresh route's missing fit
  medic after Tucumán; the established Córdoba recapture defeat (child and
  parent failures); and the physical Humahuaca rescue defeat. No logistics,
  intro, paired-priming or bystander-preview checks fail.
- The final intro wording cleanup was followed by all **22 intro, Home and
  Retiro desk checks passing**. Typecheck and the production build pass. Static
  export verifies 962 files and 858 asset references.
- Native browser review on the isolated production QA origin verified new-game
  entry, pause, scene selection, San Martín's message without a source note,
  both visible final choices, direct character-creation entry and menu replay.
  Browser warnings/errors were empty. The user's `localhost:3000` save was not
  used for these checks.
- The new weapon/logistics/body-equipment cohort passes **156 checks**. Separate
  warning and geometry checks include 80 comparisons against exhaustive legal
  scatter paths. Repeated preview work avoids paths that cannot cross a known
  bystander; no hidden-body information or mutable snapshot cache is introduced.

These results do not close the full campaign, rescue balance or universal
frame-rate requirements. Current saves and ordinary player choices remain the
source of truth; no route victory or casualty assertion was weakened.
