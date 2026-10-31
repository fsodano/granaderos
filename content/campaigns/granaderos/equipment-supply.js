// Historical scenario tuning retained for deferred commerce compatibility.
export const WORKSHOP_SECTORS = Object.freeze(['retiro', 'cordoba', 'mendoza']);
export const GRENADE_PRICE = 80;
export const GRENADE_STOCK_CAP = 6;
export const grenadeSupply = Object.freeze({
  sector: 'mendoza',
  price: GRENADE_PRICE,
  capacity: GRENADE_STOCK_CAP,
});
// This authored lot is finite. It is not an attested historical shipment.
export function grenadeSupplyReason(state, isSupplied) {
  return state.phase < 3
    ? 'La remesa de arsenal se habilita durante la campaña de Cuyo.'
    : state.location !== grenadeSupply.sector ||
        state.sectors[grenadeSupply.sector]?.owner !== 'patriot' ||
        !isSupplied(state, grenadeSupply.sector)
      ? 'La remesa requiere la maestranza de Mendoza propia y abastecida.'
      : null;
}
