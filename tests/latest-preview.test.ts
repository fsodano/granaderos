import { present } from './assert-present.ts';
import type { PreviewCompletion } from '../apps/web/lib/latest-preview.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createLatestPreview } from '../apps/web/lib/latest-preview.ts';

function fixture<Job = string, Result = string>() {
  const started: {
    job: Job;
    resolve: (value: Result | PromiseLike<Result>) => void;
    reject: (reason: unknown) => void;
  }[] = [];
  const received: { job: Job; completion: PreviewCompletion<Result> }[] = [];
  const queue = createLatestPreview<Job, Result>(
    (job) => new Promise<Result>((resolve, reject) => started.push({ job, resolve, reject })),
    (job, completion) => received.push({ job, completion }),
  );
  return { queue, started, received };
}

void test('a current preview publishes its result with the original job identity', async () => {
  const { queue, started, received } = fixture<
    { battle: object; request: object },
    { x: number; y: number }[]
  >();
  const job = { battle: {}, request: {} };
  const preview = [{ x: 2, y: 3 }];
  queue.request(job);
  assert.equal(present(started[0]).job, job);
  present(started[0]).resolve(preview);
  await setImmediate();
  assert.equal(received.length, 1);
  assert.equal(present(received[0]).job, job);
  assert.deepEqual(present(received[0]).completion, { ok: true, value: preview });
  const completion = present(received[0]).completion;
  assert.ok(completion.ok);
  assert.equal(completion.value, preview);
});

void test('rapid replacements keep one active job and run only the newest waiting job', async () => {
  const { queue, started, received } = fixture();
  queue.request('active');
  for (let index = 0; index < 100; index++) {
    queue.request(`replacement-${index}`);
  }
  assert.deepEqual(
    started.map(({ job }) => job),
    ['active'],
  );
  present(started[0]).resolve('stale route');
  await setImmediate();
  assert.deepEqual(received, []);
  assert.deepEqual(
    started.map(({ job }) => job),
    ['active', 'replacement-99'],
  );
  present(started[1]).resolve('current route');
  await setImmediate();
  assert.deepEqual(received, [
    { job: 'replacement-99', completion: { ok: true, value: 'current route' } },
  ]);
});

void test('a rejected current preview reports failure and the queue accepts a later request', async () => {
  const { queue, started, received } = fixture();
  const error = new Error('Worker failed');
  queue.request('failed');
  present(started[0]).reject(error);
  await setImmediate();
  assert.deepEqual(received, [{ job: 'failed', completion: { ok: false, error } }]);
  queue.request('recovery');
  present(started[1]).resolve('recovered route');
  await setImmediate();
  assert.deepEqual(received[1], {
    job: 'recovery',
    completion: { ok: true, value: 'recovered route' },
  });
});

void test('rejection with no error value still reports failure', async () => {
  const { queue, started, received } = fixture();
  queue.request('failed');
  present(started[0]).reject(undefined);
  await setImmediate();
  assert.deepEqual(received, [{ job: 'failed', completion: { ok: false, error: undefined } }]);
});

void test('an old rejection cannot replace the result of the newest request', async () => {
  const { queue, started, received } = fixture();
  queue.request('old');
  queue.request('current');
  present(started[0]).reject(new Error('Old worker failed'));
  await setImmediate();
  assert.deepEqual(received, []);
  present(started[1]).resolve('current route');
  await setImmediate();
  assert.deepEqual(received, [
    { job: 'current', completion: { ok: true, value: 'current route' } },
  ]);
});

void test('cancellation discards active and waiting previews but permits a later request', async () => {
  const { queue, started, received } = fixture();
  queue.request('active');
  queue.request('waiting');
  queue.request(null);
  present(started[0]).resolve('cancelled route');
  await setImmediate();
  assert.deepEqual(received, []);
  assert.deepEqual(
    started.map(({ job }) => job),
    ['active'],
  );
  queue.request('later');
  present(started[1]).resolve('later route');
  await setImmediate();
  assert.deepEqual(received, [{ job: 'later', completion: { ok: true, value: 'later route' } }]);
});

void test('close prevents publication, clears waiting work and refuses later requests', async () => {
  const { queue, started, received } = fixture();
  queue.request('active');
  queue.request('waiting');
  queue.close();
  queue.close();
  queue.request('after close');
  present(started[0]).reject(new Error('Closed worker'));
  await setImmediate();
  assert.deepEqual(received, []);
  assert.deepEqual(
    started.map(({ job }) => job),
    ['active'],
  );
});
