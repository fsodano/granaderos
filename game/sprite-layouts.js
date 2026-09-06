// Logical pixel dimensions of the offline renders. Keep body scale at 20 px/m.
// Padding changes for long weapons, prone bodies, and horses, not body scale.
export const SPRITE_DIRECTIONS=['n','ne','e','se','s','sw','w','nw'];
export const SPRITE_FPS=10;
export const SPRITE_FRAMES=8;
export function spriteLayout(name){
 if(name.startsWith('cavalry-'))return {cell:76,anchor:[38,63]};
 if(/-(prone|dead|unconscious)-/.test(name))return {cell:80,anchor:[40,47]};
 if(/-(fire|reload|strike)$/.test(name))return {cell:70,anchor:[35,62]};
 return {cell:52,anchor:[26,46]};
}
