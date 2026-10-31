import type { TestContext } from 'node:test';
type PresentationAct = (callback: () => Promise<void>) => PromiseLike<void>;
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';

// Drive the actual continuous-clock callbacks through its rendered controls.
// Each callback can stop the clock; the fixture never skips an interrupt.
export function strategicClockControls(t: TestContext, act: PresentationAct, document: Document) {
  const callbacks = new Map<number, () => void>();
  const window = present(document.defaultView);
  let serial = 0;
  const interval = t.mock.method(globalThis, 'setInterval', (callback: () => void) => {
    const id = ++serial;
    callbacks.set(id, callback);
    return id;
  });
  const clear = t.mock.method(globalThis, 'clearInterval', (id: number) => callbacks.delete(id));
  t.after(() => {
    interval.mock.restore();
    clear.mock.restore();
    callbacks.clear();
  });
  return {
    async advanceHour() {
      const speed = document.querySelector<HTMLSelectElement>(
        '[aria-label="Velocidad del tiempo"]',
      );
      assert.ok(speed, 'continuous speed control');
      if (speed.value !== '3600') {
        const descriptor = present(Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value'));
        if (typeof descriptor.set !== 'function') { throw new Error('The native form control must have a value setter.'); }
        descriptor.set.call(speed, '3600');
        await act(async () => {
          speed.dispatchEvent(new window.Event('change', { bubbles: true }));
        });
      }
      if (!callbacks.size) {
        const start = [...document.querySelectorAll('button')].find(
          (b) => (b.textContent ?? '').trim() === '▶ Iniciar',
        );
        assert.ok(start, 'resume the continuous clock');
        assert.equal(start.disabled, false);
        await act(async () => {
          start.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        });
      }
      for (let quarter = 0; quarter < 4 && callbacks.size; quarter++) {
        const callback = present(callbacks.values().next().value);
        await act(async () => callback());
      }
      const pause = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent ?? '').trim() === 'Ⅱ Pausar',
      );
      if (pause) {
        await act(async () => {
          pause.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        });
      }
    },
  };
}
