'use client';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker URL; native URL workers break the static export.
import enemyWorkerUrl from './enemy-turn-worker.ts?worker&url';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { presentedEndTurn } from '../../../packages/game/tactical.js';
import {
  BATTLE_PLAYBACK,
  battleFrameDuration,
  battleFrameFocus,
} from '../../../packages/game/battle-playback.js';
import { movementStepDuration } from './three/movement-timing';
import { surfaceMotionPoint } from './tactical-elevation';
import {
  admittedReloadWork,
  admittedThrownRelease,
  admittedHealingIntervals,
  nativeActionFrameDuration,
} from './three/action-timing';
import {
  admittedMountTransitions,
  mountFrameDuration,
} from './three/mount-presentation';
import { actionPresentationDuration } from './three/action-pace';

import type {
  BattleSnapshot,
  BattlePresentationFrame,
  BattlePlaybackFrame,
  PresentedBattleResult,
  TacticalPoint,
} from '../../../packages/game/public/compatibility-types.ts';
import { isWorkerRecord } from './battle-worker-values.ts';
import { readPresentedBattleResult } from './enemy-playback-values.ts';
type Commit = (state: BattleSnapshot) => BattleSnapshot | null | void;
interface PendingTurn {
  id: number;
  resolve: (result: PresentedBattleResult) => void;
  reject: (error: Error) => void;
}
const stepMs = BATTLE_PLAYBACK.step;
export function presentedFrameDuration(
  frame: BattlePresentationFrame,
  previous: BattleSnapshot,
) {
  if (frame.type !== 'step') {
    return actionPresentationDuration(
      mountFrameDuration(
        frame,
        nativeActionFrameDuration(frame, battleFrameDuration(frame)),
      ),
    );
  }
  if (!frame.unitId) {
    return stepMs;
  }
  const actor = frame.state.units.find((unit) => unit.id === frame.unitId),
    before = previous.units.find((unit) => unit.id === frame.unitId);
  if (!actor || !before) {
    return stepMs;
  }
  // Each observed step is adjacent. Reappearing actors do not expose the
  // distance they travelled outside sight through a longer playback delay.
  const distance = Math.hypot(actor.x - before.x, actor.y - before.y),
    endpoint = actor.lastMovePath?.at(-1) ?? actor;
  if (
    distance > Math.SQRT2 + 0.000001 ||
    (distance === 0 && (!('kind' in endpoint) || endpoint.kind !== 'climb'))
  ) {
    return stepMs;
  }
  if ('kind' in endpoint && endpoint.kind === 'climb') {
    return movementStepDuration(
      actor,
      surfaceMotionPoint(previous, before, frame.state),
      surfaceMotionPoint(frame.state, endpoint, previous),
      stepMs,
    );
  }
  return movementStepDuration(actor, before, endpoint, stepMs);
}
export function useEnemyPlayback(
  committed: BattleSnapshot,
  onChange: Commit,
  onBusy?: (busy: boolean) => void,
  validate?: (state: BattleSnapshot) => boolean,
  onFrame?: (before: BattleSnapshot, after: BattleSnapshot) => void,
) {
  const [frame, setFrame] = useState<BattlePlaybackFrame | null>(null),
    [busy, setBusy] = useState(false);
  const live = useRef(false),
    pending = useRef(false),
    epoch = useRef(0),
    sequence = useRef(0),
    presentationSequence = useRef(0),
    latest = useRef(committed),
    worker = useRef<Worker | null>(null),
    request = useRef<PendingTurn | null>(null);
  useLayoutEffect(() => {
    latest.current = committed;
  }, [committed]);
  const notifyUnmount = useEffectEvent(() => onBusy?.(false));
  useEffect(() => {
    live.current = true;
    const mountedEpoch = ++epoch.current;
    try {
      const w = new Worker(enemyWorkerUrl, { type: 'module' });
      worker.current = w;
      w.onmessage = ({ data }: MessageEvent<unknown>) => {
        const r = request.current;
        if (
          worker.current !== w ||
          !r ||
          !isWorkerRecord(data) ||
          data['id'] !== r.id
        ) {
          return;
        }
        request.current = null;
        try {
          if (typeof data['error'] === 'string') {
            r.reject(Error(data['error']));
          } else {
            r.resolve(readPresentedBattleResult(data['result']));
          }
        } catch (error) {
          r.reject(
            error instanceof Error
              ? error
              : new Error('Invalid enemy turn response'),
          );
        }
      };
      const fail = () => {
        request.current?.reject(
          Error('No se pudo completar el turno. Intentá de nuevo.'),
        );
        request.current = null;
        w.terminate();
        worker.current = null;
      };
      w.onerror = fail;
      w.onmessageerror = fail;
    } catch {
      worker.current = null;
    }
    return () => {
      live.current = false;
      epoch.current = mountedEpoch + 1;
      pending.current = false;
      request.current?.reject(Error('cancelled'));
      request.current = null;
      worker.current?.terminate();
      worker.current = null;
      notifyUnmount();
    };
  }, []);
  async function play(
    execute: () => Promise<PresentedBattleResult> | PresentedBattleResult,
    commit: Commit = onChange,
  ) {
    if (pending.current || !live.current) {
      return;
    }
    const source = committed,
      generation = epoch.current,
      current = () =>
        live.current &&
        epoch.current === generation &&
        latest.current === source;
    pending.current = true;
    setBusy(true);
    onBusy?.(true);
    try {
      const result = await execute();
      if (!current() || validate?.(result.state) === false) {
        return;
      }
      let cameraFocus: TacticalPoint | null = null,
        index = 0,
        previous = source,
        grenadeEffect: BattlePresentationFrame['grenadeEffect'] = null,
        actionId = 0,
        actionStartedAt = 0,
        actionDurationMs = 0;
      const sequenceId = `${generation}:${++presentationSequence.current}`;
      const frames = admittedMountTransitions(
        admittedHealingIntervals(
          admittedThrownRelease(admittedReloadWork(result.frames)),
        ),
      );
      let timingState = source;
      const durations = frames.map((next) => {
        const duration = presentedFrameDuration(next, timingState);
        timingState = next.state;
        return duration;
      });
      for (const next of frames) {
        if (!current()) {
          return;
        }
        cameraFocus = battleFrameFocus(next) ?? cameraFocus;
        const startedAt = performance.now();
        if (next.grenadeVisual) {
          grenadeEffect = { id: index, startedAt, visual: next.grenadeVisual };
        }
        if (next.type === 'prepare' || index === 0) {
          actionId++;
          actionStartedAt = performance.now();
          actionDurationMs = 0;
          for (let cursor = index; cursor < frames.length; cursor++) {
            if (cursor > index && frames[cursor]?.type === 'prepare') {
              break;
            }
            actionDurationMs += durations[cursor] ?? 0;
          }
        }
        const delay = durations[index] ?? stepMs;
        setFrame({
          ...next,
          index: index++,
          cameraFocus,
          grenadeEffect,
          sequenceId,
          actionId,
          actionStartedAt,
          actionDurationMs,
          startedAt,
          durationMs: delay,
        });
        onFrame?.(previous, next.state);
        previous = next.state;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (next.type === 'result') {
          grenadeEffect = null;
        }
      }
      if (current()) {
        onFrame?.(previous, result.state);
        return commit(result.state);
      }
    } catch (error) {
      if (current()) {
        onChange({
          ...source,
          lastError:
            error instanceof Error
              ? error.message
              : 'No se pudo completar el turno. Intentá de nuevo.',
        });
      }
    } finally {
      if (live.current && epoch.current === generation) {
        setFrame(null);
        setBusy(false);
        pending.current = false;
        onBusy?.(false);
      }
    }
  }
  function run() {
    return play(() => {
      const activeWorker = worker.current;
      return activeWorker
        ? new Promise<PresentedBattleResult>((resolve, reject) => {
            const id = ++sequence.current;
            request.current = { id, resolve, reject };
            activeWorker.postMessage({ id, state: committed });
          })
        : new Promise<PresentedBattleResult>((resolve, reject) =>
            setTimeout(() => {
              try {
                resolve(presentedEndTurn(committed));
              } catch (error) {
                reject(error);
              }
            }, 0),
          );
    });
  }
  function present(result: PresentedBattleResult, commit: Commit) {
    return play(() => result, commit);
  }
  const state = useMemo<BattleSnapshot>(
    () =>
      frame
        ? {
            ...frame.state,
            ...(frame.visibleIds
              ? { presentationVisibleIds: frame.visibleIds }
              : {}),
            presentationStepMs:
              frame.type === 'step' ? frame.durationMs : stepMs,
            presentationMovingUnitId:
              frame.type === 'step' ? (frame.unitId ?? null) : null,
          }
        : committed,
    [frame, committed],
  );
  return { state, busy, run, present, frame };
}
