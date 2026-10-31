'use client';
import { isJsonObject } from '../../packages/campaign-format/json-value.ts';
import type { JsonObject } from '../../packages/campaign-format/types.ts';
import { Profiler, useEffect, useRef, useState } from 'react';
import Battlefield from '../../apps/web/app/Battlefield';
import { useBattleExecutor } from '../../apps/web/lib/useBattleExecutor';
import { enterSector } from '../../packages/game/world.js';
import {
  getReachable,
  initializeBattlePerception,
  visibleEnemies,
} from '../../packages/game/tactical.js';
import type {
  BattleSnapshot,
  GroupMoveAction,
  GroupMovementResult,
  MoveAction,
} from '../../packages/game/public/compatibility-types.ts';

const SAMPLE_DURATION_MS = 8000;
const FRAME_BUDGET_MS = 16.8;
type PreparedRoute =
  | { kind: 'action'; action: MoveAction }
  | { kind: 'group'; action: GroupMoveAction };
type Timings = {
  searchMs: number;
  orderMs: number;
  renders: { phase: string; duration: number }[];
};
type Outcome =
  | { cancelled: true }
  | {
      phase: BattleSnapshot['phase'];
      lastError: string | null;
      visibleEnemies: number;
      position: { id: string; x: number; y: number }[];
      group?: Pick<GroupMovementResult, 'status' | 'actions' | 'members'>;
    };
const emptyTimings = (): Timings => ({ searchMs: 0, orderMs: 0, renders: [] });
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const maximum = (values: number[]) => (values.length ? Math.max(...values) : null);

export default function Gameplay() {
  const [battle, setBattle] = useState(() =>
    enterSector({
      sector: 'buenos_aires',
      squad: [{ id: 3 }, { id: 4 }, { id: 5 }],
      enemies: [],
      exploration: true,
      hour: 0,
      seed: 8,
    }),
  );
  const calculation = useBattleExecutor(battle);
  const timings = useRef(emptyTimings());
  const prepared = useRef<PreparedRoute | null>(null);
  const sampling = useRef<{ stop: () => void } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState('Prepare a route');

  useEffect(
    () => () => {
      sampling.current?.stop();
    },
    [],
  );

  function measure() {
    if (sampling.current) {
      return;
    }
    const request = prepared.current;
    prepared.current = null;
    timings.current.renders = [];
    setRunning(true);
    setResult('measuring');
    const start = performance.now();
    let last = start;
    let handle = 0;
    let issued = false;
    let stopped = false;
    let outcome: Outcome | null = null;
    const moving: number[] = [];
    const all: number[] = [];
    const slow: { at: number; gap: number; moving: boolean }[] = [];
    const tasks: {
      at: number;
      duration: number;
      type: string;
      name: string;
      frame?: JsonObject;
    }[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const frame: unknown = entry.entryType === 'long-animation-frame' ? entry.toJSON() : null;
        tasks.push({
          at: entry.startTime - start,
          duration: entry.duration,
          type: entry.entryType,
          name: entry.name,
          ...(isJsonObject(frame) ? { frame } : {}),
        });
      }
    });
    const entryTypes = ['longtask', 'long-animation-frame'].filter((type) =>
      PerformanceObserver.supportedEntryTypes.includes(type),
    );
    if (entryTypes.length) {
      observer.observe({ entryTypes });
    }
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(handle);
      observer.disconnect();
      sampling.current = null;
    };
    sampling.current = { stop };

    async function issue(route: PreparedRoute) {
      const orderStart = performance.now();
      let next: BattleSnapshot | null;
      let group: GroupMovementResult | null = null;
      if (route.kind === 'group') {
        group = await calculation.run(route.action, 'group');
        next = group?.state ?? null;
      } else {
        next = await calculation.run(route.action);
      }
      if (stopped) {
        return;
      }
      timings.current.orderMs = performance.now() - orderStart;
      if (!next) {
        outcome = { cancelled: true };
        return;
      }
      outcome = {
        ...(group
          ? { group: { status: group.status, actions: group.actions, members: group.members } }
          : {}),
        phase: next.phase,
        lastError: next.lastError,
        visibleEnemies: visibleEnemies(next).length,
        position: next.units
          .filter((unit) => unit.side === 'player')
          .map(({ id, x, y }) => ({ id, x, y })),
      };
      setBattle(next);
    }

    const tick = (now: number) => {
      const gap = now - last;
      last = now;
      all.push(gap);
      const isMoving = Boolean(document.querySelector('[data-moving="true"]'));
      if (gap > FRAME_BUDGET_MS) {
        slow.push({ at: now - start, gap, moving: isMoving });
      }
      if (isMoving) {
        moving.push(gap);
      }
      if (!issued && request) {
        issued = true;
        void issue(request);
      }
      if (now - start < SAMPLE_DURATION_MS) {
        handle = requestAnimationFrame(tick);
        return;
      }
      const sorted = [...moving].sort((left, right) => left - right);
      stop();
      setRunning(false);
      setResult(
        JSON.stringify({
          orderMetric: 'asynchronous elapsed time, not main-thread CPU time',
          outcome,
          scenario: {
            reactionEnabled: battle.units.some(
              (unit) => unit.side === 'enemy' && unit.overwatch !== false,
            ),
            enemies: battle.units.filter((unit) => unit.side === 'enemy' && unit.hp > 0).length,
            players: battle.units.filter((unit) => unit.side === 'player' && unit.hp > 0).length,
            night: battle.night,
            visibleEnemies: visibleEnemies(battle).length,
            renderedActors: document.querySelectorAll('[data-unit-id]').length,
          },
          timings: timings.current,
          movingFrames: moving.length,
          mean: mean(moving),
          p95: sorted[Math.floor(sorted.length * 0.95)] ?? null,
          p99: sorted[Math.floor(sorted.length * 0.99)] ?? null,
          max: maximum(moving),
          overBudget: moving.filter((value) => value > FRAME_BUDGET_MS).length,
          slow,
          tasks,
          wholeMax: maximum(all),
          wholeOverBudget: all.filter((value) => value > FRAME_BUDGET_MS).length,
          wholeMean: mean(all),
        }),
      );
    };
    handle = requestAnimationFrame(tick);
  }

  function prepare(group = false) {
    timings.current = emptyTimings();
    const searchStart = performance.now();
    const unit = battle.units.find((actor) => actor.side === 'player');
    if (!unit) {
      prepared.current = null;
      setResult('no player');
      return;
    }
    const path = getReachable(battle, unit)
      .filter((point) => point.path.length >= 10 && point.path.length <= 18)
      .sort((left, right) => right.path.length - left.path.length)[0];
    timings.current.searchMs = performance.now() - searchStart;
    if (!path) {
      prepared.current = null;
      setResult('no path');
      return;
    }
    const destination = { x: path.x, y: path.y, tacticalLevel: path.tacticalLevel ?? 0 };
    prepared.current = group
      ? {
          kind: 'group',
          action: {
            unitIds: battle.units
              .filter((actor) => actor.side === 'player')
              .map((actor) => actor.id),
            anchorId: unit.id,
            ...destination,
          },
        }
      : { kind: 'action', action: { type: 'move', unitId: unit.id, ...destination } };
    setResult('Route prepared');
  }

  function scene(sector: string, enemyCount = 0, reactions = true, lineup = true) {
    prepared.current = null;
    const next = enterSector({
      sector,
      squad: [{ id: 3 }, { id: 4 }, { id: 5 }, { id: 1 }, { id: 7 }, { id: 8 }],
      enemies: Array.from({ length: enemyCount }, () => ({ overwatch: reactions })),
      exploration: true,
      hour: 12,
      seed: 8,
    });
    if (enemyCount && lineup) {
      next.units
        .filter((unit) => unit.side === 'player')
        .forEach((unit, index) => {
          unit.x = 43;
          unit.y = 20 + index;
          unit.facing = 6;
        });
      initializeBattlePerception(next);
    }
    setBattle(next);
    setResult('Prepare a route');
  }

  return (
    <>
      <button disabled={running} onClick={() => scene('tucuman')}>
        Forest scene
      </button>
      <button disabled={running} onClick={() => scene('tucuman', 4)}>
        Four enemies
      </button>
      <button disabled={running} onClick={() => scene('tucuman', 30)}>
        Thirty enemies
      </button>
      <button disabled={running} onClick={() => scene('tucuman', 30, false)}>
        Thirty enemies without reactions
      </button>
      <button disabled={running} onClick={() => scene('tucuman', 30, true, false)}>
        Thirty hidden enemies
      </button>
      <button
        disabled={running}
        onClick={() => {
          prepared.current = null;
          timings.current = emptyTimings();
          measure();
        }}
      >
        Measure scene
      </button>
      <button
        disabled={running}
        onClick={() =>
          setBattle({
            ...battle,
            night: !battle.night,
            startSeconds: (battle.night ? 12 : 24) * 3600 - battle.elapsedSeconds,
          })
        }
      >
        Change lighting
      </button>
      <button
        disabled={running}
        onClick={() =>
          setBattle({
            ...battle,
            revealedRooms: battle.buildings.flatMap((building) =>
              (building.rooms ?? []).map((room) => room.id),
            ),
          })
        }
      >
        Reveal rooms
      </button>
      <button disabled={running} onClick={() => prepare()}>
        Prepare route
      </button>
      <button disabled={running} onClick={() => prepare(true)}>
        Prepare group route
      </button>
      <button disabled={running} onClick={measure}>
        Measure walk
      </button>
      <output style={{ display: 'block', height: 64, overflow: 'auto' }}>{result}</output>
      <Profiler
        id="battlefield"
        onRender={(_id, phase, duration) => {
          if (sampling.current && duration > 1) {
            timings.current.renders.push({ phase, duration });
          }
        }}
      >
        <Battlefield
          battle={battle}
          onChange={(next) => {
            setBattle(next);
            return next;
          }}
          onFinish={() => {}}
        />
      </Profiler>
    </>
  );
}
