import type { BattlePresentationFrame } from '../../../../packages/game/public/compatibility-types.ts';
import {
  actorKey,
  semanticOrder,
  observedActorTransitions,
  admittedImpactCue,
} from './presentation';
import type { ActorCue, ActorEntry, ActorObservation } from './presentation';

/** Own the cosmetic event stream observed by the animation renderer. */
export class ActorCueStore {
  private sceneId = '';
  private serial = 0;
  private entries: readonly ActorEntry[] = [];
  private previous: readonly ActorObservation[] = [];
  private cues: Readonly<Record<string, ActorCue>> = {};
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }
  readonly getSnapshot = () => this.cues;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(cues: Readonly<Record<string, ActorCue>>) {
    this.cues = cues;
    for (const listener of this.listeners) {
      listener();
    }
  }
  private cue(action: string, extra: Partial<ActorCue> = {}): ActorCue {
    return {
      id: `${this.sceneId}:event:${++this.serial}`,
      action,
      startedAt: this.now(),
      ...extra,
    };
  }
  readonly accepted = (
    unitId: string,
    type: string,
    request: { mode?: string; meleeStyle?: string } = {},
  ) => {
    const actor = this.entries.find(
      (entry) => entry.kind === 'unit' && entry.actor.id === unitId,
    )?.actor;
    const action = semanticOrder(type, request, actor);
    if (action) {
      this.publish({
        ...this.cues,
        [actorKey('unit', unitId)]: this.cue(action),
      });
    }
  };
  readonly complete = (key: string, id: string) => {
    if (this.cues[key]?.id !== id) {
      return;
    }
    const next = { ...this.cues };
    delete next[key];
    this.publish(next);
  };
  observe(sceneId: string, entries: readonly ActorEntry[], frame?: BattlePresentationFrame | null) {
    let next = this.cues;
    if (sceneId !== this.sceneId) {
      this.sceneId = sceneId;
      this.previous = [];
      next = {};
    }
    this.entries = entries;
    const changes = observedActorTransitions(this.previous, entries);
    this.previous = entries.map(({ key, actor }) => ({
      key,
      actor: {
        hp: actor.hp,
        ...(actor.unconscious !== undefined ? { unconscious: actor.unconscious } : {}),
        ...(actor.knockedDown !== undefined ? { knockedDown: actor.knockedDown } : {}),
        ...(actor.mounted !== undefined ? { mounted: actor.mounted } : {}),
        ...(actor.stance ? { stance: actor.stance } : {}),
        ...(actor.movementMode ? { movementMode: actor.movementMode } : {}),
      },
    }));
    for (const { key, action, extra } of changes) {
      const entry = entries.find((entry) => entry.key === key);
      if (
        ['mount', 'dismount'].includes(action) &&
        frame?.mountComplete &&
        frame.unitId === entry?.actor.id
      ) {
        continue;
      }
      const impact =
        action === 'hit' && entry ? admittedImpactCue(entry, frame, this.now()) : undefined;
      next = { ...next, [key]: this.cue(action, { ...extra, ...impact }) };
    }
    const keys = new Set(entries.map((entry) => entry.key));
    if (Object.keys(next).some((key) => !keys.has(key))) {
      next = Object.fromEntries(Object.entries(next).filter(([key]) => keys.has(key)));
    }
    if (next !== this.cues) {
      this.publish(next);
    }
  }
}
