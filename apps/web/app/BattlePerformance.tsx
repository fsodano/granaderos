'use client';

import { useEffect, useState } from 'react';
import { usePerformanceMode } from './usePerformanceMode';
export default function BattlePerformance() {
  const enabled = usePerformanceMode();
  const [running, setRunning] = useState(false),
    [result, setResult] = useState('');
  useEffect(() => {
    if (!running) {
      return;
    }
    let raf = 0,
      start = 0,
      last = 0;
    const all: number[] = [],
      moving: number[] = [],
      tasks: { at: number; ms: number }[] = [],
      events: {
        at: number;
        frame: string;
        actors: { id: string | null; moving: string | null }[];
      }[] = [];
    let previous = '';
    const observer =
      typeof PerformanceObserver === 'undefined'
        ? null
        : new PerformanceObserver((list) =>
            tasks.push(
              ...list.getEntries().map((e) => ({ at: e.startTime - start, ms: e.duration })),
            ),
          );
    if (observer && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      observer.observe({ entryTypes: ['longtask'] });
    }
    const stats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        frames: values.length,
        meanMs: values.reduce((a, b) => a + b, 0) / (values.length || 1),
        p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        maxMs: sorted.at(-1) ?? 0,
        over33ms: values.filter((n) => n > 33.4).length,
      };
    };
    const tick = (now: number) => {
      if (!start) {
        start = last = now;
      } else {
        all.push(now - last);
        if (document.querySelector('[data-moving="true"]')) {
          moving.push(now - last);
        }
        last = now;
      }
      const field = document.querySelector('[data-enemy-frame]'),
        key = field?.getAttribute('data-enemy-frame') ?? '';
      if (key !== previous) {
        previous = key;
        events.push({
          at: now - start,
          frame: key,
          actors: [...document.querySelectorAll('[data-unit-id]')].map((e) => ({
            id: e.getAttribute('data-unit-id'),
            moving: e.getAttribute('data-moving'),
          })),
        });
      }
      if (now - start < 10000) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setResult(
        JSON.stringify({
          all: stats(all),
          moving: stats(moving),
          longTasks: tasks,
          events,
          svgElements: document.querySelectorAll('svg *').length,
        }),
      );
      setRunning(false);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [running]);
  if (!enabled) {
    return null;
  }
  return (
    <aside
      aria-label="Combat measurement"
      style={{
        position: 'fixed',
        top: 64,
        right: 8,
        zIndex: 10000,
        background: '#111',
        color: '#fff',
        fontSize: 11,
        maxWidth: 480,
      }}
    >
      <button
        disabled={running}
        onClick={() => {
          setResult('Measuring 10 seconds');
          setRunning(true);
        }}
      >
        Measure combat frames
      </button>
      <output
        aria-label="Combat frame measurements"
        style={{ display: 'block', maxHeight: 130, overflow: 'auto' }}
      >
        {result}
      </output>
    </aside>
  );
}
