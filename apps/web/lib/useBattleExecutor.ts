'use client';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker URL; native URL workers break the static export.
import battleWorkerUrl from './battle-worker.ts?worker&url';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createBattleExecutor } from './battle-executor.ts';
import { BattleJobKind } from './battle-worker-contracts.ts';
import type {
  BattleWorkerJob,
  BattleWorkerActionByKind,
  BattleWorkerResultByKind,
  BattleWorkerContinuationByKind,
} from './battle-worker-contracts.ts';
import type {
  BattleSnapshot,
  TacticalAction,
} from '../../../packages/game/public/compatibility-types.ts';
import { readBattleWorkerResult } from './battle-worker-values.ts';
type MutationKind = Exclude<BattleJobKind, 'reachable-preview' | 'group-preview'>;
import { runBattleJob } from '../../../packages/game/battle-job.ts';
import { sectorOperationContextFor } from '../../../packages/game/infrastructure/sector-sessions/sector-operation-context.js';

export function useBattleExecutor(battle: BattleSnapshot) {
  const latest = useRef(battle);
  useLayoutEffect(() => {
    latest.current = battle;
  }, [battle]);
  const executor = useRef<ReturnType<typeof createBattleExecutor> | null>(null);
  const live = useRef(false),
    pending = useRef(false),
    generation = useRef(0),
    sequence = useRef(0);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const epoch = ++generation.current;
    live.current = true;
    pending.current = false;
    let mountedExecutor: ReturnType<typeof createBattleExecutor> | null = null;
    try {
      mountedExecutor = createBattleExecutor(new Worker(battleWorkerUrl, { type: 'module' }));
      executor.current = mountedExecutor;
    } catch {
      executor.current = null;
    }
    return () => {
      generation.current = epoch + 1;
      live.current = false;
      mountedExecutor?.close();
      executor.current = null;
    };
  }, []);
  function run(action: TacticalAction): Promise<BattleSnapshot | null>;
  function run<Kind extends MutationKind>(
    action: BattleWorkerActionByKind[NoInfer<Kind>],
    kind: Kind,
    continuation?: BattleWorkerContinuationByKind[NoInfer<Kind>] | null,
  ): Promise<BattleWorkerResultByKind[Kind] | null>;
  async function run(
    action: BattleWorkerActionByKind[MutationKind],
    kind: MutationKind = BattleJobKind.Action,
    continuation?: BattleWorkerContinuationByKind[MutationKind] | null,
  ): Promise<BattleWorkerResultByKind[MutationKind] | null> {
    if (pending.current || !live.current) {
      return null;
    }
    pending.current = true;
    setWorking(true);
    const source = battle,
      epoch = generation.current,
      context = sectorOperationContextFor(source, `${epoch}:${++sequence.current}`),
      job: BattleWorkerJob<MutationKind> = {
        battle: source,
        action,
        kind,
        context: context.snapshot(),
        ...(continuation ? { continuation } : {}),
      };
    const current = () =>
      live.current &&
      generation.current === epoch &&
      latest.current === source &&
      context.matches(
        sectorOperationContextFor(latest.current, context.snapshot().requestId).snapshot(),
      );
    try {
      let result: BattleWorkerResultByKind[MutationKind];
      try {
        result = executor.current
          ? await executor.current.run(job)
          : readBattleWorkerResult(kind, runBattleJob(job));
      } catch {
        if (!current()) {
          return null;
        }
        result = readBattleWorkerResult(kind, runBattleJob(job));
      }
      return current() ? result : null;
    } catch {
      if (!current()) {
        return null;
      }
      const reason = 'No se pudo completar la orden. Intentá de nuevo.';
      return kind === 'group'
        ? {
            state: source,
            members: [],
            status: 'invalid',
            reason,
            elapsedSeconds: 0,
            actions: 0,
            orders: [],
          }
        : ['movement-step', 'group-step'].includes(kind)
          ? {
              state: { ...source, lastError: reason },
              continuation: null,
              status: 'stopped',
            }
          : { ...source, lastError: reason };
    } finally {
      if (generation.current === epoch) {
        pending.current = false;
        if (live.current) {
          setWorking(false);
        }
      }
    }
  }
  return { run, working, pending };
}
