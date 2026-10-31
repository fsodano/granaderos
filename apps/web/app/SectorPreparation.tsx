'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import { useState } from 'react';
import Horses from './Horses';
import OwnedArtillery, { hasOwnedArtillery } from './OwnedArtillery';
import { foundryFor } from '../../../packages/game/campaign-foundry.js';
import { foundryReason } from '../../../packages/game/campaign-roles.js';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { campaignUI, type PreparationOrder } from '../lib/campaign-ui';
export default function SectorPreparation({
  state: s,
  sector,
  dispatch,
  onOpen,
}: {
  state: CampaignSnapshot;
  sector: string;
  dispatch: (a: CampaignAction) => void;
  onOpen?: () => void;
}) {
  const [service, setService] = useState<'horses' | 'artillery' | null>(null);
  const openService = (next: 'horses' | 'artillery') => {
    onOpen?.();
    setService(next);
  };
  const foundry = foundryFor(s),
    blocked =
      Boolean(s.pendingBattle || s.pendingEncounter || s.defeated) ||
      s.sectors[sector]?.owner !== 'patriot';
  const orders: Array<
    | PreparationOrder
    | {
        type: 'foundry' | 'fundArmy';
        kind?: never;
        label: string;
        price: number;
        reason?: string | null;
      }
  > = campaignUI(s).preparationOrders?.(s, sector) ?? [];
  if (sector === foundry.sector) {
    if (!s.flags['foundry']) {
      orders.push({
        type: 'foundry',
        label: `Organizar ${foundry.name}`,
        price: foundry.setupCost,
        reason: foundryReason(s),
      });
    } else if (!s.flags['armyFunded']) {
      orders.push({
        type: 'fundArmy',
        label: `Preparar ${foundry.armyName}`,
        price: foundry.fundingCost,
      });
    }
  }
  const local = sector === s.location && s.sectors[sector]?.owner === 'patriot';
  if (!orders.length && !local) {
    return null;
  }
  return (
    <>
      <details className="sector-preparation">
        <summary>Preparativos del sector</summary>
        {local && (
          <>
            <button
              className="line-button"
              disabled={blocked}
              onClick={() => openService('horses')}
            >
              Caballada
            </button>
            {hasOwnedArtillery(s) && (
              <button
                className="line-button"
                disabled={blocked}
                onClick={() => openService('artillery')}
              >
                Artillería
              </button>
            )}
          </>
        )}
        {orders.map((order) => (
          <button
            key={order.kind ?? order.type}
            className="line-button"
            title={order.reason || undefined}
            disabled={blocked || Boolean(order.reason) || s.resources.treasury < order.price}
            onClick={() =>
              dispatch(
                order.type === 'diplomacy'
                  ? { type: order.type, kind: order.kind }
                  : { type: order.type },
              )
            }
          >
            {order.label} · {order.price} pesos
          </button>
        ))}
      </details>
      {service && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setService(null);
            }
          }}
        >
          <DialogContent className="strategic-local-services" showCloseButton={false}>
            <header>
              <DialogTitle>{service === 'horses' ? 'Caballada' : 'Artillería propia'}</DialogTitle>
              <button
                className="line-button"
                aria-label={service === 'horses' ? 'Cerrar caballada' : 'Cerrar artillería'}
                onClick={() => setService(null)}
              >
                ×
              </button>
            </header>
            <div>
              {service === 'horses' ? (
                <Horses state={s} dispatch={dispatch} />
              ) : (
                <OwnedArtillery state={s} dispatch={dispatch} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
