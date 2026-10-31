'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignArtillery,
} from '../../../packages/game/public/campaign-types.ts';
import { artilleryTradingRules } from '../../../packages/game/artillery-trading-rules.js';
import { artilleryProfile } from '../../../packages/game/artillery-definitions.ts';
import { hasWorkshop } from '../../../packages/game/campaign-headquarters.js';
import {
  artilleryMerchant,
  artilleryBuyingRate,
  artillerySaleOffers,
  artillerySaleQuote,
  artilleryRepurchaseQuote,
} from '../../../packages/game/artillery-trading.js';
const condition = (gun: CampaignArtillery) =>
  `${gun.loaded ? 'Cargada' : gun.reloadProgress ? `Recarga ${Math.floor(gun.reloadProgress * 100)}%` : 'Descargada'} · ${gun.ammo} en reserva`;
export default function ArtilleryTrading({
  state: s,
  dispatch,
  supplied,
}: {
  state: CampaignSnapshot;
  dispatch: (a: CampaignAction) => void;
  supplied: boolean;
}) {
  if (!hasWorkshop(s, s.location)) {
    return null;
  }
  const shop = artilleryMerchant(s),
    offers = artillerySaleOffers(s);
  return (
    <section aria-label="Comercio de artillería">
      <h3>Comercio de piezas</h3>
      <p>
        El taller dispone de {shop.cash} pesos. Paga el{' '}
        {Math.round(artilleryBuyingRate(s) * 100)}% del precio de compra y
        permite recomprar al {artilleryTradingRules(s).resalePercent}%. Cada
        pieza conserva su munición y su recarga.
      </p>
      <h4>Vender al taller</h4>
      {offers.length === 0 && <p>No hay piezas propias disponibles aquí.</p>}
      {offers.map((offer) => {
        const quote = artillerySaleQuote(s, offer, supplied),
          spec = artilleryProfile(s, quote.gun);
        if (!quote.gun || !spec) {
          return null;
        }
        return (
          <div
            key={`${offer.kind}:${offer.kind === 'stock' ? offer.model : offer.artilleryId}`}
            data-artillery-sale={
              offer.kind === 'stock' ? offer.model : offer.artilleryId
            }
          >
            <p>
              {spec.name} ·{' '}
              {offer.kind === 'stock'
                ? `${offer.stockCount} sin emplazar`
                : offer.kind === 'depot'
                  ? 'En depósito'
                  : 'Emplazada'}
              {'ammo' in quote.gun && ` · ${condition(quote.gun)}`}
            </p>
            <button
              className="line-button"
              disabled={!quote.available}
              title={quote.reason || undefined}
              onClick={() => dispatch({ type: 'sellArtillery', ...offer })}
            >
              Vender pieza · {quote.price} pesos
            </button>
            {quote.reason && <small>{quote.reason}</small>}
          </div>
        );
      })}
      <h4>Piezas del taller</h4>
      {shop.guns.length === 0 && <p>No hay piezas usadas en venta.</p>}
      {shop.guns.map((gun) => {
        const quote = artilleryRepurchaseQuote(s, gun.id, supplied);
        return (
          <div key={gun.id} data-artillery-repurchase={gun.id}>
            <p>
              {artilleryProfile(s, gun).name} · {condition(gun)}
            </p>
            <button
              className="line-button"
              disabled={!quote.available}
              title={quote.reason || undefined}
              onClick={() =>
                dispatch({ type: 'repurchaseArtillery', artilleryId: gun.id })
              }
            >
              Recomprar pieza · {quote.price} pesos
            </button>
            {quote.reason && <small>{quote.reason}</small>}
          </div>
        );
      })}
    </section>
  );
}
