# Editor experience evidence, 11 October 2026

Scope: Studio, embedded content/map editors, standalone story/map tools,
structured fields, staged text, hierarchy, keyboard and narrow layouts.
The [acceptance plan](../../plans/editor-experience.md),
[author guide](../../authoring/campaign-studio.md) and
[contributor guide](../../development/editor-development.md) describe this work.

Status: the bounded editor UX/DX work is delivered on `codex/editor-experience`.
Affected checks, post-review regression checks, typecheck, nested export and
production browser review are completed below. Delivery is tracked in
[PR #340](https://github.com/fsodano/granaderos/pull/340).
This is an editor UX/DX record, not full game or historical campaign acceptance.
The historical `0.1` tag is unchanged.

## Final source and build

The final runtime source is
`829d61f333a8b3a935e3e74bd6c2e5180448aa56`. Follow-up tests were committed as
`4a62a441`. The [copied build identity](build-info-final.json) records version
`0.1.0`, build ID `9c8fc8c4bb92`, full source digest
`9c8fc8c4bb92c79e4f81a2bd324c9d318f8621793b08afd4c1aa35fbdef2ada1` and
runtime revision `829d61f333a8b3a935e3e74bd6c2e5180448aa56`.

| Completed receipt | Result and scope |
| --- | --- |
| [Final typecheck](typecheck-final.log) | `npm run typecheck`, terminal exit 0. |
| [Final nested export](build-final.log) | `GRANADEROS_BASE_PATH=/granaderos npm run build`, terminal exit 0; **1,413 files, 1,045 asset references**, identity `9c8fc8c4bb92`. |
| [Final master mounted checks](studio-final.log) | `campaign-studio-mounted.test.mjs`; **6 passed**, 0 failed/cancelled/skipped, terminal exit 0; **9,015.78125 ms**. |
| [Keyed-document and numeric follow-up](fields-keyed-followup.log) | `node --test tests/editor-fields-experience.test.mjs`; **9 passed**, 0 failed/cancelled/skipped, terminal exit 0; **892.543208 ms** after the final review patches. |

The review fixed duplicate numeric no-op history, replacement approval after
external changes, and acknowledgement accidentally crossing document keys.
The focused receipts above follow those corrections. The wider receipt below
predates those corrections and is retained with its actual source.

## Earlier affected candidate

The initial committed candidate was
`c9d61c6b0ba79ed157593a1723459a3c09b0ffcd`. Its build ID was
`d4cd82efd23d`, full source digest
`d4cd82efd23d5cd07fdc8180035dc73f9111e3db070a5bc644cc696e40219b76`.

| Earlier receipt | Result |
| --- | --- |
| [Affected editor gate](affected-c9d61c6b.log) | 11 selected files; **138 passed**, 0 failed/cancelled/skipped, terminal exit 0; **76,082.017583 ms**. |
| [Candidate typecheck](typecheck-c9d61c6b.log) | Typecheck passed before the review follow-up. |
| [Candidate nested export](build-c9d61c6b.log) | 1,413 files, 1,045 references, identity `d4cd82efd23d`. Superseded by the final export above. |

The selected files were `campaign-studio-mounted`, `campaign-studio-content`,
`story-editor`, `sector-editor-experience`, `campaign-editor-world-mounted`,
`editor-fields-experience`, `campaign-studio-storage`, `campaign-studio-files`,
`campaign-studio-history-assets`, `site-path` and `static-export-path` tests.
This was an affected file selection, not the quick or full repository suite.

Published log copies normalize only trailing spaces and empty end-of-file
lines. Originals remain in `.cache/editor-experience/` and the focused
follow-up's `/tmp/granaderos-editor-fields-experience-keyed-final.log`.
Reported results and build counts are unchanged.

## What the mounted checks establish

Actual `FieldEditor`, `DocumentEditor` and `DocumentDraftProvider` components
are mounted with React and JSDOM. The focused field checks establish:

- Empty and partial negative/comma input retains the numeric applied value.
  Invalid blur restores that value and exposes an associated error notice.
- Unchanged/equivalent numeric input and blur emits no extra edit. The actual
  master project-history helper keeps redo after undo and numeric focus/blur.
- Translated labels and accented record names are searchable without matching
  accents. No-result feedback and adding under a filter preserve unknown fields
  and existing records.
- Staged JSON survives document unmount/reopen under the persistent owner.
  Nested providers reuse that owner. Pending text installs a leave guard.
- Parent rejection retains text and previous applied data. A rejected map A
  apply cannot clear independently staged map B text when the same component
  changes its document path.
- External applied changes require explicit replacement approval. A later
  applied change resets approval. Accepted acknowledgement clears only that
  document's stage and releases the leave guard.

The master checks cover shared project history, separate durable projects,
stale validation/export protection, resource repair, import identity collisions
and recoverable project guards. The wider candidate gate also covers archive
admission, story tab/list semantics, advanced content staging, grouped map
tools, catalogue search, keyboard edits and selected campaign path handling.
JSDOM does not prove visible browser layout, file-picker behavior or WebGL.

## Production review

The final static review used `http://127.0.0.1:3183/granaderos` and build
`9c8fc8c4bb92`. The three reviewed routes were `/granaderos/studio/`,
`/granaderos/story/` and `/granaderos/editor/`. The standalone editors used
the default `granaderos` selection. These are local production routes;
this review does not establish a public deployment.

The following interaction results are transcribed from the root reviewer's
browser receipts. Screenshots record their visible layouts; they do not alone
prove every interaction.

| Final route and viewport | Observed result | Screenshots |
| --- | --- | --- |
| Studio, desktop and 390 × 844 | Own valid `editor-review` project restored. The World document stayed 390 px wide. Its grid scrolled inside a 364 px client region, with 812 px content. One cell was a tab stop; ArrowRight selected 17,17 and updated the context. | [Desktop](studio-desktop.png), [mobile](studio-mobile.png), [world grid](world-mobile.png) |
| Studio document text, 390 × 844 | Presentation subtitle `Texto conservado` survived switching to Proyecto. A global one-document notice stated that saves and downloads use applied data. Revisar documentos reopened the exact text; discard cleared the notice. The document stayed 390 px wide. | [Staged document](document-mobile.png) |
| Story, 1200 × 822 and 390 × 844 | One main region, no outer horizontal overflow. ArrowRight selected and focused Armas with one tab stop. `arzon` found Pistola de Arzón. No-result search retained Brown Bess; ArrowDown selected and focused Charleville. The phone export dialog fitted; closing returned focus to Exportar contenido. | [Desktop](story-desktop.png), [mobile](story-mobile.png), [mobile list](story-mobile-list.png) |
| Map, 1200 × 822 and 390 × 844 | One main region, no outer horizontal overflow. Herramientas, Mapa and Propiedades switched panels. `arbol` found Árbol; empty-selection help was visible. The phone export dialog fitted; closing returned focus to Exportar. The desktop renderer showed a populated 20 × 16 map with houses and terrain in the three-column layout. | [Desktop](map-desktop.png), [mobile](map-mobile.png), [mobile tools](map-mobile-tools.png) |

The reviewer restored the desktop viewport and left the final Studio tab
available. Native file-picker interaction was not verified in this pass.
Archive/import admission and recoverable project guards are covered by the
mounted and API checks above; no new live file-import proof is claimed here.

Earlier development review on port 3174 checked invalid presentation repair,
disabled ZIP while invalid, staged text restoration/discard, and readable
project copy/rename. Earlier production build `d4cd82efd23d` showed actual 3D
character walking and compact 20 × 16 / expanded 64 × 48 building previews.
Those observations precede the small final field patches. They are retained as
bounded earlier receipts, not a fresh review of every preview at `9c8fc8c4bb92`.
The broad character/building/weapon/campaign preview row therefore remains
open in the plan; retained mounted preview wiring and the final map render do
not establish every preview's loading and error path.

The earlier attempted port 3172 belonged to another Vinext server and returned
404. It was left unchanged and supplies no production acceptance.

## Documentation review

The final documentation source audit passed: **275 requirements, 50 original
rows, 87 parity rows and 150 evidence records**, with the progress view matching.
This is a transcribed terminal receipt; no original stdout file was saved.
It is a documentation audit, not a gameplay test.

A local documentation link/anchor check inspected **331 targets across ten
Markdown files**, with **0 failures**. `git diff --check -- docs` also passed.
These are transcribed local receipts; no raw stdout file was saved.

## Limits

This work runs affected editor checks, local typecheck and nested production
export. It does not run CI, historical campaign routes, the full game suite,
balance review or sustained performance measurements. It does not add community
hosting, new gameplay mechanics or arbitrary renderer imports. A build does
not publish GitHub Pages. Earlier studio and `0.1` receipts retain their own
sources and limits.
