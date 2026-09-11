// Held consumables use the same targeting command as weapons and field dressings.
// Costs and ranges are Granaderos tuning on the 100 AP scale.
export const HELD_SUPPLIES = Object.freeze({
  torches: Object.freeze({key:'torches',name:'Antorcha',action:'throwTorch',cost:10,range:8}),
  boleadoras: Object.freeze({key:'boleadoras',name:'Boleadoras',action:'boleadoras',cost:12,range:8}),
  rations: Object.freeze({key:'rations',name:'Ración de tasajo',action:'ration',cost:10,range:0}),
});

export function heldSupply(unit) {
  if(unit?.activeSlot!=='supply'||!Object.hasOwn(HELD_SUPPLIES,unit.activeSupply))return null;
  const count=unit[unit.activeSupply];
  return Number.isInteger(count)&&count>0?{...HELD_SUPPLIES[unit.activeSupply],count}:null;
}

export function clearEmptySupply(unit) {
  if(unit.activeSlot==='supply'&&!heldSupply(unit)){unit.activeSlot='unarmed';delete unit.activeSupply;}
  return unit;
}
