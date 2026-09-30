# Equipment redesign acceptance and current progress

User references: JA2 item inspection, ammunition stacks, weapon attachments and
clicking the ammunition badge to unload. All carried supplies are ordinary items.

## Required result

- Head, torso, legs, two hands, four large pockets and eight small pockets.
- No dedicated ammunition, bandage, food or tool slots or selectors.
- Placement depends on item size, wearable region and available stack capacity.
- Compatible stacks combine; incompatible items do not silently convert.
- Weapon inspection includes compatible attachments; bayonets remain the supported
  fitting. No telescopic sight has been added.
- Clicking loaded ammunition unloads into a compatible stack or free small pocket,
  then a large pocket. A full inventory must reject without losing ammunition.
- The tactical and campaign interfaces share the same item interaction rules.

## Implemented in this pass

Removed the tactical inventory's dedicated tool, supply and active-category
selectors. Existing physical pocket and hand controls remain. A shared inspection
card now presents item artwork (existing weapon art or a generic item symbol),
quantity, weight and weapon statistics. It retains the compatible attachment
control. Inspection of a partial pocket uses that pocket's quantity, not the
aggregate amount carried. Empty inspected slots no longer display stale contents
in the card.

Validation: 43 focused control/campaign/inspection tests and 30 further equipment,
ammunition and cursor checks passed (the inspection tests overlap). Typecheck and
production build passed; export verified 960 files and 856 asset references.

## Still open

Head and leg slots are not implemented; existing clothing still uses one outfit slot. The
remaining transfer forms and campaign equipment lists need further simplification.
Dedicated artwork for non-weapon items and visual browser acceptance are pending.
These results do not establish the full redesign or full gameplay as complete.

The separate performance requirement remains 60 FPS at 100% zoom in a loaded
scenario with up to 30 enemies. Earlier six-soldier scenery measurements do not
prove this requirement. Campaign difficulty must also be reviewed against the
requested progression from approximately four to thirty enemies.

## Ammunition unloading follow-up

The ammunition badge now issues a physical-slot unload order in both battle and
campaign equipment. Recovered cartridges retain the gun's prepared-load family.
Placement merges compatible stacks before using free small pockets, then free
large pockets. Insufficient total room rejects the entire operation. The other
gun, weapon identity, condition, fittings and existing cursor contents remain
owned. An empty gun or stale host reference cannot produce cartridges.

Combat costs 12 AP; exploration uses the normal elapsed-action and contact path.
Campaign arrangement keeps its existing no-time contract. Recovering reusable
cartridges from these muzzle-loading firearms is an explicit gameplay adaptation,
not a claim about historical unloading procedure. The action does not return
priming powder or repair a failed mechanism. Unfinished reload work is cancelled.

Verification: 27 reducer, campaign, ammunition and inspection tests plus 26
component and controls tests passed. The badge click itself is exercised, along
with full pockets, selected stored guns, attachment metadata, AP shortage, stale
requests, tactical save admission and campaign save/redeployment. Typecheck and
production build passed. Live browser visual acceptance remains pending.
