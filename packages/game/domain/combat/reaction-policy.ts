export const ReactionRules = Object.freeze({
  MinimumActionPoints: 3,
  WisdomWeight: 0.25,
  ExperienceWeight: 10,
  ShockWeight: 2,
  RunningPenalty: 10,
  TacticalCommandBonus: 25,
  StrategicCommandBonus: 50,
  NormalRange: 8,
  TacticalCommandRange: 10,
  StrategicCommandRange: 12,
});
export type ReactionInitiative = Readonly<{
  agility: number;
  wisdom: number;
  experience: number;
  shock: number;
  running: boolean;
  tacticalCommand: boolean;
  strategicCommand: boolean;
}>;
export type ReactionObserver = Readonly<{
  characterId: string;
  capable: boolean;
  knockedDown: boolean;
  alreadyReacted: boolean;
  actionPoints: number;
  overwatchEnabled: boolean;
  playerControlled: boolean;
  initiative: number;
  seesActor: boolean;
  sawActorBefore: boolean;
  newSound: boolean;
  distance: number;
  tacticalCommand: boolean;
  strategicCommand: boolean;
}>;
export class ReactionPolicy {
  initiative(context: ReactionInitiative): number {
    const rules = ReactionRules;
    return (
      context.agility +
      context.wisdom * rules.WisdomWeight +
      context.experience * rules.ExperienceWeight -
      context.shock * rules.ShockWeight -
      (context.running ? rules.RunningPenalty : 0) +
      (context.tacticalCommand ? rules.TacticalCommandBonus : 0) +
      (context.strategicCommand ? rules.StrategicCommandBonus : 0)
    );
  }
  qualifiedObservers(
    observers: readonly ReactionObserver[],
    trigger: { initiative: number; moved: boolean },
  ): readonly string[] {
    return observers
      .filter((observer) => {
        if (
          !observer.capable ||
          observer.knockedDown ||
          observer.alreadyReacted ||
          observer.actionPoints < ReactionRules.MinimumActionPoints ||
          (!observer.playerControlled && !observer.overwatchEnabled) ||
          observer.initiative < trigger.initiative
        )
          return false;
        const range = observer.strategicCommand
          ? ReactionRules.StrategicCommandRange
          : observer.tacticalCommand
            ? ReactionRules.TacticalCommandRange
            : ReactionRules.NormalRange;
        return (
          (observer.seesActor &&
            (!observer.sawActorBefore || trigger.moved) &&
            observer.distance <= range) ||
          observer.newSound
        );
      })
      .sort(
        (first, second) =>
          second.initiative - first.initiative ||
          first.characterId.localeCompare(second.characterId),
      )
      .map((observer) => observer.characterId);
  }
}
