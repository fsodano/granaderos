// Starting allocations are authoring data. Mutable amounts belong to operativeState.
export const DEFAULT_CHARACTER_SUPPLIES=Object.freeze({priming:50,flints:4,rations:2,torches:2,medkits:2,boleadoras:1});
export const CHARACTER_SUPPLY_LIMIT=1000;
export function startingCharacterSupplies(character){return {...DEFAULT_CHARACTER_SUPPLIES,...character.startingSupplies};}
export function validStartingSupplies(value){
  const fields=Object.keys(DEFAULT_CHARACTER_SUPPLIES);
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)&&Number.isSafeInteger(value[k])&&value[k]>=0&&value[k]<=CHARACTER_SUPPLY_LIMIT);
}
