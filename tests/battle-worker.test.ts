const workerError = () =>
  Object.assign(new Event('error'), {
    message: 'worker failed',
    filename: '',
    lineno: 0,
    colno: 0,
    error: undefined,
  });
function required<Value>(value: Value | undefined): Value {
  assert.notEqual(value, undefined);
  if (value === undefined) {
    throw Error('Missing fixture record');
  }
  return value;
}
import type { BattleExecutor, BattleWorkerPort } from '../apps/web/lib/battle-executor.ts';
import type { BattleWorkerRequest } from '../apps/web/lib/battle-worker-contracts.ts';
import type {
  MoveAction,
  TacticalAction,
  GroupMoveAction,
  MovementIntent,
  TacticalPoint,
  TacticalRoutePoint,
  GroupMovementContinuation,
  MovementStepResult,
} from '../packages/game/public/compatibility-types.ts';
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
} from '../packages/game/group-movement.ts';
import { movementGroupModel } from '../packages/game/ja2-hud.ts';
import { movementStep } from '../packages/game/movement-step.ts';
import {
  readBattleWorkerAction,
  readBattleWorkerContinuation,
  readBattleWorkerResult,
} from '../apps/web/lib/battle-worker-values.ts';
const fixture = () =>
  createBattle([{ id: 'p', x: 1, y: 2, weapon: 1800 }], {
    width: 8,
    height: 8,
    enemies: [{ id: 'e', x: 6, y: 2, weapon: 1800 }],
    seed: 8,
  });
async function withExecutor(check: (executor: BattleExecutor) => Promise<void>) {
  const url = new URL('../packages/game/battle-job.ts', import.meta.url).href;
  const transportUrl = new URL('../apps/web/lib/battle-worker-transport.ts', import.meta.url).href;
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');Promise.all([import(${JSON.stringify(url)}),import(${JSON.stringify(transportUrl)})]).then(([{runBattleJob},{executeBattleWorkerRequest}])=>parentPort.on('message',data=>{const response=executeBattleWorkerRequest(data,job=>runBattleJob({...job,action:job.action}));if(response)parentPort.postMessage(response);}));`,
    { eval: true },
  );
  const bridge: BattleWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (data) => worker.postMessage(data),
    terminate: () => {
      void worker.terminate();
    },
  };
  worker.on('message', (data: unknown) =>
    bridge.onmessage?.(new MessageEvent('message', { data })),
  );
  worker.on('error', () => bridge.onerror?.(workerError()));
  const executor = createBattleExecutor(bridge);
  try {
    await check(executor);
  } finally {
    executor.close();
  }
}
void test('worker execution exactly matches movement, invalid orders and turn resolution', async () => {
  await withExecutor(async (executor) => {
    for (const action of [
      { type: 'move', unitId: 'p', x: 2, y: 2 },
      { type: 'move', unitId: 'p', x: -1, y: 2 },
      null,
    ] satisfies (MoveAction | null)[]) {
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
void test('movement-step worker preserves resumable plans and reached-cell costs across messages', async () => {
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
      continuation: TacticalRoutePoint[] | null = null;
    const action: MoveAction = { type: 'move', unitId: 'p', x: 12, y: 2 };
    let count = 0;
    for (;;) {
      const before = structuredClone(battle),
        expected = movementStep(battle, action, continuation),
        result: MovementStepResult = await executor.run({
          battle,
          action,
          kind: 'movement-step',
          continuation,
        });
      assert.deepEqual(result, expected);
      assert.deepEqual(battle, before);
      count++;
      if (result.status !== 'moving') {
        assert.equal(result.status, 'completed');
        assert.equal(required(result.state.units[0]).x, 12);
        assert.equal(required(result.state.units[0]).energy, 99.45);
        break;
      }
      battle = result.state;
      continuation = result.continuation;
      assert.ok(count < 20);
    }
    assert.equal(count, 11);
  });
});
void test('worker group orders retain exact formation reports, partial moves and contact stops', async () => {
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
        action: GroupMoveAction = {
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
      for (const order of result.orders) {
        replay = actBattle(replay, order);
      }
      assert.deepEqual(result.state, replay);
    }
  });
});

void test('group-step worker preserves object continuations and exact formation progress', async () => {
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
    let continuation: GroupMovementContinuation | null = null;
    for (let count = 0; ; count++) {
      assert.ok(count < 20);
      const before = structuredClone(battle);
      const expected = groupMovementStep(battle, action, continuation);
      const result: MovementStepResult<GroupMovementContinuation> = await executor.run({
        battle,
        action,
        kind: 'group-step',
        continuation,
      });
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
void test('group-step worker admits real partial and enemy-contact endings', async () => {
  await withExecutor(async (executor) => {
    for (const mode of ['partial', 'contact']) {
      let battle = createBattle(
        [
          { id: 'a', x: 1, y: 2, energy: mode === 'partial' ? 2 : 100 },
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
      const action: GroupMoveAction = {
        unitIds: ['a', 'b', 'c'],
        anchorId: 'a',
        x: mode === 'contact' ? 20 : 8,
        y: 2,
        ...(mode === 'partial' ? { movement: 'run' } : {}),
      };
      let continuation: GroupMovementContinuation | null = null;
      for (let count = 0; ; count++) {
        assert.ok(count < 100);
        const expected = groupMovementStep(battle, action, continuation);
        const result: MovementStepResult<GroupMovementContinuation> = await executor.run({
          battle,
          action,
          kind: 'group-step',
          continuation,
        });
        assert.deepEqual(result, expected);
        if (result.status !== 'moving') {
          assert.equal(result.status, mode);
          break;
        }
        battle = result.state;
        continuation = result.continuation;
      }
    }
  });
});
void test('group dispatch builds the same request without calculating an unused preview', () => {
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
void test('executor rejects abandoned jobs and ignores their late messages', async () => {
  const messages: BattleWorkerRequest[] = [],
    worker: BattleWorkerPort = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage: (m) => messages.push(m),
      terminate() {},
    };
  const executor = createBattleExecutor(worker);
  const first = executor.run({ battle: fixture(), kind: 'turn', action: null }),
    second = executor.run({ battle: fixture(), kind: 'turn', action: null });
  worker.onmessage?.(
    new MessageEvent('message', {
      data: {
        id: required(messages[1]).id,
        context: required(messages[1]).context,
        battle: fixture(),
      },
    }),
  );
  assert.deepEqual(await second, fixture());
  const rejected = assert.rejects(first, /closed/);
  executor.close();
  await rejected;
  worker.onmessage?.(
    new MessageEvent('message', { data: { id: required(messages[0]).id, battle: 'late' } }),
  );
  await assert.rejects(executor.run({ battle: fixture(), kind: 'turn', action: null }), /closed/);
});

for (const event of ['onerror', 'onmessageerror'] as const) {
  void test(`executor releases all pending orders after ${event}`, async () => {
    const messages: BattleWorkerRequest[] = [];
    let terminated = 0;
    const worker: BattleWorkerPort = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage: (message) => messages.push(message),
      terminate() {
        terminated++;
      },
    };
    const executor = createBattleExecutor(worker);
    const first = executor.run({
        battle: fixture(),
        kind: 'action',
        action: { type: 'move', unitId: 'p', x: 2, y: 2 },
      }),
      second = executor.run({ battle: fixture(), kind: 'turn', action: null });
    const failures = [
      assert.rejects(first, /Battle worker failed/),
      assert.rejects(second, /Battle worker failed/),
    ];
    if (event === 'onerror') {
      worker.onerror?.(workerError());
    } else {
      worker.onmessageerror?.(new MessageEvent('messageerror'));
    }
    await Promise.all(failures);
    assert.equal(terminated, 1);
    // Late messages and repeated browser error events cannot revive a dead job.
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { id: required(messages[0]).id, battle: { status: 'active' } },
      }),
    );
    worker.onerror?.(workerError());
    worker.onmessageerror?.(new MessageEvent('messageerror'));
    assert.equal(terminated, 1);
    await assert.rejects(
      executor.run({ battle: fixture(), kind: 'turn', action: null }),
      /Battle worker closed/,
    );
    assert.equal(messages.length, 2, 'a failed worker never receives another order');
    executor.close();
    executor.close();
    assert.equal(terminated, 1);
  });
}

void test('background reachable previews use observed occupants and leave battle snapshots unchanged', async () => {
  await withExecutor(async (executor) => {
    for (const exploration of [false, true]) {
      for (const movementIntent of ['forward', 'preserveFacing'] satisfies MovementIntent[]) {
        const battle = fixture();
        if (exploration) {
          battle.mode = 'exploration';
        }
        const before = structuredClone(battle);
        for (const unitId of ['p', 'missing']) {
          const result = await executor.run({
            battle,
            action: { unitId, movementIntent },
            kind: 'reachable-preview',
          });
          const unit = battle.units.find((candidate) => candidate.id === unitId);
          const seen = (point: TacticalPoint) =>
            unit && unit.side === 'player'
              ? teamCanSee(battle, unit.side, point)
              : Boolean(unit && canSee(battle, unit, point));
          const observed = unit
            ? {
                ...battle,
                units: battle.units.filter((other) => other.side === unit.side || seen(other)),
                npcs: (battle.npcs ?? []).filter(seen),
                artillery: knownArtillery(battle, unit),
              }
            : null;
          assert.deepEqual(
            result,
            unit && observed ? getReachable(observed, unitId, { movementIntent }) : [],
          );
          if (unit) {
            for (const other of battle.units.filter(
              (candidate) => candidate.side !== unit.side && !seen(candidate),
            )) {
              assert.ok(
                result.some((point) => point.x === other.x && point.y === other.y),
                'a hidden opponent cannot disclose its cell through the worker bridge',
              );
            }
          }
          if (unitId === 'p' && movementIntent === 'forward') {
            assert.ok(result.length);
          }
        }
        assert.deepEqual(battle, before);
      }
    }
  });
});

void test('worker results require matching game session, sector visit, revision and request identity', async () => {
  for (const field of ['sessionId', 'sectorSessionId', 'revision', 'sectorRevision', 'requestId']) {
    const messages: BattleWorkerRequest[] = [],
      worker: BattleWorkerPort = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage: (message) => messages.push(message),
        terminate() {},
      };
    const executor = createBattleExecutor(worker),
      battle = fixture();
    battle.gameRevision = 8;
    battle.gameSessionId = 'campaign-one';
    const pending = executor.run({ battle, kind: 'turn', action: null }),
      message = required(messages[0]);
    const rejected = assert.rejects(pending, /stale-sector-operation-result/);
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: message.id,
          context: {
            ...message.context,
            [field]: field === 'revision' || field === 'sectorRevision' ? 9 : 'different',
          },
          battle,
        },
      }),
    );
    await rejected;
    executor.close();
  }
});

void test('worker transport rejects malformed requests before executing simulation rules', async () => {
  const messages: BattleWorkerRequest[] = [];
  const worker: BattleWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message) => messages.push(message),
    terminate() {},
  };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture(), kind: 'turn', action: null });
  const request = required(messages[0]);
  let calls = 0;
  const run = () => {
    calls++;
    return fixture();
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
    assert.ok(failure && 'error' in failure);
    assert.equal(failure.id, request.id);
    assert.equal(typeof failure.error, 'string');
    assert.ok(!Object.hasOwn(failure, 'battle'));
  }
  assert.equal(calls, 0);
  worker.onmessage?.(
    new MessageEvent('message', { data: executeBattleWorkerRequest(request, run) }),
  );
  assert.deepEqual(await result, fixture());
  assert.equal(calls, 1);
  executor.close();
});

void test('worker transport reports simulation errors with the original operation identity', async () => {
  const messages: BattleWorkerRequest[] = [];
  const worker: BattleWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message) => messages.push(message),
    terminate() {},
  };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture(), kind: 'turn', action: null });
  const rejected = assert.rejects(result, /simulation failed/);
  const response = executeBattleWorkerRequest(required(messages[0]), () => {
    throw Error('simulation failed');
  });
  assert.ok(response);
  assert.deepEqual(response.context, required(messages[0]).context);
  worker.onmessage?.(new MessageEvent('message', { data: response }));
  await rejected;
  executor.close();
});

void test('executor rejects malformed replies for a pending request and can accept the next reply', async () => {
  for (const malformed of [
    (message: BattleWorkerRequest) => ({ id: message.id, context: message.context }),
    (message: BattleWorkerRequest) => ({ id: message.id, context: null, battle: 'invalid' }),
    (message: BattleWorkerRequest) => ({ id: message.id, context: message.context, error: 42 }),
    (message: BattleWorkerRequest) => ({
      id: message.id,
      context: message.context,
      error: 'failed',
      battle: 'invalid',
    }),
  ]) {
    const messages: BattleWorkerRequest[] = [];
    const worker: BattleWorkerPort = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage: (message) => messages.push(message),
      terminate() {},
    };
    const executor = createBattleExecutor(worker);
    const first = executor.run({ battle: fixture(), kind: 'turn', action: null });
    const rejected = assert.rejects(first, /Invalid battle worker/);
    worker.onmessage?.(new MessageEvent('message', { data: malformed(required(messages[0])) }));
    await rejected;
    const second = executor.run({ battle: fixture(), kind: 'turn', action: null });
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: required(messages[1]).id,
          context: required(messages[1]).context,
          battle: fixture(),
        },
      }),
    );
    assert.deepEqual(await second, fixture());
    executor.close();
  }
});

void test('executor ignores uncorrelated messages without consuming the pending request', async () => {
  const messages: BattleWorkerRequest[] = [];
  const worker: BattleWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message) => messages.push(message),
    terminate() {},
  };
  const executor = createBattleExecutor(worker);
  const result = executor.run({ battle: fixture(), kind: 'turn', action: null });
  for (const data of [null, [], {}, { id: '1' }, { id: 0 }, { id: 1.5 }, { id: 100 }]) {
    assert.doesNotThrow(() => worker.onmessage?.(new MessageEvent('message', { data })));
  }
  worker.onmessage?.(
    new MessageEvent('message', {
      data: {
        id: required(messages[0]).id,
        context: required(messages[0]).context,
        battle: fixture(),
      },
    }),
  );
  assert.deepEqual(await result, fixture());
  executor.close();
});

void test('executor removes a request when posting fails and preserves later requests', async () => {
  const messages: BattleWorkerRequest[] = [];
  let fail = true;
  const worker: BattleWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage(message) {
      if (fail) {
        throw Error('cannot clone');
      }
      messages.push(message);
    },
    terminate() {},
  };
  const executor = createBattleExecutor(worker);
  await assert.rejects(
    executor.run({ battle: fixture(), kind: 'turn', action: null }),
    /cannot clone/,
  );
  fail = false;
  const result = executor.run({ battle: fixture(), kind: 'turn', action: null });
  worker.onmessage?.(
    new MessageEvent('message', {
      data: {
        id: required(messages[0]).id,
        context: required(messages[0]).context,
        battle: fixture(),
      },
    }),
  );
  assert.deepEqual(await result, fixture());
  executor.close();
});

for (const malformed of [null, 'snapshot', {}, { units: [] }]) {
  void test(`executor rejects malformed simulation snapshot ${JSON.stringify(malformed)}`, async () => {
    const messages: BattleWorkerRequest[] = [];
    const worker: BattleWorkerPort = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage: (message) => messages.push(message),
      terminate() {},
    };
    const executor = createBattleExecutor(worker);
    const result = executor.run({ battle: fixture(), kind: 'turn', action: null });
    const rejected = assert.rejects(result);
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: required(messages[0]).id,
          context: required(messages[0]).context,
          battle: malformed,
        },
      }),
    );
    await rejected;
    executor.close();
  });
}

void test('worker admission validates nested inventory and environment action fields', () => {
  const admitted: TacticalAction[] = [
    { type: 'equipLoot', unitId: 'p', slot: 'offhandItem', inventoryKey: null },
    { type: 'prisonerEscort', unitId: 'p', npcId: 'prisoner', escortOrder: 'follow' },
    {
      type: 'inventoryMap',
      unitId: 'p',
      transferKind: 'relay',
      transferRoute: ['p', 'ally'],
      sourceId: 'hand:p',
      destinationId: 'hand:ally',
      expectedSource: 'source',
      count: 1,
    },
    {
      type: 'useItem',
      unitId: 'p',
      item: 'torch',
      environment: { kind: 'container', id: 'chest', x: 1, y: 2, tacticalLevel: 0 },
    },
    {
      type: 'lootBatch',
      unitId: 'p',
      items: [
        { targetId: 'enemy', item: 'weapon', count: 1 },
        { groundId: 'ground', count: 2 },
        { dropIndex: 0, count: 1 },
      ],
    },
    { type: 'move', unitId: 'p', x: 2, y: 2, conversationTargetId: 'resident' },
    { type: 'groupMove', unitIds: ['p'], anchorId: 'p', x: 2, y: 2 },
  ];
  for (const action of admitted) {
    assert.deepEqual(readBattleWorkerAction('action', action), action);
  }
  const invalidFields: Record<string, unknown> = {
    open: 'yes',
    expectedHost: 1,
    expectedCursor: 1,
    family: 1,
    transferKind: 'teleport',
    transferRoute: [1],
    hostId: 1,
    operation: 1,
    kind: 1,
    id: 1,
    wallEdgeId: 1,
    axis: 'z',
    verb: 1,
    index: NaN,
    doorId: 1,
    escortOrder: 'release',
    supplyKey: 1,
    toolKey: 1,
    inventoryKey: {},
    destination: 1,
    linkId: 1,
    hitLocation: 1,
    unitIds: [{}],
    dropIndex: Infinity,
    groundId: 1,
    items: [{ count: 1 }],
    environment: { kind: 'container', id: 1 },
  };
  for (const [key, value] of Object.entries(invalidFields)) {
    assert.throws(
      () =>
        readBattleWorkerAction('action', {
          type: 'inventoryMap',
          unitId: 'p',
          [key]: value,
        }),
      /Invalid battle worker action/,
      key,
    );
  }
  for (const items of [
    [{ targetId: 3, item: 'weapon', count: 1 }],
    [{ groundId: 'ground', count: NaN }],
    [{ dropIndex: '0', count: 1 }],
  ]) {
    assert.throws(() => readBattleWorkerAction('action', { type: 'lootBatch', items }));
  }
  for (const environment of [null, {}, { kind: 'container', x: NaN }, { kind: 'door', verb: 1 }]) {
    assert.throws(() => readBattleWorkerAction('action', { type: 'useItem', environment }));
  }
  assert.throws(() =>
    readBattleWorkerAction('movement-step', {
      type: 'move',
      unitId: 'p',
      x: 2,
      y: 2,
      conversationTargetId: 1,
    }),
  );
  assert.throws(() =>
    readBattleWorkerAction('group', {
      type: 'move',
      unitIds: ['p'],
      anchorId: 'p',
      x: 2,
      y: 2,
    }),
  );
});

void test('worker admission checks route elevations and optional group progress fields', () => {
  const route: TacticalRoutePoint[] = [
    { x: 2, y: 2, elevation: 1, kind: 'climb', linkId: 'ladder' },
  ];
  assert.deepEqual(readBattleWorkerContinuation('movement-step', route), route);
  assert.throws(() =>
    readBattleWorkerContinuation('movement-step', [{ x: 2, y: 2, elevation: 'roof' }]),
  );
  const battle = createBattle([{ id: 'p', x: 1, y: 2 }], {
    width: 8,
    height: 8,
    exploration: true,
    enemies: [],
    tiles: Array.from({ length: 64 }, (_, index) => ({
      x: index % 8,
      y: Math.floor(index / 8),
      type: 'grass',
      blocked: false,
      cover: 0,
    })),
  });
  const result = executeGroupMove(battle, { unitIds: ['p'], anchorId: 'p', x: 2, y: 2 });
  assert.deepEqual(readBattleWorkerResult('group', result), result);
  const member = required(result.members[0]);
  for (const [field, value] of Object.entries({
    to: { x: '2', y: 2 },
    desired: { x: 2, y: NaN },
    status: 1,
    moved: 'yes',
    energyBefore: '100',
    energyAfter: Infinity,
    elapsedSeconds: {},
  })) {
    assert.throws(
      () =>
        readBattleWorkerResult('group', {
          ...result,
          members: [{ ...member, [field]: value }],
        }),
      /Invalid battle worker group report/,
      field,
    );
  }
  const movement = movementStep(battle, { type: 'move', unitId: 'p', x: 2, y: 2 });
  assert.deepEqual(readBattleWorkerResult('movement-step', movement), movement);
  assert.throws(
    () => readBattleWorkerResult('movement-step', { ...movement, unitId: 1 }),
    /Invalid battle worker movement unit/,
  );
});
