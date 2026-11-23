import { fieldCapable } from '../personnel/actor-condition.ts';

export type FieldCombatant = {
  side: string;
  hp: number;
  departure?: unknown;
  fled?: boolean;
  surrendered?: boolean;
};

export type TacticalVictoryBattle = {
  phase?: string;
  enemyTurn?: boolean;
  alliedTurn?: boolean;
  interrupt?: unknown;
  reactionStack?: unknown;
  status?: string;
  mode?: string;
  sectorCleared?: boolean;
  units: readonly FieldCombatant[];
};

// The campaign and tactical controls must accept the same completed field.
export function completedTacticalVictory(
  battle: TacticalVictoryBattle | null | undefined,
): boolean {
  if (
    !battle ||
    battle.phase !== 'player' ||
    battle.enemyTurn ||
    battle.alliedTurn ||
    battle.interrupt ||
    battle.reactionStack
  ) {
    return false;
  }
  const finished =
    battle.status === 'victory' ||
    (battle.status === 'active' && battle.mode === 'exploration' && battle.sectorCleared === true);
  return Boolean(
    finished &&
    battle.units.some((u) => u.side === 'player' && fieldCapable(u)) &&
    !battle.units.some((u) => u.side === 'enemy' && fieldCapable(u)),
  );
}
