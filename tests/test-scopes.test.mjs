import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import campaignTests from '../tools/test-campaign-config.mjs';
import {partitionTestScopes,assertReviewedTestScopes} from '../tools/test-scopes.mjs';
import {discoverTests} from '../tools/test-runner-lib.mjs';
import {suiteManifest} from '../tools/test-suites.mjs';

test('reviewed campaign membership is complete and disjoint from default core membership',()=>{
 const all=['tests/mechanics.test.mjs','tests/scenario.test.mjs','tests/new.test.mjs'],campaign=[{file:all[1],reason:'Specific scenario acceptance.'}];
 const {scopes}=partitionTestScopes(all,campaign);
 assert.deepEqual(scopes,{core:[all[0],all[2]],campaign:[all[1]]});
 assert.deepEqual([...scopes.core,...scopes.campaign].sort(),[...all].sort());
 for(const config of [null,[{file:all[1],reason:''}],[{file:'tests/missing.test.mjs',reason:'Stale.'}],[...campaign,...campaign]])assert.throws(()=>partitionTestScopes(all,config));
 assert.throws(()=>partitionTestScopes([...all,all[0]],campaign),/repeated/);
 assert.throws(()=>partitionTestScopes([],campaign),/No test files/);
});

test('new earned inputs and full route imports require explicit review while portable engine tests stay core',t=>{
 const root=mkdtempSync(resolve(tmpdir(),'granaderos-scope-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(resolve(root,'tests'));
 const file='tests/rules.test.mjs',earned=`const input = new URL('./fixtures/input.${'g'+'z'}',import.meta.url);`,route=`import {prepare} from './${'fresh-'+'campaign-route'}.mjs';`;
 for(const source of [earned,route]){
  writeFileSync(resolve(root,file),source);
  assert.throws(()=>assertReviewedTestScopes(root,[file],[],[]),/Review the campaign scope/);
  assert.deepEqual(assertReviewedTestScopes(root,[file],[{file,reason:'Native earned scenario.'}],[]),{core:[],campaign:[file]});
  assert.deepEqual(assertReviewedTestScopes(root,[file],[],[{file,reason:'Generic migration using a declared input.'}]),{core:[file],campaign:[]});
 }
 writeFileSync(resolve(root,file),"import {dispatch} from '../game/campaign.js'; // shared generic reducer\n");
 assert.deepEqual(assertReviewedTestScopes(root,[file],[],[]),{core:[file],campaign:[]});
 assert.throws(()=>assertReviewedTestScopes(root,[file],[],null),/must be an array/);
 assert.throws(()=>assertReviewedTestScopes(root,[file],[],[{file:'tests/stale.test.mjs',reason:'Stale.'}]),/target is missing/);
 assert.throws(()=>assertReviewedTestScopes(root,[file],[{file,reason:'Campaign.'}],[{file,reason:'Core.'}]),/belongs to campaign/);
});

test('repository scope and duration partitions retain every test and all original complete campaign gates',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),all=await discoverTests(root),scopes=assertReviewedTestScopes(root,all);
 assert.equal(scopes.campaign.length,campaignTests.length);assert.equal(scopes.core.length+scopes.campaign.length,all.length);
 for(const file of ['tests/fresh-ending-route.test.mjs','tests/fresh-campaign-recovery.test.mjs','tests/fresh-historical-loss.test.mjs','tests/stock-cuyo-battery-defense.test.mjs'])assert.ok(scopes.campaign.includes(file),file);
 for(const file of ['tests/tactical-web.test.mjs','tests/campaign-events.test.mjs','tests/campaign-library.test.mjs','tests/test-runner.test.mjs'])assert.ok(scopes.core.includes(file),file);
 for(const duration of ['full','quick','extended']){
  const core=suiteManifest(all,'core',undefined,undefined,duration),campaign=suiteManifest(all,'campaign',undefined,undefined,duration),expected=suiteManifest(all,duration);
  assert.deepEqual([...core.selectedFiles,...campaign.selectedFiles].sort(),[...expected.selectedFiles].sort());
  assert.equal(new Set([...core.selectedFiles,...campaign.selectedFiles]).size,expected.selectedFiles.length);
 }
 const auto=suiteManifest(all,'campaign',undefined,undefined,'quick'),manual=suiteManifest(all,'campaign',undefined,undefined,'extended');
 for(const file of ['tests/fresh-ending-route.test.mjs','tests/fresh-campaign-recovery.test.mjs']){assert.ok(!auto.selectedFiles.includes(file));assert.ok(manual.selectedFiles.includes(file));}
});
