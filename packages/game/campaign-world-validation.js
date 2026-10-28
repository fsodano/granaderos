import { validateWorldData as validateWorldSchema } from '../campaign-format/world-schema.js';
import { validateEnemyStrategyHeadquarters } from './campaign-enemy-strategy.js';

export function validateWorldData(world, options = {}) {
  const errors = validateWorldSchema(world, options);
  if (!errors.length)
    errors.push(...validateEnemyStrategyHeadquarters(world.enemyStrategy, world, options));
  return errors;
}
