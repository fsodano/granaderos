// Exploration changes the screen state after victory, not who holds the field.
// Unconscious enemies still contest the sector, just as in tactical checkEnd.
export function completedTacticalVictory(battle){
 return Boolean(battle&&(battle.status==='victory'||battle.status==='active'&&battle.mode==='exploration'&&battle.sectorCleared===true)
  &&battle.units.some(u=>u.side==='player'&&u.hp>0&&!u.routed)
  &&!battle.units.some(u=>u.side==='enemy'&&u.hp>0&&!u.routed));
}
