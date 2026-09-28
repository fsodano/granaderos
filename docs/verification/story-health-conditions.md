# Authored health conditions for dialogue and campaign story

Source: `ea854d4b0d1ccdf61e32f771f5be95dd00b09823`.

Character conditions now include conscious, unconscious, wounded, bleeding,
conscious without bleeding, and full health while conscious. The same validated
states are available in dialogue choices, campaign chapters and failure rules.
They do not imply presence or service; authors can combine those existing
conditions when required. Every physical state excludes dead characters.

Consciousness uses the actual critical-health and energy rule. Wounded means
health below the current maximum, including earned experience increases.
Stabilized means conscious and not bleeding; that actor can still be wounded.
Full health additionally requires the current maximum. These predicates change
no health, resources or story state by themselves.

Dialogues use the actual actor in the matching active scene, including named
mission allies. They ignore another battle or scene. Outside deployment they
use the saved identity and current maximum. A deployed military actor without
its current matching scene has unknown physical condition: none of the new
physical predicates can pass from its older service sheet. The existing
alive/dead/presence/service rules retain their distinct meaning.

A validated tactical checkpoint evaluates authored failure rules with its current
scene. This prevents delayed unconsciousness failures and prevents an older
healthy service record from triggering a false physical result during clock
advancement. Chapter success still waits for ordinary scene settlement. A
civilian's accepted condition and a returned soldier's condition persist normally.

## Acceptance

Six simulation cases cover:

- Strict state validation, older content identity and health independent of
  off-map presence or service.
- Actual paid deployment of an authored critical patient, two finite aid strokes,
  updated choices before military settlement, and rejection of unrelated scenes.
- An authored one-health resident, actual finite first aid, a newly available
  response and a rescue chapter that completes only on saved departure.
- Bleeding and exhaustion distinctions, and a prepared experience change that
  uses the current maximum rather than an old saved ceiling.
- A named mission ally and a prepared critical wound before its service record
  is acknowledged.
- An actual enemy shot and bleeding that leave a serving actor at eight health.
  Before the fix, its old 80-health service sheet hid the authored unconsciousness
  failure. After the fix, the validated active save retains the eight-health
  casualty, immediate campaign defeat and pending battle, without inventing a
  death or completing the campaign.

Prepared compact encounter geometry, hostile loadouts, the isolated dead/critical
query boundaries and experience are declared fixtures. The rescue and military
aid routes use authored starting wounds, paid service and ordinary finite care.

The mounted editor exposes all six states, undoes/redoes a change, duplicates
its dialogue, launches the saved condition and keeps later draft changes out of
the launched campaign. The existing 66-case editor/dialogue group passed before
the final checkpoint extension; the final story/condition group passes 24 checks.
These overlap and are not an additive total.

At the source above, the complete release suite passes **865/865** checks,
with zero failures or skips, in 205,134 ms. Browser types, the static export
(722 files and 632 checked references), and all 36 baseline checks pass.
The documentation audit preserves the 50 original requirements and 87 parity
rows within 216 tracked requirements and 55 evidence records. GitHub publication
and exact-head CI are recorded separately when this feature is merged.

## Limits

These conditions reveal authored choices and evaluate explicit objectives. They
do not create automatic treatment speech, infer gratitude, apply a hidden reward
or validate arbitrary story balance. First-aid and recovery costs remain unchanged.
The existing six-condition conjunction and chapter settlement policy remain.
Automatic medical responses, physical custody and full advanced gameplay remain
separate requirements. Mounted DOM and simulation do not establish live-browser
usability, performance or complete campaign parity.
