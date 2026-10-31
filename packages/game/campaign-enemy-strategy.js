import { validateEnemyStrategy as validateEnemyStrategySchema } from '../campaign-format/enemy-strategy-schema.js';

export function validateEnemyStrategyHeadquarters(
  value,
  world,
  { headquarters = world?.defaultHeadquarters } = {},
) {
  const errors = [];
  for (const [theater, policy] of Object.entries(value?.theaters ?? {})) {
    if (Array.isArray(policy?.axis) && policy.axis.includes(headquarters)) {
      errors.push(
        `Estrategia enemiga: world.enemyStrategy.theaters.${theater}.axis: no puede incluir el cuartel general ${headquarters}.`,
      );
    }
  }
  return errors;
}

export function validateEnemyStrategy(value, world, options = {}) {
  return [
    ...validateEnemyStrategySchema(value, world),
    ...validateEnemyStrategyHeadquarters(value, world, options),
  ];
}

export const enemyStrategiesFor = (world) => world?.enemyStrategy?.theaters ?? {};
export function authoredEnemyGroupPlan(world, theater, target) {
  const axis = enemyStrategiesFor(world)[theater]?.axis ?? [],
    index = axis.indexOf(target);
  return {
    command: 'opposition',
    origin: 'off-map',
    route: index < 0 ? [] : axis.slice(0, index + 1),
  };
}
export function authoredEnemyRaid(
  s,
  world,
  theater,
  forcedTarget,
  { headquarters, launchEnemyGroup, note },
) {
  const policy = enemyStrategiesFor(world)[theater];
  if (!policy || s.completed || s.defeated) {
    return null;
  }
  const target =
    forcedTarget ??
    policy.axis.find((id) => id !== headquarters && s.sectors[id]?.owner === 'patriot');
  if (!target || target === headquarters || !policy.axis.includes(target)) {
    return null;
  }
  const group = launchEnemyGroup(s, theater, target);
  if (group) {
    note(s, 'Un grupo enemigo inicia su avance por el territorio.');
  }
  return group;
}
export function authoredEnemyHourlyEvents(s, world, context) {
  for (const [theater, policy] of Object.entries(enemyStrategiesFor(world)).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (s.hour > 0 && s.hour % policy.raidEveryHours === 0)
      {authoredEnemyRaid(s, world, theater, null, context);}
  }
}
