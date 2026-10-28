// Mechanical condition is separate from firearm ownership and held-hand layout.
// Callers retain their ordinary firearm/capacity checks; older records default to 100.
export const firearmServiceable = gun => Boolean(gun) && (gun.condition ?? 100) > 0;
export const BROKEN_FIREARM_REASON = 'El arma está rota: reparala o elegí otra.';
