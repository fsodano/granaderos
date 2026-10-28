'use client';
import { useEffect, useRef, useState } from 'react';
import { hasPendingArrivalDecision } from '../../../packages/game/squad-travel.js';
import { strategicClockInterrupt } from '../../../packages/game/strategic-clock.js';
export function useStrategicClock(state: any, dispatch: (action: any) => void) {
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(300),
    [cause, setCause] = useState('');
  const current = useRef(state),
    send = useRef(dispatch),
    pending = useRef<any>(null),
    arrivalWasPending = useRef(hasPendingArrivalDecision(state));
  current.current = state;
  send.current = dispatch;
  useEffect(() => {
    const arrivalPending = hasPendingArrivalDecision(state);
    if (arrivalWasPending.current && !arrivalPending) setCause('');
    arrivalWasPending.current = arrivalPending;
    if (pending.current && pending.current !== state) {
      const reason = strategicClockInterrupt(pending.current, state);
      pending.current = null;
      if (reason) {
        setRunning(false);
        setCause(reason);
      }
    }
    if (
      state.pendingBattle ||
      state.pendingEncounter ||
      state.defeated ||
      hasPendingArrivalDecision(state)
    )
      setRunning(false);
  }, [state]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (pending.current || document.hidden) return;
      const before = current.current;
      if (
        before.pendingBattle ||
        before.pendingEncounter ||
        before.defeated ||
        hasPendingArrivalDecision(before)
      ) {
        setRunning(false);
        return;
      }
      pending.current = before;
      send.current({
        type: 'advanceStrategicTime',
        seconds: Math.max(1, Math.round(speed / 4)),
      });
    }, 250);
    return () => clearInterval(timer);
  }, [running, speed]);
  const blocked =
    state.pendingBattle ||
    state.pendingEncounter ||
    state.defeated ||
    hasPendingArrivalDecision(state);
  return {
    running,
    speed,
    cause: blocked ? strategicClockInterrupt(state, state) : cause,
    setSpeed,
    toggle: () => {
      setCause('');
      setRunning((value) => !value);
    },
    pause: () => setRunning(false),
  };
}
