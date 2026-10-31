'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import { TRANSPORT_NETWORKS } from '../../../packages/game/transport-network.js';
import { artilleryTransferDelay } from '../../../packages/game/artillery-transport.js';
import { artilleryProfile } from '../../../packages/game/artillery-definitions.ts';
import { campaignPlace } from '../../../packages/game/world-cells.ts';
import './logistics.css';
type Props = {
  state: CampaignSnapshot;
  dispatch: (action: CampaignAction) => void;
};
export default function Logistics({ state: s, dispatch }: Props) {
  const title = (id: string) => campaignPlace(id, s)?.name ?? id;
  const disabled = Boolean(s.defeated || s.pendingBattle || s.pendingEncounter);
  return (
    <section className="logistics-section" aria-labelledby="logistics-title">
      <div className="section-intro">
        <p className="eyebrow">TRANSPORTE Y DEPÓSITOS</p>
        <h2 id="logistics-title">Rutas de campaña</h2>
        <p>
          Organizá el transporte para las escuadras y la artillería. Elegí las
          piezas y su destino desde Sector → Preparativos del sector →
          Artillería.
        </p>
      </div>
      <div className="logistics-routes">
        {TRANSPORT_NETWORKS.map((o) => (
          <article key={o.id}>
            <h3>{o.name}</h3>
            <p>{o.description}</p>
            <small>{o.cost} pesos</small>
            <button
              type="button"
              className="line-button"
              disabled={
                disabled || s.routes[o.id] || s.resources.treasury < o.cost
              }
              onClick={() => dispatch({ type: 'transport', mode: o.id })}
            >
              {s.routes[o.id] ? '✓ Red organizada' : 'Organizar transporte'}
            </button>
          </article>
        ))}
      </div>
      <div className="logistics-convoys">
        <h3>Piezas en camino</h3>
        {!s.artilleryTransfers?.length ? (
          <p className="muted">No hay piezas en tránsito.</p>
        ) : (
          s.artilleryTransfers.map((t) => {
            const reason = artilleryTransferDelay(s, t),
              remaining = Math.max(0, t.dueAt - s.hour);
            return (
              <article key={t.id}>
                <div>
                  <strong>
                    {title(t.from)} → {title(t.to)}
                  </strong>
                  <p>
                    {artilleryProfile(s, t.gun).name} ·{' '}
                    {t.gun.ammo + Number(t.gun.loaded)} disparos ·{' '}
                    {t.mode === 'flotilla' ? 'Flotilla' : 'Carreta'}
                  </p>
                </div>
                <span className={reason ? 'logistics-route-closed' : ''}>
                  {reason || `${remaining} horas restantes`}
                </span>
              </article>
            );
          })
        )}
      </div>
      <div className="logistics-stock">
        <h3>Artillería en depósito</h3>
        {Object.entries(s.artilleryDepots ?? {})
          .filter(([, guns]) => guns.length > 0)
          .map(([id, guns]) => (
            <p key={id}>
              <strong>{title(id)}</strong>:{' '}
              {guns.map((gun) => artilleryProfile(s, gun).name).join(' · ')}
            </p>
          ))}
        {!Object.values(s.artilleryDepots ?? {}).some(
          (guns) => guns.length > 0,
        ) && <p>No hay piezas guardadas en los depósitos.</p>}
      </div>
    </section>
  );
}
