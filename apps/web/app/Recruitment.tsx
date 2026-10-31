'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import { sitePath } from '../lib/site-path.js';
import { useState } from 'react';
import {
  CAMPAIGN_SECTORS,
  rosterFor,
  contractQuote,
  contractStatus,
  civicStatus,
} from '../../../packages/game/campaign.js';
import {
  hiringArrivalOptions,
  hiringArrivalReason,
  pendingHire,
  hireCancellationReason,
} from '../../../packages/game/hiring-arrivals.js';
import {
  guaranteeRecord,
  serviceGuaranteeRefund,
  guaranteeDepartureReason,
} from '../../../packages/game/service-guarantees.js';
import { operativeInTransit, squadReorganizationReason } from '../../../packages/game/squads.js';
import { contractTermsFor, contractRenewalQuote } from '../../../packages/game/contracts.js';
import { GetRecruitmentCandidatesUseCase } from '../../../packages/game/application/personnel/get-recruitment-candidates/get-recruitment-candidates.use-case.ts';
import { CampaignGetRecruitmentCandidatesRepository } from '../../../packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js';
import { isContractOperative } from '../../../packages/game/content-character-ids.ts';
import {
  characterProfile,
  characterAbilityDescriptions,
} from '../../../packages/game/characters.js';
import { portraitFor } from '../lib/portraits';
import { travelTime } from '../lib/travel-time';
import CharacterDossier from './CharacterDossier';
import ServiceRefusalNotice from './ServiceRefusalNotice';
import PreferredCompanionsSummary from './PreferredCompanionsSummary';
import { serviceObjectionReason } from '../../../packages/game/service-objections.js';
import ServiceObjectionNotice from './ServiceObjectionNotice';
import { lowMoraleRenewalStatus } from '../../../packages/game/morale-renewal.js';
import ContractMoraleNotice from './ContractMoraleNotice';
import './recruitment.css';
type Props = { state: CampaignSnapshot; dispatch: (a: CampaignAction) => void };
export default function Recruitment({ state: s, dispatch }: Props) {
  const [selected, setSelected] = useState<number | null>(null),
    [periods, setPeriods] = useState<Record<number, string>>({});
  const [query, setQuery] = useState(''),
    [specialty, setSpecialty] = useState('all'),
    [availability, setAvailability] = useState('all'),
    [sort, setSort] = useState('name');
  const [chosenDestination, setDestination] = useState('');
  const terms = Object.entries(contractTermsFor(s))
    .filter(([id]) => ['day', 'week', 'fortnight'].includes(id))
    .map(([id, period]) => [id, period.name]);
  const roster = rosterFor(s).filter((o) => isContractOperative(s, o));
  const serving = roster.filter((o) => {
    const r = s.operativeState[o.id];
    return s.recruited.includes(o.id) && r?.alive && r.hp > 0 && !r.captured;
  }).length;
  const options = hiringArrivalOptions(s);
  const destination = options.some((o) => o.id === chosenDestination)
    ? chosenDestination
    : (options.find((o) => o.id === s.location)?.id ?? options[0]?.id ?? '');
  const candidates = new GetRecruitmentCandidatesUseCase(
    new CampaignGetRecruitmentCandidatesRepository(s, roster),
  ).execute({
    query,
    specialty,
    availability,
    sort,
  });
  const visible = candidates.characterIds.flatMap((id) => {
    const candidate = roster.find((character) => String(character.id) === id);
    return candidate ? [candidate] : [];
  });
  const selectedOperative = roster.find((o) => o.id === selected);
  const selectedRecord = selected === null ? undefined : s.operativeState[selected];
  const busy = Boolean(s.pendingBattle || s.pendingEncounter) || s.defeated;
  const hiringRouteReason = squadReorganizationReason(s);
  return (
    <section className="roster-section">
      <p>
        El servicio comienza al reclutar. El combatiente queda disponible de inmediato en el lugar
        elegido.
      </p>
      <label className="arrival-destination">
        Lugar de incorporación
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={!options.length || busy}
        >
          {!options.length && <option value="">No hay destinos disponibles</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.infrastructure}
            </option>
          ))}
        </select>
      </label>
      <p className="catalogue-count">
        El destino debe estar bajo tu control y tener una posta, un cuartel, un puerto o un
        embarcadero habilitado. Un bloqueo impide la llegada por agua.
      </p>
      {!options.length && (
        <p>
          <output>
            No hay un punto seguro para recibir contratados. Podés renovar los contratos vigentes.
          </output>
        </p>
      )}
      <div className="catalogue-tools">
        <label>
          Buscar combatiente
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, apodo u oficio"
          />
        </label>
        <label>
          Especialidad
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            {[
              ['all', 'Todas'],
              ['marksman', 'Tiro · 70+'],
              ['medic', 'Medicina · 70+'],
              ['mechanic', 'Mecánica · 70+'],
              ['artillery', 'Artillería · 70+'],
              ['leader', 'Liderazgo · 70+'],
              ['scout', 'Exploración'],
              ['rider', 'Caballería'],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="all">Todos</option>
            <option value="available">Disponibles para reclutar</option>
            <option value="unavailable">No disponibles para reclutar</option>
            <option value="pending">Pago pendiente de incorporación</option>
            <option value="hired">En tus filas</option>
            <option value="fallen">Caídos</option>
          </select>
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Nombre</option>
            <option value="price">Menor paga diaria</option>
            <option value="marksmanship">Mayor puntería</option>
            <option value="medical">Mayor medicina</option>
          </select>
        </label>
      </div>
      <p className="catalogue-count">
        <output>
          {visible.length} de {roster.length} combatientes · {serving} en tus filas ·{' '}
          {(s.hiringArrivals ?? []).length} pendientes de incorporación
        </output>
      </p>
      {!visible.length && (
        <p className="catalogue-empty">
          No hay combatientes con estos filtros.{' '}
          <button
            className="dossier-link"
            onClick={() => {
              setQuery('');
              setSpecialty('all');
              setAvailability('all');
            }}
          >
            Mostrar todos
          </button>
        </p>
      )}
      <div className="recruit-catalogue">
        {visible.map((o) => {
          const portrait = portraitFor(o.portrait ?? o.portraitId ?? o.id, s);
          const hired = s.recruited.includes(o.id),
            arrival = pendingHire(s, o.id),
            term = periods[o.id] || 'day',
            quote = hired ? contractRenewalQuote(s, o, term) : contractQuote(s, o, term),
            contract = contractStatus(s, o.id),
            profile = characterProfile(o),
            record = s.operativeState[o.id],
            guarantee = guaranteeRecord(s, arrival ?? contract),
            inTransit = operativeInTransit(s, o.id);
          const objection = serviceObjectionReason(s, o),
            moraleStatus = lowMoraleRenewalStatus(s, o);
          const cancellationReason = arrival ? hireCancellationReason(s, o.id) : null,
            departureReason = hired ? guaranteeDepartureReason(s, contract, o) : null;
          const hireReason = !hired ? hiringRouteReason : null;
          const admission = !hired ? civicStatus(s, o.id) : null,
            captive = !hired && record?.alive !== false && record?.captured;
          const captivityReason = captive ? admission?.reason : null,
            hireDescription =
              [
                captivityReason ? `hire-captivity-reason-${o.id}` : null,
                hireReason ? `hire-route-reason-${o.id}` : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined;
          const held =
            arrival &&
            (hiringArrivalReason(s, arrival.destination) ||
              (s.pendingBattle?.sector === arrival.destination
                ? 'La llegada espera a que salgas del sector.'
                : null));
          return (
            <article key={o.id} className="contract-card" data-operative-id={o.id}>
              <button
                className="candidate-face"
                onClick={() => setSelected(o.id)}
                aria-label={`Ver hoja de servicio de ${o.name}`}
              >
                {portrait ? (
                  <img src={sitePath(portrait)} alt={o.name} loading="lazy" />
                ) : (
                  <span>{(o.nickname ?? o.name).slice(0, 2).toUpperCase()}</span>
                )}
                <span>{o.name}</span>
              </button>
              <p className="eyebrow">{o.role}</p>
              <p className="candidate-greeting">«{profile.speech['hired']}»</p>
              <p className="candidate-specialties">{profile.skills.join(' · ')}</p>
              {characterAbilityDescriptions(o).map(
                (ability: { id: string; description: string }) => (
                  <small key={ability.id}>{ability.description}</small>
                ),
              )}
              <div className="candidate-stats">
                <span>
                  Puntería <b>{o.marksmanship}</b>
                </span>
                <span>
                  Liderazgo <b>{o.leadership}</b>
                </span>
                <span>
                  Grado <b>{o.level}</b>
                </span>
              </div>
              <button className="dossier-link" onClick={() => setSelected(o.id)}>
                Atributos, carácter y equipo →
              </button>
              <PreferredCompanionsSummary state={s} operative={o} />
              {quote.topTier && <small className="elite-contract">Especialista de élite</small>}
              {arrival ? (
                <>
                  <p className="contract-remaining">
                    Reclutamiento pagado · Falta un destino seguro ·{' '}
                    {CAMPAIGN_SECTORS.find((d) => d.id === arrival.destination)?.name}
                  </p>
                  <small>
                    {arrival.serviceHours === null
                      ? 'Servicio permanente'
                      : `${arrival.serviceHours / 24} ${arrival.serviceHours === 24 ? 'día' : 'días'} de servicio desde la incorporación`}{' '}
                    · Paga: {arrival.paid} pesos.{' '}
                    {guarantee && (
                      <>
                        Garantía financiada: {guarantee.amount} pesos. Total pagado:{' '}
                        {arrival.paid + guarantee.amount} pesos.
                      </>
                    )}
                  </small>
                  {held && (
                    <p>
                      <output>{held}</output>
                    </p>
                  )}
                  <label>
                    Cambiar destino
                    <select
                      aria-label={`Cambiar destino de ${o.name}`}
                      value={arrival.destination}
                      disabled={busy}
                      onChange={(e) =>
                        dispatch({
                          type: 'redirectHire',
                          id: o.id,
                          destination: e.target.value,
                        })
                      }
                    >
                      {!options.some((d) => d.id === arrival.destination) && (
                        <option value={arrival.destination}>
                          {CAMPAIGN_SECTORS.find((d) => d.id === arrival.destination)?.name} · No
                          disponible
                        </option>
                      )}
                      {options.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.infrastructure}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small>
                    La incorporación es inmediata cuando hay un destino seguro. El pago ya está
                    registrado.
                  </small>
                  {cancellationReason && <small aria-live="polite">{cancellationReason}</small>}
                  <button
                    className="dossier-link"
                    disabled={busy || Boolean(cancellationReason)}
                    title={cancellationReason || undefined}
                    onClick={() =>
                      dispatch({
                        type: 'cancelHireArrival',
                        id: o.id,
                        ...(arrival.guaranteeId
                          ? { expectedGuaranteeId: arrival.guaranteeId }
                          : {}),
                      })
                    }
                  >
                    Cancelar reclutamiento · recuperar{' '}
                    {arrival.paid + (guarantee?.state === 'held' ? guarantee.amount : 0)} pesos
                  </button>
                </>
              ) : (
                <>
                  {hired && (
                    <p className="contract-remaining">
                      {contract?.remaining === null
                        ? 'Servicio permanente'
                        : `${travelTime(contract?.remaining ?? 0)} de contrato restantes`}
                    </p>
                  )}
                  {!hired && !captive && record?.alive !== false && (
                    <small>Disponible de inmediato en el lugar elegido.</small>
                  )}
                  <ServiceObjectionNotice reason={objection} />
                  <ContractMoraleNotice status={moraleStatus} />
                  {quote.serviceRefusal ? (
                    <ServiceRefusalNotice
                      state={s}
                      refusal={quote.serviceRefusal}
                      disabled={busy}
                      dispatch={dispatch}
                    />
                  ) : (
                    quote.reason &&
                    quote.reason !== objection &&
                    quote.reason !== moraleStatus.reason && <small>{quote.reason}</small>
                  )}
                  <label>
                    Duración
                    <select
                      aria-label={`Duración del contrato de ${o.name}`}
                      value={term}
                      onChange={(e) => setPeriods({ ...periods, [o.id]: e.target.value })}
                    >
                      {terms.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(quote.guarantee > 0 || guarantee) && (
                    <small>
                      Paga: {quote.price} pesos · Garantía a financiar: {quote.guarantee} pesos ·
                      Total: {quote.total} pesos.
                    </small>
                  )}
                  {hired && guarantee && (
                    <small>
                      Garantía{' '}
                      {guarantee.state === 'held'
                        ? `retenida: ${guarantee.amount} pesos. Al finalizar ahora: ${serviceGuaranteeRefund(s, contract, o)} pesos de devolución según la salud actual.`
                        : `liquidada: ${guarantee.refund} pesos devueltos.`}{' '}
                      La paga no se devuelve.
                    </small>
                  )}
                  {hired && inTransit && (
                    <small>
                      Está en camino. Esperá su llegada para finalizar el servicio. Si vence durante
                      el viaje, la garantía queda retenida hasta la salida efectiva.
                    </small>
                  )}
                  {captivityReason && (
                    <small id={`hire-captivity-reason-${o.id}`}>{captivityReason}</small>
                  )}
                  {hireReason && <small id={`hire-route-reason-${o.id}`}>{hireReason}</small>}
                  <button
                    className="gold-button"
                    aria-describedby={hireDescription}
                    disabled={
                      !quote.available ||
                      s.resources.treasury < quote.total ||
                      record?.alive === false ||
                      busy ||
                      Boolean(hireReason) ||
                      (!hired && (!destination || !admission?.available))
                    }
                    onClick={() =>
                      dispatch(
                        hired
                          ? {
                              type: 'renewContract',
                              id: o.id,
                              term,
                              ...(contract?.guaranteeId
                                ? { expectedGuaranteeId: contract.guaranteeId }
                                : {}),
                            }
                          : {
                              type: 'recruitCombatant',
                              characterId: String(o.id),
                              term,
                              locationId: destination,
                            },
                      )
                    }
                  >
                    {record?.alive === false
                      ? 'Caído en combate'
                      : captive
                        ? 'En cautiverio'
                        : `${hired ? 'Renovar' : 'Reclutar'} · ${quote.total} pesos`}
                  </button>
                  {hired && departureReason && !inTransit && (
                    <small aria-live="polite">{departureReason}</small>
                  )}
                  {hired && (
                    <button
                      className="dossier-link"
                      disabled={busy || inTransit || Boolean(departureReason)}
                      title={departureReason || undefined}
                      onClick={() =>
                        dispatch({
                          type: 'dismiss',
                          id: o.id,
                          ...(contract?.guaranteeId
                            ? { expectedGuaranteeId: contract.guaranteeId }
                            : {}),
                        })
                      }
                    >
                      Finalizar servicio
                    </button>
                  )}
                </>
              )}
              <small>Personaje ficticio · {profile.personality.split('.')[0]}.</small>
            </article>
          );
        })}
      </div>
      {selectedOperative && selectedRecord && (
        <CharacterDossier
          state={s}
          operative={selectedOperative}
          record={selectedRecord}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
