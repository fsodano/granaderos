# Authored first-aid responses

Runtime/test source: `2f7f0187d95b0b199c0b7a3fe767ff527910ae99`.

The character sheet offers an optional response for receiving first aid from
another person. An accepted tactical treatment spends its normal dressing and
AP or time, applies actual care, then emits the authored line if the patient is
living, present and conscious at that point. This covers serving soldiers,
mission allies and world residents using their existing pinned presentation.
There is no default gratitude line, reward, health grant or extra random roll.

A partial critical treatment that leaves the person unconscious stays silent.
The stroke that restores consciousness can produce the line. Zero energy still
prevents speech, even if a later civilian phase wakes the patient during the same
order's elapsed time. Self-bandaging, rejected orders, blank or omitted text,
strategic recovery, resting and loading a saved state produce no treatment line.
A later effective treatment may speak again; this is a response to each paid
stroke, not a once-per-campaign dialogue reward.

The new `treated` speech field is optional. Existing seven-field speech records,
default package serialization and older content identities remain unchanged.
Unknown fields, missing older required events, invalid types and lines over
800 characters fail validation. Active and retained actors must still match the
voice pinned in their campaign package.

## Acceptance

Five simulation cases cover:

- Optional strict validation and an older package's unchanged identity.
- Actual paid arrival of an authored critical patient, two finite strokes with a
  save between them, speech only on consciousness, and no replay after save,
  rejected repeat care, ambient time or sector return.
- An authored critical resident, actual approach and finite aid, saved speech,
  rejection of altered saved presentation, later draft isolation and scene return
  with the same 15 health and no remaining dressings.
- Prepared compact encounters for normal bandaging, silent profiles, exhaustion,
  partial critical care, invalid orders and self-care.
- Prepared loaded civilian clock boundaries before and after a six-second phase:
  recovery can wake the treated patient but cannot retroactively emit a response.

The mounted editor verifies optional text, undo/redo, duplication, removal of an
empty optional field and pinned campaign launch. The initial editor/presentation
and treatment group passes 70 checks; the final five-case treatment group adds
the civilian clock boundary. These counts overlap. At the source above, the full release suite passes
**871/871** tests, with zero failures or skips, in 206,775 ms. Types, production
export (722 files, 632 asset references), all 36 baseline checks and the
documentation audit pass (217 requirements, all 50 original and 87 parity rows,
56 evidence records). Exact-head GitHub CI and publication are recorded separately.

## Limits

This delivery adds an authored tactical log response. It does not add recorded
voice, strategic care barks, gratitude scores, automatic recruitment, dialogue
node effects, physical inventory or held-item targeting. The original seven
speech events retain their existing behavior. Prepared condition fixtures are
not a complete campaign, and mounted DOM checks are not live-browser usability
or performance acceptance.
