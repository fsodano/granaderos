import {cautiousCombatOrder} from './cautious-driver.mjs';

// Paid infantry use the current observed-state fire, cover, aid and reload
// policy. A useful prone shot pays its setup; reloading still uses the real
// available stance/AP. Do not force every actor toward a different roof or
// keep a loaded rifleman upright solely to preserve an old reload pattern.
export function hiredAssaultOrder(battle,unit){
 return cautiousCombatOrder(battle,unit);
}
