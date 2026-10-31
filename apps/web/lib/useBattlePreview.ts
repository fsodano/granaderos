'use client';
import { useEffect, useRef, useState } from 'react';
import { createBattleExecutor } from './battle-executor.ts';
import { createLatestPreview, type LatestPreviewQueue } from './latest-preview.ts';
import {
  readBattlePreview,
  type BattlePreviewJob,
  type BattlePreviewKind,
  type BattlePreviewRequestByKind,
  type BattlePreviewResultByKind,
} from './battle-preview.ts';
import battleWorkerUrl from './battle-worker.ts?worker&url';

export interface BattlePreviewState<Preview> {
  preview: Preview | null;
  working: boolean;
  failed: boolean;
}

export function useBattlePreview<Kind extends BattlePreviewKind>(
  battle: unknown,
  request: BattlePreviewRequestByKind[NoInfer<Kind>] | null,
  kind: Kind,
): BattlePreviewState<BattlePreviewResultByKind[Kind]> {
  type Job = BattlePreviewJob<Kind>;
  type Preview = BattlePreviewResultByKind[Kind];
  const queue = useRef<LatestPreviewQueue<Job> | null>(null);
  const [resolved, setResolved] = useState<{
    job: Job;
    preview: Preview | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let executor: ReturnType<typeof createBattleExecutor> | null = null;
    const current = createLatestPreview<Job, Preview>(
      async (job) => {
        executor ??= createBattleExecutor(new Worker(battleWorkerUrl, { type: 'module' }));
        const running = executor;
        try {
          return readBattlePreview(job.kind, await running.run(job));
        } catch (error) {
          // A failed worker stays closed. Release it so a later request can
          // recover while the player remains in the same sector view.
          running.close();
          if (executor === running) executor = null;
          throw error;
        }
      },
      (job, completion) =>
        setResolved({
          job,
          preview: completion.ok ? completion.value : null,
          failed: !completion.ok,
        }),
    );
    queue.current = current;
    return () => {
      current.close();
      executor?.close();
      queue.current = null;
    };
  }, []);

  useEffect(() => {
    queue.current?.request(request === null ? null : { battle, action: request, kind });
  }, [battle, request, kind]);

  const current =
    request !== null &&
    resolved !== null &&
    resolved.job.battle === battle &&
    resolved.job.action === request &&
    resolved.job.kind === kind;
  return {
    preview: current ? resolved.preview : null,
    working: request !== null && !current,
    failed: current && resolved.failed,
  };
}
