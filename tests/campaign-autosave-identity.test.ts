import { initialCampaign } from '../packages/game/campaign.js';
import type { CampaignSaveWorker, QueuedCampaignSave } from '../apps/web/lib/campaign-autosave.ts';
import type { SaveStatus } from '../packages/game/application/get-save-status/get-save-status.repository.ts';
import type { GameSaveIdentity } from '../packages/game/application/save-game/save-game.repository.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignAutosave } from '../apps/web/lib/campaign-autosave.ts';

function campaign(sessionId: string, revision: number): CampaignSnapshot {
  return { ...initialCampaign(), gameSessionId: sessionId, gameRevision: revision };
}
function harness(write: (text: string, key: string) => void = () => {}) {
  const jobs: QueuedCampaignSave[] = [];
  const statuses: SaveStatus[] = [];
  const errors: Error[] = [];
  const worker: CampaignSaveWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (job) => {
      jobs.push(job);
    },
    terminate() {},
  };
  const queue = createCampaignAutosave({
    worker,
    encode: (campaign: CampaignSnapshot) => JSON.stringify(campaign),
    write,
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
  });
  return { worker, queue, jobs, statuses, errors };
}
function reply(
  worker: CampaignSaveWorker,
  job: QueuedCampaignSave,
  overrides: Partial<GameSaveIdentity> & { text?: unknown; error?: unknown } = {},
) {
  present(worker.onmessage)(
    new MessageEvent('message', {
      data: {
        sessionId: job.sessionId,
        revision: job.revision,
        requestId: job.requestId,
        text: JSON.stringify(job.campaign),
        ...overrides,
      },
    }),
  );
}

void test('save admission rejects stale sessions, revisions and requests before storage', () => {
  const writes: string[] = [];
  const { queue, worker, jobs } = harness((text) => writes.push(text));
  queue.submit(campaign('first', 4), null, 'save');
  for (const overrides of [{ sessionId: 'other' }, { revision: 3 }, { requestId: 'other' }]) {
    reply(worker, present(jobs[0]), overrides);
  }
  assert.equal(writes.length, 0);
  queue.submit(campaign('imported', 1), null, 'save');
  reply(worker, present(jobs[0]));
  assert.equal(jobs.length, 2);
  assert.equal(writes.length, 0);
  reply(worker, present(jobs[1]));
  assert.equal(writes.length, 1);
  assert.equal(queue.status().state, 'saved');
  assert.equal(present(queue.status().persisted).sessionId, 'imported');
  queue.close();
});

void test('storage failures leave accepted progress unsaved and can be retried', () => {
  let refused = true;
  const { queue, worker, jobs, errors } = harness(() => {
    if (refused) {
      throw new Error('Storage full');
    }
  });
  queue.submit(campaign('current', 5), null, 'save');
  reply(worker, present(jobs[0]));
  assert.equal(queue.status().state, 'failed');
  assert.equal(present(queue.status().accepted).revision, 5);
  assert.equal(queue.status().persisted, null);
  assert.equal(present(errors[0]).message, 'Storage full');
  refused = false;
  queue.flush();
  assert.equal(queue.status().state, 'saved');
  assert.equal(present(queue.status().persisted).revision, 5);
  queue.close();
});

void test('malformed worker text cannot reach storage and falls back to the accepted snapshot', () => {
  const writes: string[] = [];
  const { queue, worker, jobs } = harness((text) => {
    writes.push(text);
  });
  const snapshot = campaign('current', 6);
  queue.submit(snapshot, null, 'save');
  reply(worker, present(jobs[0]), { text: { untrusted: 'payload' } });
  assert.deepEqual(writes, [JSON.stringify(snapshot)]);
  assert.equal(queue.status().state, 'saved');
  queue.close();
});
