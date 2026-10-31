export type PreviewCompletion<Result> =
  | { ok: true; value: Result }
  | { ok: false; error: unknown };

export interface LatestPreviewQueue<Job> {
  request(job: Job | null): void;
  close(): void;
}

// Keep one active calculation and one replacement. An old snapshot cannot
// publish a route after a replacement, cancellation, or close.
export function createLatestPreview<Job, Result>(
  run: (job: Job) => Result | PromiseLike<Result>,
  receive: (job: Job, completion: PreviewCompletion<Result>) => void,
): LatestPreviewQueue<Job> {
  let revision = 0;
  let pending: { job: Job; revision: number } | null = null;
  let active = false;
  let closed = false;

  async function drain(): Promise<void> {
    active = true;
    try {
      while (pending !== null && !closed) {
        const current = pending;
        pending = null;
        let completion: PreviewCompletion<Result>;
        try {
          completion = { ok: true, value: await run(current.job) };
        } catch (error) {
          completion = { ok: false, error };
        }
        if (!closed && revision === current.revision) {
          receive(current.job, completion);
        }
      }
    } finally {
      active = false;
    }
  }

  return {
    request(job) {
      if (closed) {
        return;
      }
      revision++;
      pending = job === null ? null : { job, revision };
      if (pending !== null && !active) {
        void drain();
      }
    },
    close() {
      closed = true;
      revision++;
      pending = null;
    },
  };
}
