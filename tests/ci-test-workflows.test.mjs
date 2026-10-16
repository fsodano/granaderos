import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=name=>readFileSync(new URL(`../.github/workflows/${name}.yml`,import.meta.url),'utf8');

test('automatic test workflow delegates complete changed paths to one classifier and requests only quick scope jobs',()=>{
 const source=workflow('tests');
 assert.match(source,/pull_request:\s*\n\s+types: \[opened, synchronize, reopened, ready_for_review\]/);
 assert.match(source,/push:\s*\n\s+branches: \[main\]/);
 assert.match(source,/!github\.event\.pull_request\.draft/);
 assert.match(source,/fetch-depth: 0/);
 assert.match(source,/filter: blob:none/);
 assert.match(source,/github\.event\.pull_request\.base\.sha \|\| github\.event\.before/);
 assert.match(source,/github\.event\.pull_request\.head\.sha \|\| github\.sha/);
 assert.match(source,/three-dot.*two-dot/);
 assert.match(source,/node tools\/ci-test-selection\.mjs --base "\$BASE_SHA" --head "\$HEAD_SHA" --comparison "\$COMPARISON" --github-output/);
 assert.doesNotMatch(source,/paths(?:-ignore)?:/,'Path ownership belongs to the classifier, not a second YAML list.');
 for(const scope of ['core','campaign']){
  const job=source.split(`\n  ${scope}:\n`)[1].split(/\n  \w+:\n/)[0];
  assert.match(job,new RegExp(`needs.select.outputs.${scope} == 'true'`));
  assert.match(job,new RegExp(`uses: ./\\.github/workflows/test-${scope}\\.yml`));
  assert.match(job,/duration: quick/);assert.doesNotMatch(job,/duration: (full|extended)/);
 }
 assert.match(source,/group: focused-tests-\$\{\{ github.event.pull_request.number \|\| github.run_id \}\}/,'A later documentation-only main push must not cancel an earlier relevant two-dot check.');
 assert.match(source,/cancel-in-progress: true/);assert.match(source,/contents: read/);
 assert.doesNotMatch(source,/pull_request_target|contents: write|npm (?:run build|test\b)|test-shard\.mjs --run|secrets:/);
});

test('each separate workflow keeps full and extended explicit and runs all selected assertions without builds',()=>{
 for(const scope of ['core','campaign']){
  const source=workflow(`test-${scope}`);
  assert.match(source,/workflow_call:/);assert.match(source,/workflow_dispatch:/);
  assert.match(source,/options: \[quick, full, extended\]/);
  assert.equal(source.match(/default: quick/g).length,2);
  assert.match(source,new RegExp(`npm run test:${scope} -- --duration "\\$DURATION" --concurrency 2`));
  assert.match(source,/DURATION: \$\{\{ inputs.duration \}\}/);
  assert.match(source,/npm ci --prefix web/);assert.match(source,/contents: read/);assert.match(source,/if: always\(\)/);
  assert.match(source,new RegExp(`path: \\.cache/test-times/${scope}\\*\\.json`));
  assert.doesNotMatch(source,/pull_request:|push:|--test-name|--test-skip|--test-only|typecheck|npm run build|sccache|pages-artifact|contents: write/);
 }
});

test('Pages publishes main pushes and retains manual builds without PR, tag or other-branch deployment',()=>{
 const source=workflow('web'),events=source.split('\non:\n')[1].split('\nconcurrency:')[0];
 assert.match(events,/^  push:\n    branches: \[main\]\n  workflow_dispatch:\s*$/);
 assert.doesNotMatch(events,/pull_request|tags:|branches-ignore:|paths(?:-ignore)?:/);
 assert.match(source,/group: web-game-\$\{\{ github.ref \}\}/);assert.match(source,/cancel-in-progress: true/);
 assert.match(source,/name: Upload GitHub Pages artifact\n        if: github.ref == 'refs\/heads\/main'/);
 assert.match(source,/deploy:\n    name: Publish browser game\n    if: github.ref == 'refs\/heads\/main'\n    needs: web/);
 assert.match(source,/assert.equal\(build.revision,process.env.GITHUB_SHA/);
 assert.match(source,/uses: actions\/deploy-pages@v4/);
 assert.doesNotMatch(source,/uses: \.\/\.github\/workflows\/test-|npm (?:test\b|run test:)|pull_request_target/);
 const windows=workflow('build-windows').split('\non:\n')[1].split('\npermissions:')[0];
 assert.match(windows,/workflow_dispatch:/);assert.doesNotMatch(windows,/pull_request:|push:/);
});
