'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import { hasPendingArrivalDecision } from '../../../packages/game/squad-travel.js';
import { strategicClockInterrupt } from '../../../packages/game/strategic-clock.ts';

type ClockControl = {
  campaign: CampaignSnapshot;
  running: boolean;
  cause: string;
  pending: CampaignSnapshot | null;
  arrivalPending: boolean;
};

export function useStrategicClock(
  state: CampaignSnapshot,
  dispatch: (action: CampaignAction) => void,
) {
  const [speed, setSpeed] = useState(300);
  const [control, setControl] = useState<ClockControl>(() => ({
    campaign: state,
    running: false,
    cause: '',
    pending: null,
    arrivalPending: hasPendingArrivalDecision(state),
  }));
  const arrivalPending = hasPendingArrivalDecision(state);
  const blocked = Boolean(
    state.pendingBattle || state.pendingEncounter || state.defeated || arrivalPending,
  );
  let current = control;
  if (control.campaign !== state) {
    const reason = control.pending ? strategicClockInterrupt(control.pending, state) : null;
    current = {
      campaign: state,
      running: control.running && !blocked && !reason,
      cause: reason ?? (control.arrivalPending && !arrivalPending ? '' : control.cause),
      pending: null,
      arrivalPending,
    };
    setControl(current);
  }
  const advance = useEffectEvent(() => {
    if (current.pending || blocked || document.hidden) {
      return;
    }
    setControl((previous) => ({ ...previous, pending: state }));
    dispatch({
      type: 'advanceStrategicTime',
      seconds: Math.max(1, Math.round(speed / 4)),
    });
  });
  useEffect(() => {
    if (!current.running) {
      return;
    }
    const timer = setInterval(advance, 250);
    return () => {
      clearInterval(timer);
    };
  }, [current.running]);
  return {
    running: current.running,
    speed,
    cause: blocked ? strategicClockInterrupt(state, state) : current.cause,
    setSpeed,
    toggle: () => {
      setControl((previous) => ({
        ...previous,
        cause: '',
        running: !blocked && !previous.running,
      }));
    },
    pause: () => {
      setControl((previous) => ({ ...previous, running: false }));
    },
  };
}
