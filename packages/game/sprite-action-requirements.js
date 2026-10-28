// Coverage is derived from visible tactical orders, not from available art.
// Every shared appearance, including civilian, must satisfy the same contract.
export const SPRITE_DIRECTIONS_REQUIRED=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
const postures=name=>[name,`crouch-${name}`,`prone-${name}`,`mounted-${name}`];
const movement=['idle','walk','run','crouch-idle','crouch-walk',
 'prone-armed-idle','prone-armed-walk','prone-unarmed-idle','prone-unarmed-walk',
 'mounted-idle','mounted-walk','mounted-run'];
const transitions=['crouch-down','crouch-up','prone-down','prone-up','crouch-to-prone','prone-to-crouch'];

// Shared visual sequences are permitted only where the visible gesture is the
// same. A compound order must display each listed phase, not choose one at random.
export const TACTICAL_ORDER_SPRITES=Object.freeze({
 move:movement,
 movement:transitions,
 stance:transitions,
 fire:['fire','crouch-fire','prone-armed-fire','mounted-fire'],
 reload:['reload','crouch-reload','prone-armed-reload','mounted-reload'],
 reprime:postures('reprime'),
 repair:postures('repair'),
 melee:postures('strike'),
 charge:['run','mounted-run',...postures('strike')],
 overwatch:postures('aim-idle'),
 brace:postures('brace-idle'),
 heal:postures('heal'),
 loot:postures('loot'),
 equipLoot:postures('equip'),
 weapon:postures('equip'),
 door:postures('door'),
 breach:postures('breach'),
 throwTorch:postures('throw-torch'),
 boleadoras:postures('throw-bolas'),
 free:postures('free'),
 ration:postures('use-supplies'),
 mount:['mount','dismount'],
 artillery:['artillery-fire'],
 artilleryReload:['artillery-reload'],
 artilleryMove:['artillery-move'],
 artilleryPivot:['artillery-pivot'],
 // These advance time or resume exploration without a separate body gesture.
 rest:movement,
 explore:movement,
});

export const SPRITE_LIFE_STATES=Object.freeze(['die','dead-idle','collapse','unconscious-breathe','recover']);
export const REQUIRED_SPRITE_SEQUENCES=Object.freeze([...new Set([
 ...movement,...Object.values(TACTICAL_ORDER_SPRITES).flat(),...SPRITE_LIFE_STATES,
])]);

export function requiredSpriteAtlases(appearances){
 return Object.keys(appearances).flatMap(appearance=>REQUIRED_SPRITE_SEQUENCES.map(sequence=>({appearance,sequence,name:`${appearance}-${sequence}`})));
}
