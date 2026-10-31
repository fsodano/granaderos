import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import {
  actBattle,
  endTurn,
  createBattle,
  getReachable,
  canSee,
  teamCanSee,
  knownArtillery,
} from '../packages/game/tactical.js';
import { createBattleExecutor } from '../apps/web/lib/battle-executor.ts';
import {
  executeBattleWorkerRequest,
  readBattleWorkerRequest,
} from '../apps/web/lib/battle-worker-transport.ts';
import {
  executeGroupMove,
  groupMovementStep,
  planGroupMove,
} from '../packages/game/group-movement.js';
import { movementGroupModel } from '../packages/game/ja2-hud.js';
import { movementStep } from '../packages/game/movement-step.js';
const fixture = () =>
  createBattle([{ id: 'p', x: 1, y: 2, weapon: 1800 }], {
    width: 8,
    height: 8,
    enemies: [{ id: 'e', x: 6, y: 2, weapon: 1800 }],
    seed: 8,
  });
async function withExecutor(check) {
  const url = new URL('../packages/game/battle-job.js', import.meta.url).href;
  const transportUrl = new URL('../apps/web/lib/battle-worker-transport.ts', import.meta.url).href;
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');Promise.all([import(${JSON.stringify(url)}),import(${JSON.stringify(transportUrl)})]).then(([{runBattleJob},{executeBattleWorkerRequest}])=>parentPort.on('message',data=>{const response=executeBattleWorkerRequest(data,job=>runBattleJob({...job,action:job.action}));if(response)parentPort.postMessage(response);}));`,
    { eval: true },
  );
  const bridge = {
    postMessage: (data) => worker.postMessage(data),
    terminate: () => worker.terminate(),
  };
  worker.on('message', (data) => bridge.onmessage({ data }));
  worker.on('error', () => bridge.onerror());
  const executor = createBattleExecutor(bridge);
  try {
    await check(executor);
  } finally {
    executor.close();
  }
}
test('worker execution exactly matches movement, invalid orders and turn resolution', async () => {
  await withExecutor(async (executor) => {
    for (const action of [
      { type: 'move', unitId: 'p', x: 2, y: 2 },
      { type: 'move', unitId: 'p', x: -1, y: 2 },
      null,
    ]) {
      const battle = fixture(),
        before = structuredClone(battle),
        kind = action ? 'action' : 'turn';
      assert.deepEqual(
        await executor.run({ battle, action, kind }),
        action ? actBattle(battle, action) : endTurn(battle),
      );
      assert.deepEqual(battle, before);
    }
  });
});
test('movement-step worker preserves resumable plans and reached-cell costs across messages', async () => {
  await withExecutor(async (executor) => {
    let battle = createBattle([{ id: 'p', x: 1, y: 2 }], {
        width: 16,
        height: 8,
        tiles: Array.from({ length: 128 }, (_, i) => ({
          x: i % 16,
          y: Math.floor(i / 16),
          type: 'grass',
          blocked: false,
          cover: 0,
        })),
        exploration: true,
        enemies: [],
      }),
      continuation;
    const action = { type: 'move', unitId: 'p', x: 12, y: 2 };
    let count = 0;
    for (;;) {
      const before = structuredClone(battle),
        expected = movementStep(battle, action, continuation),
        result = await executor.run({ battle, action, kind: 'movement-step', continuation });
      assert.deepEqual(result, expected);
      assert.deepEqual(battle, before);
      count++;
      if (result.status !== 'moving') {
        assert.equal(result.status, 'completed');
        assert.equal(result.state.units[0].x, 12);
        assert.equal(result.state.units[0].energy, 99.45);
        break;
      }
      battle = result.state;
      continuation = result.continuation;
      assert.ok(count < 20);
    }
    assert.equal(count, 11);
  });
});
test('worker group orders retain exact formation reports, partial moves and contact stops', async () => {
  await withExecutor(async (executor) => {
    for (const mode of ['complete', 'exhausted', 'contact', 'invalid']) {
      const battle = createBattle(
        [
          { id: 'a', x: 1, y: 2, energy: mode === 'exhausted' ? 2 : 100 },
          { id: 'b', x: 1, y: 3 },
          { id: 'c', x: 2, y: 3 },
        ],
        {
          width: 24,
          height: 10,
          seed: 45,
          exploration: true,
          tiles: Array.from({ length: 240 }, (_, i) => ({
            x: i % 24,
            y: Math.floor(i / 24),
            type: 'grass',
            blocked: false,
            cover: 0,
          })),
          enemies:
            mode === 'contact'
              ? [{ id: 'e', x: 22, y: 2, weapon: 1800, marksmanship: 0, facing: 2 }]
              : [],
        },
      );
      const before = structuredClone(battle),
        action = {
          unitIds: ['a', 'b', 'c'],
          anchorId: 'a',
          x: mode === 'contact' ? 20 : mode === 'invalid' ? -1 : 8,
          y: 2,
          ...(mode === 'exhausted' ? { movement: 'run' } : {}),
        };
      const expected = executeGroupMove(battle, action),
        result = await executor.run({ battle, action, kind: 'group' });
      assert.deepEqual(
        await executor.run({ battle, action, kind: 'group-preview' }),
        planGroupMove(battle, action),
      );
      assert.deepEqual(result, expected);
      assert.deepEqual(battle, before);
      assert.equal(
        result.status,
        { complete: 'completed', exhausted: 'partial', contact: 'contact', invalid: 'invalid' }[
          mode
        ],
      );
      let replay = battle;
      for (const order of result.orders) replay = actBattle(replay, order);
      assert.deepEqual(result.state, replay);
    }
  });
});

test('group-step worker preserves object continuations and exact formation progress', async () => {
  await withExecutor(async (executor) => {
    let battle = createBattle(
      [
        { id: 'a', x: 1, y: 2 },
        { id: 'b', x: 1, y: 3 },
      ],
      {
        width: 12,
        height: 6,
        exploration: true,
        enemies: [],
        tiles: Array.from({ length: 72 }, (_, i) => ({
          x: i % 12,
          y: Math.floor(i / 12),
          type: 'grass',
          blocked: false,
          cover: 0,
        })),
      },
    );
    const action = { unitIds: ['a', 'b'], anchorId: 'a', x: 6, y: 2 };
    let continuation;
    for (let count = 0; ; count++) {
      assert.ok(count < 20);
      const before = structuredClone(battle);
      const expected = groupMovementStep(battle, action, continuation);
      const result = await executor.run({ battle, action, kind: 'group-step', continuation });
      assert.deepEqual(result, expected);
      assert.deepEqual(battle, before);
      if (result.status !== 'moving') {
        assert.equal(result.status, 'completed');
        assert.equal(result.continuation, null);
        break;
      }
      assert.equal(Array.isArray(result.continuation), false);
      battle = result.state;
      continuation = result.continuation;
    }
  });
});
test('group dispatch builds the same request without calculating an unused preview', () => {
  const battle = createBattle(
    [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 2, y: 1 },
    ],
    { width: 8, height: 8, exploration: true, enemies: [] },
  );
  const preview = movementGroupModel(battle, ['a', 'b'], 'a', { x: 4, y: 4 });
  const dispatch = movementGroupModel(battle, ['a', 'b'], 'a', { x: 4, y: 4 }, { preview: false });
  assert.deepEqual(dispatch.request, preview.request);
  assert.deepEqual(dispatch.members, preview.members);
  assert.ok(preview.preview);
  assert.equal(dispatch.preview, null);
});
test('executor rejects abandoned jobs and ignores their late messages', async () => {
  const messages = [],
    worker = { postMessage: (m) => messages.push(m), terminate() {} };
  const executor = createBattleExecutor(worker);
  const first = executor.run({ battle: fixture() }),
    second = executor.run({ battle: fixture() });
  worker.onmessage({
    data: { id: messages[1].id, context: messages[1].context, battle: 'second' },
  });
  assert.equal(await second, 'second');
  const rejected = assert.rejects(first, /closed/);
  executor.close();
  await rejected;
  worker.onmessage({ data: { id: messages[0].id, battle: 'late' } });
  await assert.rejects(executor.run({ battle: fixture() }), /closed/);
});

for (const event of ['onerror', 'onmessageerror'])
  test(`executor releases all pending orders after ${event}`, async () => {
    const messages = [];
    let terminated = 0;
    const worker = {
      postMessage: (message) => messages.push(message),
      terminate() {
        terminated++;
      },
    };
    const executor = createBattleExecutor(worker);
    const first = executor.run({ battle: fixture(), action: { type: 'move' } }),
      second = executor.run({ battle: fixture(), kind: 'turn' });
    const failures = [
      assert.rejects(first, /Battle worker failed/),
      assert.rejects(second, /Battle worker failed/),
    ];
    worker[event]();
    await Promise.all(failures);
    assert.equal(terminated, 1);
    // Late messages and repeated browser error events cannot revive a dead job.
    worker.onmessage({ data: { id: messages[0].id, battle: { status: 'active' } } });
    worker.onerror();
    worker.onmessageerror();
    assert.equal(terminated, 1);
    await assert.rejects(executor.run({ battle: fixture() }), /Battle worker closed/);
    assert.equal(messages.length, 2, 'a failed worker never receives another order');
    executor.close();
    executor.close();
    assert.equal(terminated, 1);
  });

test('background reachable previews use observed occupants and leave battle snapshots unchanged', async () => {
  await withExecutor(async (executor) => {
    for (const exploration of [false, true])
      for (const movementIntent of ['forward', 'preserveFacing']) {
        const battle = fixture();
        if (exploration) battle.mode = 'exploration';
        const before = structuredClone(battle);
        for (const unitId of ['p', 'missing']) {
          const result = await executor.run({
            battle,
            action: { unitId, movementIntent },
            kind: 'reachable-preview',
          });
          const unit = battle.units.find((candidate) => candidate.id === unitId);
          const seen = (point) =>
            unit.side === 'player'
              ? teamCanSee(battle, unit.side, point)
              : canSee(battle, unit, point);
          const observed = unit
            ? {
                ...battle,
                units: battle.units.filter((other) => other.side === unit.side || seen(other)),
                npcs: (battle.npcs ?? []).filter(seen),
                artillery: knownArtillery(battle, unit),
              }
            : null;
          assert.deepEqual(result, unit ? getReachable(observed, unitId, { movementIntent }) : []);
          if (unit)
            for (const other of battle.units.filter(
              (candidate) => candidate.side !== unit.side && !seen(candidate),
            ))
              assert.ok(
                result.some((point) => point.x === other.x && point.y === other.y),
                'a hidden opponent cannot disclose its cell through the worker bridge',
              );
          if (unitId === 'p' && movementIntent === 'forward') assert.ok(result.length);
        }
        assert.deepEqual(battle, before);
      }
  });
});

test('worker results require matching game session, sector visit, revision and request identity', async () => {
  for (const field of ['sessionId', 'sectorSessionId', 'revision', 'sectorRevision', 'requestId']) {
    const messages = [],
      worker = { postMessage: (message) => messages.push(message), terminate() {} };
    const executor = createBattleExecutor(worker),
      battle = fixture();
    battle.gameRevision = 8;
    battle.gameSessionId = 'campaign-one';
    const pending = executor.run({ battle, action: { type: 'turn', unitId: 'p' } }),
      message = messages[0];
    const rejected = assert.rejects(pending, /stale-sector-operation-result/);
    worker.onmessage({
      data: {
        id: message.id,
        context: {
          ...message.context,
          [field]: field === 'revision' || field === 'sectorRevision' ? 9 : 'different',
        },
        battle,
      },
    });
    await rejected;
    executor.close();
  }
});

test('worker transport rejects malformed requests before executing simulation rules', async () => {
  const messages = [];
  const worker = { postMessage: (message) => messages.push(message), terminate() {} };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture(), kind: 'turn' });
  const request = messages[0];
  let calls = 0;
  const run = () => {
    calls++;
    return 'completed';
  };
  for (const value of [null, [], {}, { ...request, id: '1' }, { ...request, id: 0 }]) {
    assert.equal(executeBattleWorkerRequest(value, run), undefined);
  }
  for (const value of [
    { ...request, job: null },
    { ...request, job: { ...request.job, kind: 'other' } },
    { ...request, job: { kind: 'turn' } },
    { ...request, context: null },
    { ...request, context: { ...request.context, revision: -1 } },
    { ...request, job: { ...request.job, context: { ...request.context, requestId: 'other' } } },
  ]) {
    assert.throws(() => readBattleWorkerRequest(value));
    const failure = executeBattleWorkerRequest(value, run);
    assert.equal(failure.id, request.id);
    assert.equal(typeof failure.error, 'string');
    assert.ok(!Object.hasOwn(failure, 'battle'));
  }
  assert.equal(calls, 0);
  worker.onmessage({ data: executeBattleWorkerRequest(request, run) });
  assert.equal(await result, 'completed');
  assert.equal(calls, 1);
  executor.close();
});

test('worker transport reports simulation errors with the original operation identity', async () => {
  const messages = [];
  const worker = { postMessage: (message) => messages.push(message), terminate() {} };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture(), kind: 'turn' });
  const rejected = assert.rejects(result, /simulation failed/);
  const response = executeBattleWorkerRequest(messages[0], () => {
    throw Error('simulation failed');
  });
  assert.deepEqual(response.context, messages[0].context);
  worker.onmessage({ data: response });
  await rejected;
  executor.close();
});

test('executor rejects malformed replies for a pending request and can accept the next reply', async () => {
  for (const malformed of [
    (message) => ({ id: message.id, context: message.context }),
    (message) => ({ id: message.id, context: null, battle: 'invalid' }),
    (message) => ({ id: message.id, context: message.context, error: 42 }),
    (message) => ({ id: message.id, context: message.context, error: 'failed', battle: 'invalid' }),
  ]) {
    const messages = [];
    const worker = { postMessage: (message) => messages.push(message), terminate() {} };
    const executor = createBattleExecutor(worker);
    const first = executor.run({ battle: fixture() });
    const rejected = assert.rejects(first, /Invalid battle worker/);
    worker.onmessage({ data: malformed(messages[0]) });
    await rejected;
    const second = executor.run({ battle: fixture() });
    worker.onmessage({
      data: { id: messages[1].id, context: messages[1].context, battle: 'next' },
    });
    assert.equal(await second, 'next');
    executor.close();
  }
});

test('executor ignores uncorrelated messages without consuming the pending request', async () => {
  const messages = [];
  const worker = { postMessage: (message) => messages.push(message), terminate() {} };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture() });
  for (const data of [null, [], {}, { id: '1' }, { id: 0 }, { id: 1.5 }, { id: 100 }]) {
    assert.doesNotThrow(() => worker.onmessage({ data }));
  }
  worker.onmessage({ data: { id: messages[0].id, context: messages[0].context, battle: null } });
  assert.equal(await result, null, 'legacy result payloads stay opaque to the transport');
  executor.close();
});

test('executor removes a request when posting fails and preserves later requests', async () => {
  const messages = [];
  let fail = true;
  const worker = {
    postMessage(message) {
      if (fail) throw Error('cannot clone');
      messages.push(message);
    },
    terminate() {},
  };
  const executor = createBattleExecutor(worker);
  await assert.rejects(executor.run({ battle: fixture() }), /cannot clone/);
  fail = false;
  const result = executor.run({ battle: fixture() });
  worker.onmessage({ data: { id: messages[0].id, context: messages[0].context, battle: 'next' } });
  assert.equal(await result, 'next');
  executor.close();
});
