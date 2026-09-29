import {AMMO_TYPES} from './ammo-types.js';
// Starting allocations are authoring data. Mutable amounts belong to operativeState.
export const DEFAULT_CHARACTER_SUPPLIES=Object.freeze({rations:2,torches:2,medkits:2,boleadoras:1});
export const CHARACTER_SUPPLY_LABELS=Object.freeze({rations:'Raciones',torches:'Antorchas',medkits:'Vendas',boleadoras:'Boleadoras'});
export const CHARACTER_SUPPLY_LIMIT=1000;
export function startingCharacterSupplies(character){const supplies={...DEFAULT_CHARACTER_SUPPLIES,...character.startingSupplies};delete supplies.priming;delete supplies.flints;return supplies;}
export function validStartingSupplies(value){
  const fields=Object.keys(DEFAULT_CHARACTER_SUPPLIES);
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).every(key=>fields.includes(key)||['priming','flints'].includes(key))&&fields.every(k=>Object.hasOwn(value,k))&&Object.values(value).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=CHARACTER_SUPPLY_LIMIT);
}

// Deployment cartridges can move between soldiers without changing authored starting allocations.
export const TRANSFER_SUPPLY_LABELS=Object.freeze({...Object.fromEntries(Object.entries(AMMO_TYPES).map(([key,spec])=>[key,spec.name])),...CHARACTER_SUPPLY_LABELS});

// Presentation only: existing supply keys and quantities remain save-compatible.
export const SUPPLY_PRESENTATION=Object.freeze(Object.fromEntries(Object.entries({
 rations:'Provisión de tasajo y lino. En el juego recupera fuerzas y detiene la hemorragia.',
 torches:'Antorchas para iluminar el entorno.',
 medkits:'Vendas de tela para atender heridas.',
 boleadoras:'Pesos unidos por tientos de cuero para trabar al objetivo.',
}).map(([key,description])=>[key,Object.freeze({art:`/art/supplies/${key}-v1.webp`,description})])));
