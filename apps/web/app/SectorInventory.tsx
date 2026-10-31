'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignInventoryOrder,
  CampaignEquipmentSlot,
} from '../../../packages/game/public/campaign-types.ts';
import type {
  CarriedEquipment,
  PrepareCarriedHand,
} from '../../../packages/game/public/sector-inventory-types.ts';
import { useId, useState } from 'react';
import CampaignPockets from './CampaignPockets';
import { rosterFor } from '../../../packages/game/campaign.js';
import {
  sectorInventoryModel,
  sectorInventorySites,
  sectorPickupReason,
} from '../../../packages/game/sector-inventory.js';
import { tacticalGridLabel } from '../../../packages/game/tactical-grid.js';
import { repairMaterialPoints } from '../../../packages/game/repair-materials.js';
import './sector-inventory.css';

export default function SectorInventory({
  state,
  sectorId,
  dispatch,
}: {
  state: CampaignSnapshot;
  sectorId: string;
  dispatch: (action: CampaignAction) => void;
}) {
  const [selected, setSelected] = useState('');
  const [selectedSite, setSelectedSite] = useState(sectorId);
  const sites = sectorInventorySites(state, sectorId),
    siteId = sites.some((site) => site.id === selectedSite)
      ? selectedSite
      : sectorId;
  const cursorOwner = Object.entries(state.operativeState ?? {}).find(
    ([, record]) => record.equipmentCursor,
  )?.[0];
  const model = sectorInventoryModel(
    state,
    siteId,
    rosterFor(state),
    selected || cursorOwner || '',
  );
  const order = (action: CampaignInventoryOrder): void => {
    if (model.operativeId === null) {
      return;
    }
    dispatch({
      type: 'sectorInventory',
      sector: siteId,
      operativeId: model.operativeId,
      ...action,
    });
  };
  return (
    <section className="sector-inventory" aria-label="Equipo del sector">
      <header>
        <div>
          <h3>Equipo del sector</h3>
          <p>
            Elegí un combatiente presente para preparar lo que lleva en las
            manos y equipar su vestimenta. En un sector reconocido y seguro
            también puede recoger o dejar objetos para otro combatiente.
          </p>
        </div>
        <label>
          Combatiente
          <select
            aria-label="Combatiente para el equipo del sector"
            disabled={Boolean(model.personal?.equipmentCursor)}
            value={model.operativeId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            {!model.candidates.length && (
              <option value="">Sin combatientes presentes</option>
            )}
            {model.candidates.map((op) => (
              <option value={op.id} key={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {sites.length > 1 && (
        <label>
          Lugar
          <select
            aria-label="Lugar del equipo"
            disabled={Boolean(model.personal?.equipmentCursor)}
            value={siteId}
            onChange={(event) => setSelectedSite(event.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} · {site.count} objetos
                {site.repairPoints > 0 &&
                  ` · ${site.repairPoints} puntos de reparación`}
              </option>
            ))}
          </select>
        </label>
      )}
      {model.usage && (
        <p>
          Mochila: {model.usage.used}/{model.usage.capacity} espacios. Las
          cargas permanecen en el arma; los cartuchos sueltos se usan en el
          próximo despliegue.
        </p>
      )}
      {model.personal && (
        <p aria-label="Materiales de reparación del combatiente">
          Materiales de reparación: {repairMaterialPoints(model.personal)}{' '}
          puntos
        </p>
      )}
      {model.personal && (
        <CampaignPockets
          key={`${siteId}:${model.operativeId}`}
          unit={model.personal}
          disabled={Boolean(model.carriedReason)}
          onOrder={(action) => order(action)}
        />
      )}
      <div className="sector-inventory-columns">
        <section aria-label="Equipo descubierto">
          <h4>En el terreno</h4>
          {model.reason && (
            <p>
              <output>{model.reason}</output>
            </p>
          )}
          {model.entries.length ? (
            model.entries.map((row, index: number) => (
              <ItemRow
                key={`${siteId}:${row.key}:${row.expected}`}
                label={row.label}
                count={row.count}
                number={index + 1}
                disabled={!row.reachable}
                verb="Recoger"
                quantityReason={(count) =>
                  sectorPickupReason(model.personal, row, count)
                }
                onConfirm={(count: number) =>
                  order({
                    direction: 'take',
                    sourceKey: row.key,
                    expected: row.expected,
                    count,
                  })
                }
              >
                {row.operativeName && <p>Devuelto por {row.operativeName}</p>}
                <p>
                  {inventoryLocation(row)} ·{' '}
                  {row.condition !== undefined && `Estado ${row.condition}%. `}
                  {row.loaded !== undefined && `${row.loaded} carga(s). `}
                  {row.jammed && 'Necesita cebado. '}
                  {row.reason}
                </p>
              </ItemRow>
            ))
          ) : (
            <p>No hay equipo descubierto en este sector.</p>
          )}
          {model.repairReserves.length > 0 && (
            <section aria-label="Materiales de reparación">
              <h4>Materiales de reparación</h4>
              {model.repairReserves.map(
                (row: RepairReserveRow, index: number) => (
                  <RepairReserve
                    key={`${siteId}:${row.key}:${row.expected}`}
                    row={row}
                    number={index + 1}
                    onConfirm={(count) =>
                      order({
                        direction: 'takeRepairPoints',
                        sourceKey: row.key,
                        expected: row.expected,
                        count,
                      })
                    }
                  />
                ),
              )}
            </section>
          )}
        </section>
        <section aria-label="Equipo llevado">
          <h4>Con el combatiente</h4>
          {model.carriedReason && model.carriedReason !== model.reason && (
            <p>
              <output>{model.carriedReason}</output>
            </p>
          )}
          {model.carried.length ? (
            model.carried.map((row, index: number) => (
              <ItemRow
                key={`${row.item}:${row.count}`}
                label={row.label}
                count={row.count}
                number={index + 1}
                disabled={Boolean(model.reason)}
                verb="Dejar"
                onConfirm={(count: number) =>
                  order({ direction: 'drop', item: row.item, count })
                }
              >
                <EquipCarriedItem
                  row={row}
                  onEquip={(slot: CampaignEquipmentSlot) => {
                    if (
                      row.inventoryKey === undefined ||
                      row.expected === undefined
                    ) {
                      return;
                    }
                    order({
                      direction: 'equip',
                      inventoryKey: row.inventoryKey,
                      expected: row.expected,
                      slot,
                    });
                  }}
                />
                <PrepareCarriedHands
                  row={row}
                  onPrepare={(action) =>
                    order({ direction: 'equip', ...action })
                  }
                />
              </ItemRow>
            ))
          ) : (
            <p>No hay equipo disponible.</p>
          )}
        </section>
      </div>
    </section>
  );
}
function inventoryLocation(row: { x?: number; y?: number }) {
  return row.x !== undefined && row.y !== undefined
    ? tacticalGridLabel(row.x, row.y)
    : 'Lugar por reconocer';
}
function ItemRow({
  label,
  count,
  maximum = count,
  number,
  disabled,
  verb,
  quantityReason,
  onConfirm,
  children,
}: {
  label: string;
  count: number;
  maximum?: number;
  number: number;
  disabled: boolean;
  verb: string;
  quantityReason?: (count: number) => string | null;
  onConfirm: (count: number) => void;
  children?: React.ReactNode;
}) {
  const [quantity, setQuantity] = useState(1),
    reasonId = useId();
  const valid =
    Number.isSafeInteger(quantity) && quantity > 0 && quantity <= maximum;
  const reason = !disabled ? quantityReason?.(quantity) : null;
  return (
    <div className="sector-inventory-row">
      <div>
        <strong>
          {label} · {count}
        </strong>
        {children}
        {reason && (
          <p id={reasonId}>
            <output>{reason}</output>
          </p>
        )}
      </div>
      <label>
        Cantidad
        <input
          type="number"
          min="1"
          max={maximum}
          step="1"
          value={quantity}
          disabled={disabled}
          aria-label={`${verb} ${number}: cantidad de ${label}`}
          aria-describedby={reason ? reasonId : undefined}
          aria-invalid={reason ? true : undefined}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      <button
        className="line-button"
        disabled={disabled || !valid || Boolean(reason)}
        aria-label={`${verb} ${number}: ${label}`}
        aria-describedby={reason ? reasonId : undefined}
        onClick={() => onConfirm(quantity)}
      >
        {verb}
      </button>
    </div>
  );
}

type RepairReserveRow = {
  key: string;
  label: string;
  repairPoints: number;
  capacity: number;
  expected: string;
  reachable: boolean;
  reason?: string | null;
  x?: number;
  y?: number;
  operativeName?: string;
};
export function RepairReserve({
  row,
  number,
  onConfirm,
}: {
  row: RepairReserveRow;
  number: number;
  onConfirm: (count: number) => void;
}) {
  const full = row.capacity <= 0;
  return (
    <ItemRow
      label={row.label}
      count={row.repairPoints}
      maximum={Math.min(row.repairPoints, row.capacity)}
      number={number}
      disabled={!row.reachable || full}
      verb="Retirar"
      onConfirm={onConfirm}
    >
      {row.operativeName && <p>Devuelto por {row.operativeName}</p>}
      <p>
        {inventoryLocation(row)} ·{' '}
        {row.reason ??
          (full
            ? 'El combatiente no puede llevar más materiales de reparación.'
            : `${row.repairPoints} puntos disponibles para reparar equipo.`)}
      </p>
    </ItemRow>
  );
}

export function EquipCarriedItem({
  row,
  onEquip,
}: {
  row: CarriedEquipment;
  onEquip: (slot: CampaignEquipmentSlot) => void;
}) {
  const slotLabel = (slot: string) =>
    slot === 'headwear'
      ? 'cabeza'
      : slot === 'legwear'
        ? 'piernas'
        : slot === 'outfit'
          ? 'torso'
          : slot === 'primary'
            ? 'principal'
            : slot === 'offhand'
              ? 'segunda mano'
              : 'secundaria';
  return (
    <>
      {row.loaded === undefined && row.condition !== undefined && (
        <p>
          Estado {row.condition}%
          {['headwear', 'outfit', 'legwear'].includes(row.item) &&
            ' · Vestimenta puesta'}
        </p>
      )}
      {row.loaded !== undefined && (
        <p>
          {row.loaded} carga(s)
          {row.condition !== undefined && ` · Estado ${row.condition}%`}
          {row.reloadProgress &&
            ` · Recarga ${Math.round(row.reloadProgress * 100)}%`}
          {row.jammed && ' · Necesita cebado'}
        </p>
      )}
      {row.equip && (
        <fieldset
          style={{ border: 0, margin: 0, padding: 0 }}
          className="sector-equip"
          aria-label={`Equipar ${row.label}`}
        >
          {row.equip.map((option) => (
            <div key={option.slot}>
              <button
                type="button"
                className="line-button"
                disabled={!option.valid}
                onClick={() => onEquip(option.slot)}
                aria-label={
                  option.label
                    ? `${option.label}: ${row.label}`
                    : `Equipar ${row.label}: ${slotLabel(option.slot)}`
                }
              >
                {option.label ?? `Equipar ${slotLabel(option.slot)}`}
              </button>
              {option.reason && <small>{option.reason}</small>}
            </div>
          ))}
        </fieldset>
      )}
    </>
  );
}

export function PrepareCarriedHands({
  row,
  onPrepare,
}: {
  row: CarriedEquipment;
  onPrepare: (action: PrepareCarriedHand['action']) => void;
}) {
  return (
    <>
      {[row.mainhand, row.offhand]
        .filter((option) => option !== undefined)
        .map((option) => (
          <div key={option.action.slot}>
            <button
              type="button"
              className="line-button"
              disabled={!option.valid}
              title={option.reason || undefined}
              aria-label={`${option.label}: ${row.label}`}
              onClick={() => onPrepare(option.action)}
            >
              {option.label}
            </button>
            {option.reason && <small>{option.reason}</small>}
          </div>
        ))}
    </>
  );
}
