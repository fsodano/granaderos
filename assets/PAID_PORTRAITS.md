# Fictional paid volunteer portraits

The built-in image generator produced five separate original portraits for
Rafael Sosa (100), Tomasa Ríos (101), Mateo Ferreyra (102), Lucien Arnaud (105)
and Manuel Leiva (106). Prompts follow their campaign biographies and dramatic
personalities in recruitment.js and characters.js. No historical portrait or
other face was supplied as an input. These depict fictional characters in
period-inspired clothing and do not claim authenticated historical likenesses.

Exact prompts and generator cache provenance: `prompts/paid-portraits.json`.
Originals: `source/paid-portrait-{id}-v1.png`. Browser versions:
`web/portrait-{id}.webp`, installed in `web/public/art`, 384px square, 11–22KB.
Rebuild with `python3 assets/build_paid_portraits.py`. Existing portraits 103
and 104 were preserved. The generated output manifest includes dimensions,
byte counts and hashes.

All five generated portraits were visually inspected: distinct age/face and
clothing, complete heads, readable expressions, consistent painterly treatment,
and no text. Sosa has a sparse beard and work shirt; Ríos wears a travel shawl;
Ferreyra has a youthful face and apron; Arnaud is greying and reserved; Leiva has
a grey-threaded mustache and a calm instructor's expression.
