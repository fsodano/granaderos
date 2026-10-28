# Character source tools

Run these tools from the repository root. Authoring sources are in
`content/assets/source/characters-3d/authoring`. Published models are in
`apps/web/public/models/characters`. Generated review evidence belongs in
`.output/artifacts`.

Published GLB receipts contain the source paths and SHA-256 identities used to
build each model. `source-relocation-v1.json` maps those published identities to
current source paths and exact relocated file hashes. `source_provenance.py`
checks the current bytes before it returns a published identity. A source change
outside this table fails admission. The mapping changes no model, texture,
recipe parameter, or published receipt.

Source changes that alter model construction require a new recipe and a new
verified model build. Do not update the relocation table to admit such changes.
Keep historical capture manifests and embedded GLB source references as provenance
records. Active authoring inputs and filesystem reads use the current layout.

Run `python3 -m unittest tests.test_source_provenance` to check recipe identities
against the published model receipts and to test rejection of changed sources.
Run `python3 tools/characters-3d/apparel_png_replay.py --verify-only` to check all
published apparel and equipment layers without writing them. Run
`python3 tools/characters-3d/build-standing-free-arm-rest.py --verify-only` to
check both published animation banks without writing them.
