import test from 'node:test';import assert from 'node:assert/strict';
import {verifyBrowserWorkers} from '../tools/verify-browser-workers.mjs';
test('the static export rejects a local-file base for browser workers',()=>{
 for(const code of ['new Worker(new URL("/_next/static/enemy-turn-worker-a.js","file:///repo/web/lib/useEnemyPlayback.ts"),{type:"module"})',"new Worker ( new URL('./worker.js', 'file:///Users/test/project/hook.ts') )"])
  assert.throws(()=>verifyBrowserWorkers(code,'page.js',()=>{}),/local file URL.*page.js/);
});
test('the static export checks the actual emitted worker asset',()=>{
 const checked=[];verifyBrowserWorkers('const u="/_next/static/enemy-turn-worker-Ab12.js";new Worker(u,{type:"module"})','page.js',url=>checked.push(url));assert.deepEqual(checked,['/_next/static/enemy-turn-worker-Ab12.js']);
 assert.throws(()=>verifyBrowserWorkers('new Worker("/_next/static/enemy-turn-worker-missing.js")','page.js',()=>{throw Error('missing asset');}),/missing asset/);
});
