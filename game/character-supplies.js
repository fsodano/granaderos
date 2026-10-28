export {
  CHARACTER_SUPPLY_LIMIT,
  validStartingSupplies,
} from '../campaign-format/character-start-schema.js';
import { AMMO_TYPES } from './ammo-types.js';
// Starting allocations are authoring data. Mutable amounts belong to operativeState.
export const DEFAULT_CHARACTER_SUPPLIES = Object.freeze({
  rations: 2,
  torches: 2,
  medkits: 2,
  boleadoras: 1,
});
export const CHARACTER_SUPPLY_LABELS = Object.freeze({
  rations: 'Raciones',
  torches: 'Antorchas',
  medkits: 'Vendas',
  boleadoras: 'Boleadoras',
});
export function startingCharacterSupplies(character) {
  const supplies = { ...DEFAULT_CHARACTER_SUPPLIES, ...character.startingSupplies };
  delete supplies.priming;
  delete supplies.flints;
  return supplies;
}

// Deployment cartridges can move between soldiers without changing authored starting allocations.
export const TRANSFER_SUPPLY_LABELS = Object.freeze({
  ...Object.fromEntries(Object.entries(AMMO_TYPES).map(([key, spec]) => [key, spec.name])),
  ...CHARACTER_SUPPLY_LABELS,
});

// Presentation only: existing supply keys and quantities remain save-compatible.
export const SUPPLY_PRESENTATION = Object.freeze(
  Object.fromEntries(
    Object.entries({
      rations: 'Provisión de tasajo y lino. En el juego recupera fuerzas y detiene la hemorragia.',
      torches: 'Antorchas para iluminar el entorno.',
      medkits: 'Vendas de tela para atender heridas.',
      boleadoras: 'Pesos unidos por tientos de cuero para trabar al objetivo.',
    }).map(([key, description]) => [
      key,
      Object.freeze({ art: `/art/supplies/${key}-v1.webp`, description }),
    ]),
  ),
);
