import { present } from './assert-present.ts';
import type { BattleWorkerRequest } from '../apps/web/lib/battle-worker-contracts.ts';
import type { BattleWorkerPort } from '../apps/web/lib/battle-executor.ts';
import type { BattlePreviewState } from '../apps/web/lib/useBattlePreview.ts';
import type {
  GroupMovePreviewRequest,
  ReachablePreviewRequest,
  GroupMovePreview,
  ReachablePreviewPoint,
} from '../packages/game/public/battle-preview-types.ts';
type PreviewRequest = GroupMovePreviewRequest | ReachablePreviewRequest | null;
import type { TestContext } from 'node:test';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBattle } from '../packages/game/tactical.js';
const { useBattlePreview } = await import('../apps/web/lib/useBattlePreview.ts');
const { useGroupMovePreview } = await import('../apps/web/lib/useGroupMovePreview.ts');

function fixture() {
  return createBattle([{ id: 'a', x: 1, y: 2 }], {
    width: 8,
    height: 8,
    exploration: true,
    enemies: [],
    seed: 8,
  });
}

async function mountPreview(
  t: TestContext,
  battle: BattleSnapshot,
  request: PreviewRequest,
  { group = false } = {},
) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://granaderos.test',
  });
  const workers: Worker[] = [];
  type PreviewJob = BattleWorkerRequest & { worker: Worker };
  const jobs: PreviewJob[] = [];
  class Worker implements BattleWorkerPort {
    terminations = 0;
    onmessage: BattleWorkerPort['onmessage'] = null;
    onerror: BattleWorkerPort['onerror'] = null;
    onmessageerror: BattleWorkerPort['onmessageerror'] = null;
    constructor() {
      this.terminations = 0;
      workers.push(this);
    }
    postMessage(message: BattleWorkerRequest) {
      jobs.push({ worker: this, ...structuredClone(message) });
    }
    terminate() {
      this.terminations++;
    }
  }
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Worker,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let result: BattlePreviewState<ReachablePreviewPoint[] | GroupMovePreview> | undefined;
  function ReachableController({
    battle,
    request,
  }: {
    battle: BattleSnapshot;
    request: ReachablePreviewRequest | null;
  }) {
    const current = useBattlePreview(battle, request, 'reachable-preview');
    useLayoutEffect(() => {
      result = current;
    });
    return null;
  }
  function GroupController({
    battle,
    request,
  }: {
    battle: BattleSnapshot;
    request: GroupMovePreviewRequest | null;
  }) {
    const current = useGroupMovePreview(battle, request);
    useLayoutEffect(() => {
      result = current;
    });
    return null;
  }
  const root = createRoot(present(dom.window.document.getElementById('root')));
  let unmounted = false;
  const render = async (battle: BattleSnapshot, request: PreviewRequest) => {
    if (group) {
      if (request && !('unitIds' in request)) {
        throw Error('Group preview fixture requires a group request');
      }
      await act(async () => root.render(h(GroupController, { battle, request })));
    } else {
      if (request && !('unitId' in request)) {
        throw Error('Reachable preview fixture requires an actor request');
      }
      await act(async () => root.render(h(ReachableController, { battle, request })));
    }
  };
  const unmount = async () => {
    if (unmounted) {
      return;
    }
    await act(async () => root.unmount());
    unmounted = true;
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
  await render(battle, request);
  return {
    workers,
    jobs,
    render,
    unmount,
    result: () => result,
    async reply(job: PreviewJob | undefined, preview: unknown) {
      await act(async () =>
        present(present(job).worker.onmessage)(
          new MessageEvent('message', {
            data: { id: present(job).id, context: present(job).context, battle: preview },
          }),
        ),
      );
    },
    async fail(job: PreviewJob | undefined) {
      await act(async () =>
        present(present(job).worker.onerror)(
          Object.assign(new Event('error'), {
            message: 'worker failed',
            filename: '',
            lineno: 0,
            colno: 0,
            error: undefined,
          }),
        ),
      );
    },
  };
}

void test('preview hooks publish only the current snapshot and request', async (t) => {
  const battle = fixture();
  const first = { unitId: 'a' };
  const next = { unitId: 'a', previewBudget: true };
  const latestBattle = structuredClone(battle);
  const mounted = await mountPreview(t, battle, first);
  await mounted.render(battle, next);
  await mounted.render(latestBattle, next);
  assert.equal(mounted.jobs.length, 1);
  await mounted.reply(mounted.jobs[0], [{ x: 1, y: 2, cost: 0, path: [] }]);
  assert.deepEqual(mounted.result(), { preview: null, working: true, failed: false });
  assert.equal(mounted.jobs.length, 2);
  assert.deepEqual(present(mounted.jobs[1]).job.action, next);
  const preview = [
    {
      x: 3,
      y: 2,
      cost: 4,
      path: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
    },
  ];
  await mounted.reply(mounted.jobs[1], preview);
  assert.deepEqual(mounted.result(), { preview, working: false, failed: false });
  await mounted.render(latestBattle, { ...next });
  assert.deepEqual(mounted.result(), { preview: null, working: true, failed: false });
});

void test('a failed preview closes its worker and the next request recovers', async (t) => {
  const battle = fixture();
  const mounted = await mountPreview(t, battle, { unitId: 'a' });
  await mounted.fail(mounted.jobs[0]);
  assert.deepEqual(mounted.result(), { preview: null, working: false, failed: true });
  assert.equal(present(mounted.workers[0]).terminations, 1);
  await mounted.render(battle, { unitId: 'a', previewBudget: true });
  assert.equal(mounted.workers.length, 2);
  await mounted.reply(mounted.jobs[1], []);
  assert.deepEqual(mounted.result(), { preview: [], working: false, failed: false });
});

void test('cancelled and unmounted preview hooks ignore late worker replies', async (t) => {
  const battle = fixture();
  const mounted = await mountPreview(t, battle, { unitId: 'a' });
  await mounted.render(battle, null);
  await mounted.reply(mounted.jobs[0], []);
  assert.deepEqual(mounted.result(), { preview: null, working: false, failed: false });
  await mounted.render(battle, { unitId: 'a' });
  await mounted.unmount();
  assert.equal(present(mounted.workers[0]).terminations, 1);
  const before = mounted.result();
  await mounted.reply(mounted.jobs[1], []);
  assert.equal(mounted.result(), before);
});

void test('a malformed group result uses the existing failure notice and permits recovery', async (t) => {
  const battle = fixture();
  const request = { unitIds: ['a'], anchorId: 'a', x: 3, y: 2 };
  const mounted = await mountPreview(t, battle, request, { group: true });
  await mounted.reply(mounted.jobs[0], { ok: true, reason: '', members: null });
  assert.deepEqual(mounted.result(), {
    preview: {
      ok: false,
      reason: 'No se pudo calcular la vista previa. La ruta se comprobará al dar la orden.',
      members: [],
    },
    working: false,
    failed: true,
  });
  assert.equal(present(mounted.workers[0]).terminations, 1);
  await mounted.render(battle, { ...request, x: 4 });
  const preview = { ok: false, reason: 'No hay una ruta.', members: [] };
  await mounted.reply(mounted.jobs[1], preview);
  assert.deepEqual(mounted.result(), { preview, working: false, failed: false });
});
