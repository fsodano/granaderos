// Simulation, content packages and saves retain integer AP units. Four units
// are one displayed PA. Convert only at text and editor boundaries; never round
// a preview or feed a displayed cost back into tactical admission.
export const AP_UNITS_PER_POINT = 4;
export const displayedAP = units => units / AP_UNITS_PER_POINT;
export const storedAP = points => points * AP_UNITS_PER_POINT;
const number = new Intl.NumberFormat('es-AR', {maximumFractionDigits: 6, useGrouping: false});
export const formatAP = units => Number.isFinite(units) ? number.format(displayedAP(units)) : '—';
const fields = new Set(['ap', 'fireAP', 'aimAP', 'reloadAP', 'readyAP', 'stockAP', 'moveAP', 'pivotAP']);
export const isAPField = key => fields.has(key);
