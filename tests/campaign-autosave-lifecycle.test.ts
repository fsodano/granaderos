import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { CampaignSaveRequest } from '../apps/web/lib/campaign-save-values.ts';
type SavedPair = { campaign: CampaignSnapshot; battle: BattleSnapshot | null };
import type { TestContext } from 'node:test';
import { present } from './assert-present.ts';
import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
const { useCampaignAutosave } = await import('../apps/web/lib/useCampaignAutosave.ts');

function deployed(seed: number): SavedPair {
  let campaign = dispatchCampaign(initialCampaign(seed), {
    type: 'recruitCivic',
    id: 110,
    term: 'week',
  });
  assert.equal(campaign.lastError, null);
  campaign = dispatchCampaign(campaign, { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  const result = prepareCampaignBattle(campaign);
  assert.equal(result.error, null);
  return { campaign: result.campaign, battle: result.battle };
}

async function mountAutosave(
  t: TestContext,
  snapshot: SavedPair,
  { strict = false, workerAvailable = true } = {},
) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://granaderos.test',
    pretendToBeVisual: true,
  });
  type SaveJob = CampaignSaveRequest & { worker: Worker; key: string };
  const workers: Worker[] = [],
    jobs: SaveJob[] = [],
    writes: { key: string; text: string }[] = [],
    saved: string[] = [],
    errors: string[] = [],
    listeners = {
      pagehide: new Set<EventListenerOrEventListenerObject | null>(),
      visibilitychange: new Set<EventListenerOrEventListenerObject | null>(),
    };
  Object.defineProperty(dom.window.navigator, 'locks', {
    value: {
      request: (name: string, _options: LockOptions, callback: (lock: Lock) => Promise<void>) =>
        Promise.resolve(callback({ name, mode: 'exclusive' })),
    },
  });
  class Worker {
    terminations = 0;
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    constructor() {
      if (!workerAvailable) {
        throw Error('workers unavailable');
      }
      this.terminations = 0;
      workers.push(this);
    }
    postMessage(job: CampaignSaveRequest & { key: string }) {
      jobs.push({ worker: this, ...structuredClone(job) });
    }
    terminate() {
      this.terminations++;
    }
  }
  function observeListeners(target: EventTarget, name: keyof typeof listeners) {
    const add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, listener, options) => {
      if (type === name) {
        listeners[name].add(listener);
      }
      add(type, listener, options);
    };
    target.removeEventListener = (type, listener, options) => {
      if (type === name) {
        listeners[name].delete(listener);
      }
      remove(type, listener, options);
    };
  }
  observeListeners(dom.window, 'pagehide');
  observeListeners(dom.window.document, 'visibilitychange');
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Worker,
    IS_REACT_ACT_ENVIRONMENT: true,
    localStorage: {
      setItem(key: string, text: string) {
        writes.push({ key, text });
      },
    },
  };
  const previous = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  function Controller({ pair, keyName }: { pair: SavedPair; keyName: string }) {
    useCampaignAutosave(
      pair.campaign,
      pair.battle,
      () => keyName,
      () => saved.push(keyName),
      () => errors.push(keyName),
    );
    return null;
  }
  const root = createRoot(present(dom.window.document.getElementById('root')));
  let unmounted = false;
  const render = async (pair: SavedPair, keyName = 'campaign') => {
    await act(async () =>
      root.render(
        strict
          ? h(StrictMode, null, h(Controller, { pair, keyName }))
          : h(Controller, { pair, keyName }),
      ),
    );
  };
  const unmount = async () => {
    if (!unmounted) {
      await act(async () => root.unmount());
      unmounted = true;
    }
  };
  t.after(async () => {
    try {
      await unmount();
    } finally {
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      }
    }
  });
  await render(snapshot);
  return {
    workers,
    jobs,
    writes,
    saved,
    errors,
    listeners,
    render,
    unmount,
    async reply(value: SaveJob | undefined) {
      const job = present(value);
      await act(async () =>
        present(job.worker.onmessage)(
          new MessageEvent('message', {
            data: {
              id: job.id,
              sessionId: job.sessionId,
              revision: job.revision,
              requestId: job.requestId,
              text: encodeSave(job.campaign, job.battle),
            },
          }),
        ),
      );
    },
    async fail(job: SaveJob | undefined, event: 'onerror' | 'onmessageerror' = 'onmessageerror') {
      await act(async () => present(present(job).worker[event])());
    },
    async pagehide() {
      await act(async () => dom.window.dispatchEvent(new dom.window.Event('pagehide')));
    },
    async visibility(hidden: boolean) {
      Object.defineProperty(dom.window.document, 'hidden', { configurable: true, value: hidden });
      await act(async () =>
        dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')),
      );
    },
  };
}

void test('a loaded battle saves in the background and late replies cannot overwrite an imported campaign', async (t) => {
  const original = deployed(8),
    imported = deployed(17),
    fresh = { campaign: initialCampaign(23), battle: null };
  const m = await mountAutosave(t, original);
  assert.equal(m.jobs.length, 1);
  assert.equal(m.writes.length, 0);
  await m.render(imported);
  await m.render(fresh);
  assert.equal(m.jobs.length, 1);
  await m.reply(m.jobs[0]);
  assert.equal(m.writes.length, 0);
  assert.equal(m.jobs.length, 2);
  assert.deepEqual(
    { campaign: present(m.jobs[1]).campaign, battle: present(m.jobs[1]).battle },
    fresh,
  );
  await m.reply(m.jobs[1]);
  assert.deepEqual(decodeSave(present(m.writes[0]).text), fresh);
  await m.reply(m.jobs[0]);
  assert.equal(m.writes.length, 1);
  assert.deepEqual(m.saved, ['campaign']);
  assert.equal(m.errors.length, 0);
});

for (const trigger of ['pagehide', 'visibility']) {
  void test(`${trigger} flushes the exact latest campaign and active battle before a worker reply`, async (t) => {
    const previous = { campaign: initialCampaign(4), battle: null },
      latest = deployed(6);
    const m = await mountAutosave(t, previous);
    await m.render(latest, 'imported');
    await m.visibility(false);
    assert.equal(m.writes.length, 0, 'visible documents do not force a synchronous save');
    if (trigger === 'pagehide') {
      await m.pagehide();
    } else {
      await m.visibility(true);
    }
    assert.equal(m.writes.length, 1);
    assert.equal(present(m.writes[0]).key, 'imported');
    assert.deepEqual(decodeSave(present(m.writes[0]).text), latest);
    assert.deepEqual(m.saved, ['imported']);
    await m.reply(m.jobs[0]);
    assert.equal(m.writes.length, 1);
    assert.equal(m.jobs.length, 1);
    await m.unmount();
    assert.equal(m.writes.length, 1);
    assert.equal(present(m.workers[0]).terminations, 1);
    assert.equal(m.listeners.pagehide.size, 0);
    assert.equal(m.listeners.visibilitychange.size, 0);
  });
}

void test('a worker failure saves the newest active battle through the same valid save format', async (t) => {
  const original = { campaign: initialCampaign(2), battle: null },
    latest = deployed(3);
  const m = await mountAutosave(t, original);
  await m.render(latest);
  await m.fail(m.jobs[0]);
  assert.equal(present(m.workers[0]).terminations, 1);
  assert.deepEqual(decodeSave(present(m.writes[0]).text), latest);
  await m.reply(m.jobs[0]);
  assert.equal(m.writes.length, 1);
  assert.equal(m.errors.length, 0);
});

void test('without Worker support the mounted hook still saves a restorable campaign', async (t) => {
  const latest = deployed(5),
    m = await mountAutosave(t, latest, { workerAvailable: false });
  assert.equal(m.workers.length, 0);
  assert.deepEqual(decodeSave(present(m.writes[0]).text), latest);
  assert.equal(m.errors.length, 0);
});

void test('unmount flushes once, removes navigation listeners and ignores late worker events', async (t) => {
  const first = { campaign: initialCampaign(10), battle: null },
    latest = deployed(11);
  const m = await mountAutosave(t, first);
  await m.render(latest);
  await m.unmount();
  assert.equal(m.writes.length, 1);
  assert.deepEqual(decodeSave(present(m.writes[0]).text), latest);
  assert.equal(present(m.workers[0]).terminations, 1);
  assert.equal(m.listeners.pagehide.size, 0);
  assert.equal(m.listeners.visibilitychange.size, 0);
  await m.reply(m.jobs[0]);
  await m.fail(m.jobs[0]);
  await m.pagehide();
  await m.visibility(true);
  assert.equal(m.writes.length, 1);
  assert.equal(m.errors.length, 0);
});

void test('StrictMode effect replay closes only the previous worker and retains the current save lifecycle', async (t) => {
  const first = { campaign: initialCampaign(12), battle: null },
    latest = deployed(13);
  const m = await mountAutosave(t, first, { strict: true });
  assert.equal(m.workers.length, 2);
  assert.equal(present(m.workers[0]).terminations, 1);
  assert.equal(present(m.workers[1]).terminations, 0);
  assert.equal(m.listeners.pagehide.size, 1);
  assert.equal(m.listeners.visibilitychange.size, 1);
  assert.equal(m.writes.length, 1, 'replayed cleanup flushes the prior complete pair');
  assert.deepEqual(decodeSave(present(m.writes[0]).text), first);
  await m.render(latest);
  await m.reply(m.jobs[0]);
  assert.equal(m.writes.length, 1);
  await m.reply(m.jobs[1]);
  assert.equal(m.writes.length, 1);
  assert.equal(m.jobs.length, 3);
  await m.reply(m.jobs[2]);
  assert.equal(m.writes.length, 2);
  assert.deepEqual(decodeSave(present(m.writes[1]).text), latest);
  await m.unmount();
  assert.equal(m.writes.length, 2);
  assert.equal(present(m.workers[1]).terminations, 1);
  assert.equal(m.listeners.pagehide.size, 0);
  assert.equal(m.listeners.visibilitychange.size, 0);
});

// The browser address can change before the background encoder answers.
void test('an in-flight save retains its submitted campaign destination', async (t) => {
  const snapshot = deployed(29),
    m = await mountAutosave(t, snapshot);
  await m.render(snapshot, 'content-campaign');
  assert.equal(
    m.jobs.length,
    1,
    'changing the destination callback does not create a new snapshot',
  );
  await m.reply(m.jobs[0]);
  assert.equal(
    present(m.writes[0]).key,
    'campaign',
    'the prior campaign cannot be written over the content campaign',
  );
  assert.deepEqual(decodeSave(present(m.writes[0]).text), snapshot);
});
