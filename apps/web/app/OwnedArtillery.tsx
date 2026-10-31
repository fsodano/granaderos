'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignArtillery,
} from '../../../packages/game/public/campaign-types.ts';
import { useState } from 'react';
import { stationedArtillery } from '../../../packages/game/campaign-artillery.js';
import {
  artilleryDeploymentChoices,
  artillerySelectionReason,
} from '../../../packages/game/equipment.js';
import { artilleryProfile } from '../../../packages/game/artillery-definitions.ts';
import { localArtilleryDepot, depotSelection } from '../../../packages/game/artillery-depots.ts';
import { ArtilleryStorage, SendArtillery } from './ArtilleryTransport';
import { finiteArsenalHint } from '../../../packages/game/finite-artillery-arsenals.js';
import { artilleryStorageQuote } from '../../../packages/game/artillery-transport.js';
import './owned-artillery.css';

export function hasOwnedArtillery(state: CampaignSnapshot) {
  return (
    Boolean(finiteArsenalHint(state)) ||
    ['bronze4', 'field8', 'swivel'].some((type) => (state.armory?.[type] ?? 0) > 0) ||
    localArtilleryDepot(state).length > 0 ||
    stationedArtillery(state).some(({ gun }) => gun.side === 'player') ||
    (state.artilleryTransfers?.length ?? 0) > 0
  );
}

export default function OwnedArtillery({
  state: s,
  dispatch,
}: {
  state: CampaignSnapshot;
  dispatch: (action: CampaignAction) => void;
}) {
  const [selection, setSelection] = useState<string[] | null>(null);
  const stored = localArtilleryDepot(s),
    field = stationedArtillery(s).filter(({ gun }) => gun.side === 'player');
  const stock = ['bronze4', 'field8', 'swivel'].filter((type) => (s.armory?.[type] ?? 0) > 0);
  const available = new Set([...stock, ...stored.map(depotSelection)]);
  const choices = (selection ?? artilleryDeploymentChoices(s)).map((choice: string) =>
    available.has(choice) ? choice : '',
  );
  const reason = artillerySelectionReason(s, choices.filter(Boolean));
  const blocked =
    Boolean(s.pendingBattle || s.pendingEncounter || s.defeated) ||
    s.sectors[s.location]?.owner !== 'patriot';
  const load = (gun: CampaignArtillery) =>
    `${gun.loaded ? 'Cargada' : gun.reloadProgress ? `Recarga ${Math.floor(gun.reloadProgress * 100)}%` : 'Descargada'} · ${gun.ammo} en reserva`;
  return (
    <section className="owned-artillery" aria-label="Artillería propia">
      <h3>Batería de campaña</h3>
      <p>
        Elegí hasta tres piezas propias para el próximo ataque. Cada pieza del depósito conserva su
        carga y munición.
      </p>
      {finiteArsenalHint(s) && (
        <p>
          <output>{finiteArsenalHint(s)}</output>
        </p>
      )}
      <div className="owned-artillery-selection">
        {[0, 1, 2].map((index) => (
          <label key={index}>
            Pieza {index + 1}
            <select
              aria-label={`Pieza propia ${index + 1}`}
              value={choices[index] ?? ''}
              disabled={blocked}
              onChange={(event) => {
                const next = [...choices];
                next[index] = event.target.value;
                setSelection(next);
              }}
            >
              <option value="">Sin pieza</option>
              {stock.map((type) => (
                <option key={type} value={type}>
                  {artilleryProfile(s, type).name} · {s.armory[type]} disponibles
                </option>
              ))}
              {stored.map((gun) => (
                <option key={gun.id} value={depotSelection(gun)}>
                  {artilleryProfile(s, gun).name} · {load(gun)} · {gun.id}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        className="line-button"
        disabled={blocked || Boolean(reason)}
        title={reason || undefined}
        onClick={() => {
          dispatch({
            type: 'configureArtillery',
            types: choices.filter(Boolean),
          });
          setSelection(null);
        }}
      >
        Preparar batería
      </button>
      {reason && (
        <p>
          <output>{reason}</output>
        </p>
      )}
      {field.length > 0 && (
        <section aria-label="Artillería emplazada">
          <h3>Piezas emplazadas</h3>
          <p>
            Permanecen en este sector al salir. Guardalas en el depósito local para elegirlas en la
            batería. Cada pieza conserva su carga, munición y trabajo de recarga.
          </p>
          {field.map(({ sector, gun }) => {
            const quote = artilleryStorageQuote(s, sector, gun.id);
            return (
              <div key={`${sector}:${gun.id}`} data-artillery-id={gun.id}>
                <p>
                  {artilleryProfile(s, gun).name} · {load(gun)}
                </p>
                <button
                  className="line-button"
                  disabled={!quote.available}
                  title={quote.reason || undefined}
                  onClick={() =>
                    dispatch({
                      type: 'storeArtillery',
                      sector,
                      artilleryId: gun.id,
                    })
                  }
                >
                  Guardar pieza
                </button>
                <SendArtillery state={s} sector={sector} gun={gun} dispatch={dispatch} />
              </div>
            );
          })}
        </section>
      )}
      <ArtilleryStorage state={s} dispatch={dispatch} />
    </section>
  );
}
