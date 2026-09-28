// Authored condition is assigned once. Saves retain the mutable physical state.
export function startingCharacterCondition(character){
  return {hp:character.attributes.maxHp,energy:100,fatigue:0,bleeding:0,bandaged:0,...character.startingCondition};
}
export function validStartingCondition(value,maxHp){
  const bounds={hp:[1,maxHp],energy:[0,100],fatigue:[0,100],bleeding:[0,10],bandaged:[0,maxHp]};
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===Object.keys(bounds).length&&
    Object.entries(bounds).every(([key,[min,max]])=>Object.hasOwn(value,key)&&Number.isSafeInteger(value[key])&&value[key]>=min&&value[key]<=max)&&
    value.bandaged<=maxHp-value.hp&&
    (value.bleeding===0||value.hp<maxHp&&value.bandaged<maxHp-value.hp);
}
