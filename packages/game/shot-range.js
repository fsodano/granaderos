export { shotRangeModifiers } from './domain/combat/shot-range.ts';
export function shotRangeText(profile) {
  const n = (value) => Number(value.toFixed(1));
  return `Distancia: ${n(profile.distance)} casillas · alcance del arma: ${n(profile.weaponRange)}.${profile.beyondWeapon ? ` Fuera del alcance eficaz: probabilidad al ${Math.round((profile.weaponChanceFactor ?? 0.5) * 100)}%.` : ''}${profile.beyondSight ? ` Visión difícil: probabilidad al ${Math.round((profile.sightChanceFactor ?? 0.5) * 100)}%.` : ''}`;
}
