import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const data = JSON.parse(read('docs/verification/requirements.json'));
const errors = [];
const need = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};
const statuses = [
  'VERIFIED',
  'PARTIAL',
  'LOCAL_ONLY',
  'MISSING',
  'FAILED',
  'UNVERIFIED',
  'SUPERSEDED',
];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const file = (path, label) => {
  if (!nonempty(path)) {
    need(false, `${label}: missing path`);
    return;
  }
  const target = resolve(root, path),
    rel = relative(root, target);
  need(
    !rel.startsWith('..' + sep) && !rel.startsWith(sep) && existsSync(target),
    `${label}: missing or external path ${path}`,
  );
};
const historicalTestFile = (entry, label) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    need(false, `${label}: invalid historical test record`);
    return;
  }
  need(
    Object.keys(entry).length === 2 &&
      Object.keys(entry).every((key) => ['revision', 'path'].includes(key)),
    `${label}: historical test record needs only revision and path`,
  );
  need(
    typeof entry.revision === 'string' && /^[0-9a-f]{40}$/.test(entry.revision),
    `${label}: historical test needs an exact revision`,
  );
  need(
    typeof entry.path === 'string' &&
      /^(?:tests|tools)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.mjs$/.test(entry.path),
    `${label}: historical test needs a safe repository-relative source path`,
  );
};
need(data.schema === 1, 'Unsupported requirement schema');
need(/^\d{4}-\d{2}-\d{2}$/.test(data.updated), 'Invalid update date');
need(/^[0-9a-f]{40}$/.test(data.baseline), 'Baseline must identify an exact commit');
file(data.audit, 'Audit');
file(data.design, 'Design');
for (const key of ['checkpointScope', 'futureCampaignScope']) {
  if (data[key] !== undefined) {
    file(data[key], key);
  }
}
if (data.reviewedSource !== undefined) {
  need(/^[0-9a-f]{40}$/.test(data.reviewedSource), 'Reviewed source must identify an exact commit');
}
const evidence = new Map();
for (const e of data.evidence ?? []) {
  need(!evidence.has(e.id), `Duplicate evidence ${e.id}`);
  evidence.set(e.id, e);
  file(e.path, e.id);
  need(nonempty(e.description), `${e.id}: missing evidence limits`);
  if (e.url) {
    need(
      e.url.startsWith('https://github.com/fsodano/granaderos/'),
      `${e.id}: invalid evidence URL`,
    );
  }
}
const ids = new Set();
for (const r of data.requirements ?? []) {
  need(/^(?:[A-Z]+-\d+|JA2-[A-Z]\d+)$/.test(r.id), `Invalid requirement ID ${r.id}`);
  need(!ids.has(r.id), `Duplicate requirement ${r.id}`);
  ids.add(r.id);
  need(statuses.includes(r.status), `${r.id}: invalid status ${r.status}`);
  need(['P0', 'P1', 'P2'].includes(r.priority), `${r.id}: missing priority`);
  for (const key of ['group', 'requirement', 'published', 'local', 'acceptance']) {
    need(nonempty(r[key]), `${r.id}: missing ${key}`);
  }
  need(
    r.status === 'VERIFIED' ? r.remaining === '' : nonempty(r.remaining),
    `${r.id}: verified scope has a gap, or open scope lacks one`,
  );
  need(Array.isArray(r.evidence) && r.evidence.length > 0, `${r.id}: missing evidence`);
  for (const id of r.evidence ?? []) {
    need(evidence.has(id), `${r.id}: unknown evidence ${id}`);
  }
  for (const path of r.testFiles ?? []) {
    file(path, r.id);
  }
  const historical = r.historicalTestFiles === undefined ? [] : r.historicalTestFiles;
  need(Array.isArray(historical), `${r.id}: historicalTestFiles must be an array`);
  if (Array.isArray(historical)) {
    const seen = new Set();
    for (const entry of historical) {
      historicalTestFile(entry, r.id);
      const key = `${entry?.revision}:${entry?.path}`;
      need(!seen.has(key), `${r.id}: repeated historical test record`);
      seen.add(key);
    }
  }
  if (r.pr) {
    need(
      /^https:\/\/github\.com\/fsodano\/granaderos\/pull\/\d+$/.test(r.pr),
      `${r.id}: invalid PR`,
    );
  }
  if (r.status === 'VERIFIED') {
    need(
      r.testFiles?.length > 0 ||
        (Array.isArray(historical) && historical.length > 0) ||
        r.id === 'DATA-01',
      `${r.id}: verified scope needs specific current or historical test sources`,
    );
  }
}
for (const r of data.requirements ?? []) {
  for (const id of r.parents ?? []) {
    need(ids.has(id), `${r.id}: unknown parent ${id}`);
  }
}
const source = JSON.parse(read('docs/evidence/formal-audit-2026-09-27/parity-source.json'));
need(source.requirements.length === 87, 'The original parity register must retain 87 requirements');
for (const r of source.requirements) {
  need(ids.has(r.id), `Dropped parity requirement ${r.id}`);
}
const history =
  read('docs/archive/published-progress-through-pr28.md')
    .split('## Full requirements and acceptance evidence')[1]
    ?.split('## Historical work log')[0] ?? '';
const original = [...history.matchAll(/^\| ([A-Z]+-\d+) \|/gm)].map((m) => m[1]);
need(original.length === 50, 'The original register must retain 50 broad requirements');
for (const id of original) {
  need(ids.has(id), `Dropped original requirement ${id}`);
}
for (const q of data.queue ?? []) {
  need(nonempty(q.action), 'Queue action missing');
  for (const id of q.ids ?? []) {
    need(ids.has(id), `Unknown queued requirement ${id}`);
  }
}
const auditPath = 'docs/evidence/formal-audit-2026-09-27';
const archivedChecks = JSON.parse(read(`${auditPath}/checks.json`));
const checks = {
  ...archivedChecks,
  published: data.latestPublishedCheck ?? archivedChecks.published,
};
if (data.latestLocalCheck) {
  checks['local-candidate'] = data.latestLocalCheck;
}
for (const key of ['sourceRelationship', 'snapshotSummary']) {
  if (data[key] !== undefined) {
    need(nonempty(data[key]), `Invalid ${key}`);
  }
}
if (data.latestPublishedCheck) {
  need(
    /^[0-9a-f]{40}$/.test(checks.published.source),
    'Latest published check needs an exact source commit',
  );
  need(
    evidence.has(checks.published.evidenceId),
    'Latest published check needs registered evidence',
  );
}
if (data.latestLocalCheck) {
  need(
    /^[0-9a-f]{40}$/.test(data.latestLocalCheck.source),
    'Latest local check needs an exact source commit',
  );
  need(
    evidence.has(data.latestLocalCheck.evidenceId),
    'Latest local check needs registered evidence',
  );
}
for (const [name, c] of Object.entries(checks)) {
  need(
    ['total', 'passed', 'failed', 'skipped'].every((k) => Number.isSafeInteger(c[k]) && c[k] >= 0),
    `${name}: invalid test counts`,
  );
  need(c.total === c.passed + c.failed + c.skipped, `${name}: inconsistent test counts`);
  if (c.storedLogSha256) {
    const digest = createHash('sha256')
      .update(read(`${auditPath}/${name}-tests.txt`))
      .digest('hex');
    need(digest === c.storedLogSha256, `${name}: altered retained log`);
  }
}
// Validate local links in the canonical documents, not historical external sites.
for (const path of [
  'docs/README.md',
  'docs/specification/game-design.md',
  'docs/verification/formal-audit-2026-09-27.md',
]) {
  for (const m of read(path).matchAll(/\]\(([^)]+)\)/g)) {
    const link = m[1];
    if (/^[a-z]+:|^#/.test(link)) {
      continue;
    }
    file(
      relative(root, resolve(root, dirname(path), decodeURIComponent(link.split('#')[0]))),
      path,
    );
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const cell = (text) =>
  String(text ?? '')
    .replaceAll('|', '&#124;')
    .replaceAll('\n', ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const link = (path) =>
  relative(resolve(root, 'docs/verification'), resolve(root, path)).split(sep).join('/');
const counts = Object.fromEntries(
  statuses.map((s) => [s, data.requirements.filter((r) => r.status === s).length]),
);
const historicalRevisions = [
  ...new Set(
    data.requirements.flatMap((r) => (r.historicalTestFiles ?? []).map((entry) => entry.revision)),
  ),
];
const checkLabel = (name) =>
  data.latestLocalCheck && ['original', 'prototype', 'presence'].includes(name)
    ? `${name} (2026-09-27 snapshot)`
    : name;
const out = [
  '# Granaderos implementation and verification ledger',
  '',
  '<!-- Generated from requirements.json by npm run docs:progress. Edit the register, not this view. -->',
  '',
  `Updated ${data.updated}. **${data.checkpointScope ? 'This wider register is not the version 0.1 completion checklist.' : 'The complete game and story editor are not accepted.'}**`,
  '',
  ...(data.checkpointScope
    ? [
        `Read [version 0.1 scope and validation](${link(data.checkpointScope)}) for this checkpoint. [Community campaign creation and sharing](${link(data.futureCampaignScope)}) are future work. Broader unaccepted rows remain visible without becoming checkpoint release conditions.`,
        '',
      ]
    : []),
  `Read [the design](${link(data.design)}) for the target and [the formal audit](${link(data.audit)}) for evidence and limits.`,
  `The published baseline assessed here is \`${data.baseline}\`. ${data.reviewedSource ? `It is a recorded baseline; this documentation reconciliation reviewed source \`${data.reviewedSource}\`. Current checkpoint checks are recorded separately.` : 'Later PRs must update this register.'}`,
  data.sourceRelationship ??
    'The larger local sources and the editor prototype are separate from published main.',
  '',
  data.checkpointScope ? '## Recorded check results' : '## Verified results and current failures',
  '',
  '| Source | Passing / total | Failed | Skipped | Types / build |',
  '|---|---:|---:|---:|---|',
  ...Object.entries(checks).map(
    ([name, c]) =>
      `| ${checkLabel(name)} | ${c.passed} / ${c.total} | ${c.failed} | ${c.skipped} | ${c.types} / ${c.build} |`,
  ),
  '',
  data.snapshotSummary ??
    'The advanced local suite has three independent failure points; a failed child also fails its parent. Three later route milestones are skipped. The prototype fails at San Lorenzo. Published CI runs a smaller suite and cannot close those failures. The presence row preserves the earlier local audit snapshot; newer published verification is recorded separately.',
  '',
  '## Status and maintenance rules',
  '',
  '- VERIFIED: the complete **bounded row** has specific accepted evidence. Parent requirements remain separate.',
  '- PARTIAL: a published subset exists; the row states the remaining work.',
  '- LOCAL_ONLY: relevant implementation exists locally but is not accepted in the published release.',
  '- MISSING: no accepted implementation of the stated capability was found.',
  '- FAILED: required acceptance currently fails, or the combined release is inconsistent.',
  '- UNVERIFIED: available evidence does not establish acceptance.',
  '- SUPERSEDED: an explicit design change replaced the old requirement.',
  '',
  `The register retains ${data.requirements.length} entries: ${Object.entries(counts)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')}.`,
  'Rows overlap in scope. Neither these counts nor test totals are a completion percentage.',
  '',
  '`testFiles` identifies test sources retained in the current tree. It does not record a current test pass. `historicalTestFiles` preserves earlier test and helper source references with an exact revision and repository-relative path. These records retain earlier evidence; they are not current automated coverage. VERIFIED rows retain their accepted historical scope. The check table above remains unchanged.',
  ...(historicalRevisions.length
    ? [
        `Historical test sources remain available in Git at ${historicalRevisions.map((revision) => `[\`${revision}\`](https://github.com/fsodano/granaderos/tree/${revision})`).join(', ')}. The documentation audit validates the record shape, revision and safe path; it does not execute those tests or verify archived Git objects. See [the current test gate](../../tests/README.md) for the retained routine checks.`,
        '',
      ]
    : ['']),
  'Edit [requirements.json](requirements.json), record exact source/checks and remaining gaps, then run `npm run docs:progress` and `npm run audit:docs`. Update the design for policy changes. A dated audit stays an evidence snapshot. Do not mark a local branch as published or close a broad row from one passing fixture.',
  '',
  '## Scope changes that override the original specification',
  '',
  '[Current design decisions](../specification/game-design.md#decisions-that-override-earlier-documents) preserve the pesos-only economy, all elite contract terms, hire-only candidates and the approved opening. Old material-production and horse-care requirements do not override those decisions.',
  ...(data.checkpointScope
    ? [
        'The current finite-equipment policy disables commerce and defers shops. Historical commerce receipts and status labels remain recorded; they do not describe enabled purchases in version 0.1.',
        '',
      ]
    : ['']),
  data.checkpointScope ? '## Checkpoint work and future scope' : '## Delivery order',
  '',
  ...data.queue.map((q) => `${q.order}. **${q.ids.join(', ')}** — ${q.action}`),
  '',
  data.checkpointScope
    ? 'Keep checkpoint validation separate from the future platform plan. Preserve recorded sources, wider requirements and approved pesos/contract policies.'
    : 'Finish one bounded feature, its controls and persistence, update evidence, pass relevant checks and exact-head CI, then merge. Preserve the unpublished sources and approved pesos/contract policies.',
  '',
];
for (const group of new Set(data.requirements.map((r) => r.group))) {
  out.push(
    `## ${group}`,
    '',
    '| ID | Requirement | Status | Published scope | Remaining work / acceptance |',
    '|---|---|---|---|---|',
  );
  for (const r of data.requirements.filter((r) => r.group === group)) {
    const proof = r.pr ? ` [PR](${r.pr})` : '';
    out.push(
      `| ${r.id}${proof} | ${cell(r.requirement)} | ${r.status} | ${cell(r.published)} | ${cell(r.remaining || r.acceptance)} |`,
    );
  }
  out.push('');
}
out.push('## Evidence index', '', '| ID | Evidence | Scope and limits |', '|---|---|---|');
for (const e of data.evidence) {
  out.push(
    `| ${e.id} | [Record](${link(e.path)})${e.url ? ` · [CI](${e.url})` : ''} | ${cell(e.description)} |`,
  );
}
out.push(
  '',
  'Per-row acceptance, local assessment, source notes and test paths are retained in [the register](requirements.json). The full 87-row historical parity assessment is preserved in the audit; its old implementation claims are not fresh certification. Earlier milestones remain in [the historical log](../archive/published-progress-through-pr28.md).',
  '',
);
const rendered = out.join('\n');
if (process.argv.includes('--write')) {
  writeFileSync(resolve(root, 'docs/verification/published-progress.md'), rendered);
} else if (read('docs/verification/published-progress.md') !== rendered) {
  console.error('docs/verification/published-progress.md is stale. Run npm run docs:progress.');
  process.exit(1);
}
console.log(
  `Documentation audit passed: ${data.requirements.length} requirements, 50 original rows, 87 parity rows, ${evidence.size} evidence records; progress view matches.`,
);
