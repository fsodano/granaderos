// Named capabilities belong to the character definition. Numeric slots remain
// only as a compatibility fallback for campaigns created before authoring.
export const CHARACTER_ABILITIES = [
 ['mud_rider','Jinete de terrenos blandos','Reduce la penalización al montar sobre barro.'],
 ['militia_command','Mando de milicias','Sostiene la moral de milicianos cercanos.'],
 ['loading_support','Ayuda de carga','Acelera la recarga de armas y piezas cercanas.'],
 ['counterattack','Contragolpe','Puede responder a un ataque cercano con otras armas blancas.'],
 ['bodyguard','Protección de compañeros','Puede interceptar disparos dirigidos a un mando cercano.'],
 ['quick_shot','Disparo rápido','Reduce el coste de disparar tercerolas y pistolas.'],
 ['quick_movement','Paso ligero','Reduce el coste del movimiento a pie.'],
 ['artillery_fire','Tiro de artillería','Reduce el coste de disparar una pieza y aumenta el daño de la metralla.'],
 ['breaching','Apertura de brechas','Reduce el coste de abrir una brecha a mano.'],
 ['night_scout','Exploración nocturna','Mejora la visión nocturna y reduce la penalización de puntería en la oscuridad.'],
 ['scatter_concealment','Tiro entre cobertura','Reduce la ocultación del blanco al usar un trabuco.'],
 ['artillery_loading','Carga de artillería','Mejora la recarga y la penetración de las piezas.'],
 ['foot_morale','Mando de infantería','Sostiene la moral de combatientes cercanos a pie.'],
 ['mounted_intimidation','Intimidación montada','Una carga montada puede amedrentar a enemigos cercanos.'],
 ['rapid_first_aid','Atención rápida','Reduce el coste de la atención médica.'],
 ['care_composure','Serenidad al cuidar','Al tratar una herida de otra persona a la vista, reduce hasta 2 puntos de tensión. Usa los PA y las vendas habituales. No se aplica al tratarse a sí mismo.'],
 ['nervous_isolation','Temor al aislamiento','Con moral menor que 50 y sin un compañero militar capaz a cuatro casillas en la misma superficie, suma hasta 2 puntos de tensión al iniciar cada turno de combate. La recuperación habitual ocurre primero. Reunirse con compañeros evita nuevas subidas; no devuelve la tensión existente.'],
 ['civilian_conscience','Objeción por daño a civiles','Si ve directamente una orden intencional matar a un civil no combatiente, protesta y rechaza nuevos contratos. Cumple el plazo ya pagado.'],
 ['tactical_command','Mando táctico','Mejora puntería, iniciativa y reacción de compañeros cercanos.'],
 ['strategic_command','Gran mando','Mejora puntería, iniciativa, reacción y moral de compañeros cercanos.'],
 ['protected_commander','Mando protegido','Puede recibir la protección de un compañero sin exigir 90 puntos de liderazgo.'],
 ['mounted_charge','Carga precisa','Aumenta el daño de una carga montada.'],
].map(([id,name,description])=>Object.freeze({id,name,description,...(id==='civilian_conscience'?{contractOnly:true}:{})}));
const legacy={0:['mud_rider'],1:['militia_command'],2:['loading_support'],3:['counterattack','bodyguard'],4:['quick_shot','quick_movement'],5:['artillery_fire'],6:['breaching','night_scout','scatter_concealment'],7:['artillery_loading','foot_morale'],9:['mounted_intimidation'],10:['rapid_first_aid'],11:['tactical_command'],57:['strategic_command','protected_commander','mounted_charge']};
export const legacyCharacterAbilities=id=>[...(legacy[Number(id)]??[])];
export function hasCharacterAbility(unit,ability){return (unit.abilities??legacy[Number(unit.id)]??[]).includes(ability);}
export function validCharacterAbilities(value){return Array.isArray(value)&&value.length<=CHARACTER_ABILITIES.length&&new Set(value).size===value.length&&value.every(id=>CHARACTER_ABILITIES.some(a=>a.id===id));}
