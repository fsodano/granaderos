'use client';
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { BattlePresentationFrame } from '../../../../packages/game/public/compatibility-types.ts';
import type { ActorEntry } from './presentation';
import { ActorCueStore } from './actor-cue-store';

export function useActorCues(
  sceneId: string,
  entries: readonly ActorEntry[],
  frame?: BattlePresentationFrame | null,
) {
  const [store] = useState(() => new ActorCueStore());
  const cues = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useLayoutEffect(() => {
    store.observe(sceneId, entries, frame);
  }, [store, sceneId, entries, frame]);
  return { cues, accepted: store.accepted, complete: store.complete };
}
