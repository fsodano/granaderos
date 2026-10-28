import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignAutosave } from '../apps/web/lib/campaign-autosave.js';

function harness(write = () => {}) {
  const jobs = [];
  const statuses = [];
  const errors = [];
  const worker = { postMessage: (job) => jobs.push(job), terminate() {} };
  const queue = createCampaignAutosave({
    worker,
    encode: (campaign) => JSON.stringify(campaign),
    write,
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
  });
  return { worker, queue, jobs, statuses, errors };
}
function reply(worker, job, overrides = {}) {
  worker.onmessage({
    data: {
      sessionId: job.sessionId,
      revision: job.revision,
      requestId: job.requestId,
      text: JSON.stringify(job.campaign),
      ...overrides,
    },
  });
}

test('save admission rejects stale sessions, revisions and requests before storage', () => {
  const writes = [];
  const { queue, worker, jobs } = harness((text) => writes.push(text));
  queue.submit({ gameSessionId: 'first', gameRevision: 4 }, null, 'save');
  for (const overrides of [{ sessionId: 'other' }, { revision: 3 }, { requestId: 'other' }])
    reply(worker, jobs[0], overrides);
  assert.equal(writes.length, 0);
  queue.submit({ gameSessionId: 'imported', gameRevision: 1 }, null, 'save');
  reply(worker, jobs[0]);
  assert.equal(jobs.length, 2);
  assert.equal(writes.length, 0);
  reply(worker, jobs[1]);
  assert.equal(writes.length, 1);
  assert.equal(queue.status().state, 'saved');
  assert.equal(queue.status().persisted.sessionId, 'imported');
  queue.close();
});

test('storage failures leave accepted progress unsaved and can be retried', () => {
  let refused = true;
  const { queue, worker, jobs, errors } = harness(() => {
    if (refused) throw new Error('Storage full');
  });
  queue.submit({ gameSessionId: 'current', gameRevision: 5 }, null, 'save');
  reply(worker, jobs[0]);
  assert.equal(queue.status().state, 'failed');
  assert.equal(queue.status().accepted.revision, 5);
  assert.equal(queue.status().persisted, null);
  assert.equal(errors[0].message, 'Storage full');
  refused = false;
  queue.flush();
  assert.equal(queue.status().state, 'saved');
  assert.equal(queue.status().persisted.revision, 5);
  queue.close();
});
