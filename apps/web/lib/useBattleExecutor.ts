'use client';
import { useEffect, useRef, useState } from 'react';
import { createBattleExecutor } from './battle-executor.js';
import { runBattleJob } from '../../../packages/game/battle-job.js';
import { sectorOperationContextFor } from '../../../packages/game/infrastructure/sector-sessions/sector-operation-context.js';
import battleWorkerUrl from './battle-worker.ts?worker&url';
export function useBattleExecutor(battle: any) {
  const latest = useRef(battle);
  latest.current = battle;
  const executor = useRef<ReturnType<typeof createBattleExecutor> | null>(null);
  const live = useRef(false),
    pending = useRef(false),
    generation = useRef(0),
    sequence = useRef(0);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    generation.current++;
    live.current = true;
    pending.current = false;
    setWorking(false);
    try {
      executor.current = createBattleExecutor(new Worker(battleWorkerUrl, { type: 'module' }));
    } catch {
      executor.current = null;
    }
    return () => {
      generation.current++;
      live.current = false;
      executor.current?.close();
      executor.current = null;
    };
  }, []);
  async function run(
    action: any,
    kind: 'action' | 'turn' | 'group' | 'movement-step' | 'group-step' | 'resume' = 'action',
    continuation?: any,
  ) {
    if (pending.current || !live.current) return null;
    pending.current = true;
    setWorking(true);
    const source = battle,
      epoch = generation.current,
      context = sectorOperationContextFor(source, `${epoch}:${++sequence.current}`),
      job = {
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
      let result;
      try {
        result = executor.current ? await executor.current.run(job) : runBattleJob(job);
      } catch {
        if (!current()) return null;
        result = runBattleJob(job);
      }
      return current() ? result : null;
    } catch {
      if (!current()) return null;
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
          ? { state: { ...source, lastError: reason }, continuation: null, status: 'stopped' }
          : { ...source, lastError: reason };
    } finally {
      if (generation.current === epoch) {
        pending.current = false;
        if (live.current) setWorking(false);
      }
    }
  }
  return { run, working, pending };
}
