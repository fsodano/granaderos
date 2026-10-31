import assert from 'node:assert/strict';
type PresentationAct = (callback: () => Promise<void>) => PromiseLike<void>;
interface PresentationTimer {
  at: number;
  run: () => void;
}
// Advance actual presentation callbacks in chronological order. Tests still
// wait for the visible frames and final commit, without wall-clock delays.
export function battleTimers(act: PresentationAct) {
  const oldTimeout = globalThis.setTimeout,
    oldClear = globalThis.clearTimeout,
    pending = new Map<number, PresentationTimer>();
  let clock = 0,
    serial = 0;
  const schedule = <Args extends unknown[]>(
    fn: (...args: Args) => void,
    delay = 0,
    ...args: Args
  ) => {
    const id = ++serial;
    pending.set(id, { at: clock + Math.max(0, Number(delay) || 0), run: () => fn(...args) });
    return id;
  };
  const cancel = (id: number | NodeJS.Timeout | string | undefined) => {
    return typeof id === 'number' && pending.delete(id);
  };
  // Presentation callbacks use browser timer handles, even in the Node test host.
  Object.defineProperties(globalThis, {
    setTimeout: { value: schedule },
    clearTimeout: { value: cancel },
  });
  async function until(done: () => boolean, observe: () => void = () => {}) {
    for (let i = 0; !done(); i++) {
      observe();
      assert.ok(i < 2000, 'presentation must finish in a bounded number of callbacks');
      const next = [...pending.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      assert.ok(next, 'a presentation callback must remain until the final state is committed');
      pending.delete(next[0]);
      clock = next[1].at;
      await act(async () => next[1].run());
    }
  }
  return {
    until,
    wait: (ms: number) => new Promise<void>((resolve) => oldTimeout(resolve, ms)),
    settle: (document: Document) => until(() => !document.querySelector('[data-enemy-frame]')),
    restore() {
      globalThis.setTimeout = oldTimeout;
      globalThis.clearTimeout = oldClear;
      pending.clear();
    },
  };
}
