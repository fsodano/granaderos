'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import type { ArrivalDecisionSnapshot } from '../../../packages/game/domain/journeys/arrival-decision.ts';
import SectorPreparation from './SectorPreparation';
import MilitiaDistribution from './MilitiaDistribution';
import MilitiaTraining from './MilitiaTraining';
import { careAssignmentBusy } from '../../../packages/game/medical-care.js';
import { historicalLossReason } from '../../../packages/game/historical-loss.js';
import { campaignUI } from '../lib/campaign-ui';
import {
  campaignFactionName,
  campaignTransportName,
} from '../lib/campaign-labels';
import { campaignPresentation } from '../../../packages/game/campaign-definition.js';
import { campaignStory } from '../../../packages/game/campaign-story.js';

import StrategicMap from './StrategicMap';
import StrategicPanel from './StrategicPanel';
import LogisticsAttention from './LogisticsAttention';
import SectorIncome from './SectorIncome';
import SectorEnvironment from './SectorEnvironment';
import { useEffect, useId, useRef, useState } from 'react';
import { useStrategicClock } from '../lib/useStrategicClock';
import { STRATEGIC_CLOCK_SPEEDS } from '../../../packages/game/strategic-clock.ts';
import {
  pendingArrivalDecisions,
  squadHasHorses,
} from '../../../packages/game/squad-travel.js';
import StrategicPersonnelMenu from './StrategicPersonnelMenu';
import {
  rosterFor,
  campaignObjectives,
} from '../../../packages/game/campaign.js';
import { getCityStatus } from '../../../packages/game/cities.js';
import {
  campaignPlace,
  worldCell,
  worldOwner,
} from '../../../packages/game/world-cells.ts';
import CharacterDossier from './CharacterDossier';
import { activeSquad } from '../../../packages/game/squads.js';
import MedicalCare from './MedicalCare';
import EnemyEncounters from './EnemyEncounters';
import AssignmentAttention from './AssignmentAttention';
import ContractAttention from './ContractAttention';
import './strategy.css';
import StrategicRoster from './StrategicRoster';
import { previewStrategicRoute } from '../../../packages/game/strategic-route.js';
import {
  JourneyMode,
  type JourneyModeValue,
} from '../../../packages/game/domain/journeys/journey.ts';
import TransientNotice from './TransientNotice';
export default function Campaign({
  state: s,
  battle,
  dispatch,
  onBattle,
  onOpenDesk,
}: {
  state: CampaignSnapshot;
  battle?: BattleSnapshot | null;
  dispatch: (a: CampaignAction) => void;
  onBattle: () => void;
  onOpenDesk: () => void;
}) {
  const [selected, setSelected] = useState(s.location),
    [dossier, setDossier] = useState<number | null>(null),
    [personMenu, setPersonMenu] = useState<{
      id: number;
      kind: 'assignment' | 'contract' | 'destination';
    } | null>(null);
  const clock = useStrategicClock(s, dispatch);
  const place = (id: string) => campaignPlace(id, s),
    presentation = campaignPresentation(s),
    ui = campaignUI(s),
    { SectorBriefing } = ui;
  const roster = rosterFor(s),
    hired = s.recruited
      .map((id: number) => roster.find((o) => o.id === id))
      .filter((operative) => operative !== undefined),
    def = place(selected),
    sector = s.sectors[selected],
    physical = worldCell(selected, s),
    owner = worldOwner(s, selected),
    city = getCityStatus(s, physical?.locality);
  const hostileDistrict =
    owner === 'royalist' &&
    physical?.locality &&
    selected !== physical.locality;
  const objective = campaignStory(s)
    ? campaignObjectives(s).find((c) => c.active)
    : null;
  const careBusy = s.squad.some((id: number) =>
    careAssignmentBusy(s.operativeState[id]?.assignment),
  );
  const [panel, setPanel] = useState<string | null>(null);
  const [plot, setPlot] = useState<{
    squadId: string;
    destination: string;
    mode: JourneyModeValue;
    waypoints: string[];
  } | null>(null);
  const [hover, setHover] = useState('');
  const arrivalDecisions: Array<
    ArrivalDecisionSnapshot & {
      squadId: string;
      name: string;
      origin: string;
      members: number[];
    }
  > = pendingArrivalDecisions(s);
  const arrivalPending = arrivalDecisions.length > 0;
  const plotting =
    plot?.squadId === s.activeSquadId &&
    !s.pendingBattle &&
    !s.pendingEncounter &&
    !s.defeated &&
    !arrivalPending
      ? plot
      : null;
  const candidate = plotting ? hover || plotting.destination : '';
  const selectedPreview = plotting
    ? previewStrategicRoute(
        s,
        plotting.squadId,
        plotting.destination,
        plotting.mode,
        plotting.waypoints,
      )
    : null;
  const preview = plotting
    ? previewStrategicRoute(
        s,
        plotting.squadId,
        candidate,
        plotting.mode,
        hover &&
          plotting.destination &&
          hover !== plotting.destination &&
          selectedPreview?.valid
          ? [...plotting.waypoints, plotting.destination]
          : plotting.waypoints,
      )
    : null;
  const clockCauseId = useId();
  const commandScreen = useRef<HTMLElement>(null);
  const plottingActive = Boolean(plotting);
  useEffect(() => {
    const cancel = () => {
      setPlot(null);
      setHover('');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.target instanceof Node) ||
        !commandScreen.current?.contains(event.target)
      ) {
        return;
      }
      if (event.key === 'Escape') {
        cancel();
        setPanel(null);
      }
    };
    const onContextMenu = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) ||
        !commandScreen.current?.contains(event.target)
      ) {
        return;
      }
      if (plottingActive) {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [plottingActive]);
  const cardPreview = plotting?.destination ? selectedPreview : preview;
  const cancelPlot = () => {
    setPlot(null);
    setHover('');
  };
  const selectSquad = (id: string, operativeId?: number) => {
    clock.pause();
    if (s.pendingBattle || s.pendingEncounter || s.defeated) {
      return;
    }
    const q = s.squads.find((q) => q.id === id);
    if (!q) {
      return;
    }
    setPanel(null);
    setHover('');
    setSelected(q.location);
    if (arrivalPending) {
      cancelPlot();
      if (q.id !== s.activeSquadId) {
        dispatch({ type: 'selectSquad', id });
      }
      return;
    }
    if (q.journey?.status === 'paused') {
      cancelPlot();
      if (q.id !== s.activeSquadId) {
        dispatch({ type: 'selectSquad', id });
      }
      const personId = operativeId ?? q.members[0];
      if (personId !== undefined) {
        setPersonMenu({ id: personId, kind: 'destination' });
      }
      return;
    }
    dispatch({ type: 'selectSquad', id });
    setPlot(
      q.members.length
        ? {
            squadId: id,
            destination: '',
            mode: q.journey?.mode ?? 'march',
            waypoints: [],
          }
        : null,
    );
  };
  const confirmRoute = () => {
    if (
      !plotting?.destination ||
      !selectedPreview?.valid ||
      !selectedPreview.action
    ) {
      return;
    }
    clock.pause();
    dispatch(selectedPreview.action);
    cancelPlot();
    setPanel(null);
  };
  const selectSector = (id: string) => {
    setSelected(id);
    if (plotting) {
      if (plotting.destination === id && selectedPreview?.valid) {
        confirmRoute();
      } else if (
        (activeSquad(s).journey ||
          id !== activeSquad(s).location ||
          plotting.destination ||
          plotting.waypoints.length) &&
        plotting.waypoints.length < 8
      ) {
        const append =
          plotting.destination &&
          plotting.destination !== id &&
          selectedPreview?.valid;
        setPlot({
          ...plotting,
          destination: id,
          waypoints: append
            ? [...plotting.waypoints, plotting.destination]
            : plotting.waypoints,
        });
        setHover('');
      }
    }
  };
  const moving = Boolean(activeSquad(s).journey);
  const arrivalBlocked = Boolean(
    s.pendingBattle || s.pendingEncounter || s.defeated,
  );
  const openPanel = (id: string) => {
    clock.pause();
    cancelPlot();
    setPanel(id);
  };
  const inspectSector = (id: string) => {
    if (!plotting) {
      setSelected(id);
      openPanel('sector');
    }
  };
  const dossierOperative = hired.find((operative) => operative.id === dossier);
  const dossierRecord =
    dossier === null ? undefined : s.operativeState[dossier];
  if (!def || !physical) {
    return null;
  }
  const rosterPanel = () => (
    <StrategicRoster
      state={s}
      roster={roster}
      onDossier={(id) => {
        clock.pause();
        setPanel(null);
        setDossier(id);
      }}
      onOpenDesk={onOpenDesk}
      onAssignment={(id: number) => {
        clock.pause();
        setPanel(null);
        setPersonMenu({ id, kind: 'assignment' });
      }}
      onContract={(id: number) => {
        clock.pause();
        setPanel(null);
        setPersonMenu({ id, kind: 'contract' });
      }}
      onDestination={selectSquad}
      dispatch={dispatch}
    />
  );
  return (
    <section
      ref={commandScreen}
      className="strategy-screen strategy-command-screen"
    >
      <header className="strategy-top">
        <h1>{presentation.eyebrow ?? presentation.title ?? 'Campaña'}</h1>
        <div className="strategy-funds" aria-label="Fondos disponibles">
          <span>Fondos</span>
          <strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong>
        </div>
        {s.pendingBattle && (
          <button
            className="line-button strategy-tactical-return"
            aria-label="Volver al sector táctico"
            onClick={() => {
              clock.pause();
              onBattle();
            }}
          >
            <span aria-hidden="true">▷</span> Sector táctico
          </button>
        )}
        <button className="gold-button" onClick={onOpenDesk}>
          Escritorio →
        </button>
      </header>
      <TransientNotice message={s.lastError} eventKey={s} />
      {s.defeated && (
        <p className="notice error">
          {campaignStory(s)?.defeat ??
            historicalLossReason(s) ??
            'La campaña terminó. Conservá tu partida o comenzá otra desde el menú.'}
        </p>
      )}
      {s.completed && (
        <p className="notice">
          {campaignStory(s)?.victory ??
            ui.victoryText ??
            'La campaña está completa. Podés continuar administrando tu escuadra.'}
        </p>
      )}
      {objective && (
        <section className="notice" aria-label="Objetivo actual de campaña">
          <strong>{objective.name}</strong>
          <p>{objective.objective}</p>
        </section>
      )}
      <div className="strategy-encounters">
        <LogisticsAttention state={s} />
        <AssignmentAttention state={s} roster={roster} />
        <ContractAttention state={s} roster={roster} dispatch={dispatch} />
        {s.pendingEncounter && (
          <EnemyEncounters state={s} dispatch={dispatch} />
        )}
        {arrivalDecisions.map((decision) => (
          <section
            className="notice"
            key={decision.id}
            aria-label={`Decisión al llegar · ${decision.name}`}
          >
            <strong>
              {decision.name} ·{' '}
              {place(decision.sectorId)?.name ?? decision.sectorId}
            </strong>
            <p>
              La escuadra llegó al límite del sector. Elegí combatir o
              retirarte. El tiempo de campaña está detenido.
            </p>
            <button
              className="gold-button"
              data-assault-target={decision.sectorId}
              disabled={arrivalBlocked}
              onClick={() => {
                clock.pause();
                dispatch({
                  type: 'fightOnArrival',
                  squadId: decision.squadId,
                  decisionId: decision.id,
                });
              }}
            >
              Combatir
            </button>
            <button
              className="line-button"
              disabled={Boolean(s.pendingEncounter || s.defeated)}
              onClick={() => {
                clock.pause();
                dispatch({
                  type: 'withdrawOnArrival',
                  squadId: decision.squadId,
                  decisionId: decision.id,
                });
              }}
            >
              Retirarse
            </button>
          </section>
        ))}
      </div>

      <div className="strategy-layout">
        {rosterPanel()}
        <StrategicMap
          state={s}
          {...(battle ? { battle } : {})}
          selected={selected}
          onSelect={selectSector}
          onInspect={inspectSector}
          onOpenPanel={clock.pause}
          dispatch={dispatch}
          plotting={Boolean(plotting)}
          onHover={setHover}
          previewPath={preview?.valid ? preview.path : []}
          onSquad={selectSquad}
        />
      </div>
      <footer className="strategy-bottom-controls">
        <nav className="strategy-tools" aria-label="Órdenes de campaña">
          {(
            [
              ['roster', 'Nómina'],
              ['sector', 'Sector'],
              ['care', 'Personal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`line-button${id === 'roster' ? ' strategy-roster-open' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={panel === id}
              onClick={() => openPanel(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="strategy-time">
          <span>
            Día {Math.floor(s.hour / 24) + 1} ·{' '}
            {String(s.hour % 24).padStart(2, '0')}:
            {String(Math.floor((s.secondOfHour ?? 0) / 60)).padStart(2, '0')}
          </span>
          <button
            className="line-button"
            aria-pressed={clock.running}
            title={clock.cause || undefined}
            aria-describedby={clock.cause ? clockCauseId : undefined}
            disabled={
              Boolean(s.pendingBattle || s.pendingEncounter) ||
              s.defeated ||
              arrivalPending
            }
            onClick={clock.toggle}
          >
            {clock.running ? 'Ⅱ Pausar' : '▶ Iniciar'}
          </button>
          <select
            aria-label="Velocidad del tiempo"
            value={clock.speed}
            onChange={(e) => clock.setSpeed(Number(e.target.value))}
          >
            {STRATEGIC_CLOCK_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
          <span className="sr-only" aria-live="polite">
            <output id={clockCauseId}>{clock.cause}</output>
          </span>
        </div>
      </footer>
      {plotting && (
        <section
          className="map-route-order strategic-route-overlay"
          aria-label="Trazar ruta"
        >
          <h2>
            {activeSquad(s).name} · {moving ? 'Cambiar destino' : 'Trazar ruta'}
          </h2>
          {moving && (
            <button
              className="line-button"
              onClick={() => {
                const squad = activeSquad(s);
                cancelPlot();
                const firstMember = squad.members[0];
                if (firstMember !== undefined) {
                  setPersonMenu({ id: firstMember, kind: 'destination' });
                }
              }}
            >
              Ver órdenes del viaje
            </button>
          )}
          <label>
            Transporte
            <select
              disabled={moving}
              aria-label="Transporte de la ruta"
              value={plotting.mode}
              onChange={(e) => {
                const mode = Object.values(JourneyMode).find(
                  (value) => value === e.target.value,
                );
                if (mode) {
                  setPlot({ ...plotting, mode });
                }
              }}
            >
              <option value="march">A pie · caminos</option>
              <option
                value="horse"
                disabled={!squadHasHorses(s, activeSquad(s))}
              >
                A caballo
              </option>
              <option value="posta">{campaignTransportName(s, 'posta')}</option>
              <option value="flotilla">
                {campaignTransportName(s, 'flotilla')}
              </option>
              <option value="carts">{campaignTransportName(s, 'carts')}</option>
            </select>
          </label>
          <p aria-live="polite">
            {candidate
              ? cardPreview?.valid
                ? `${cardPreview.path.map((id: string) => place(id)?.grid).join(' → ')} · ${cardPreview.hours} h${cardPreview.action?.type === 'attack' ? ' · Avance al límite enemigo' : ''}`
                : cardPreview?.reason
              : 'Elegí un destino en el mapa.'}
          </p>
          {plotting.destination && (
            <strong>{place(plotting.destination)?.name}</strong>
          )}
          <button
            className="gold-button"
            disabled={!plotting.destination || !selectedPreview?.valid}
            onClick={confirmRoute}
          >
            Confirmar ruta
          </button>
          <button className="line-button" onClick={cancelPlot}>
            Cancelar trazado
          </button>
          <small>
            Otro clic en el último destino confirma. Un destino diferente agrega
            una escala. Esc o clic derecho cancela. Después, iniciá el reloj.
          </small>
        </section>
      )}
      {panel && (
        <StrategicPanel
          title={
            panel === 'roster'
              ? 'Nómina'
              : panel === 'sector'
                ? `Sector · ${def.name.split(' · ')[0]}`
                : 'Personal'
          }
          onClose={() => setPanel(null)}
        >
          <div className="strategy-orders">
            <nav className="strategy-panel-tabs" aria-label="Panel de campaña">
              {(
                [
                  ['sector', 'Sector'],
                  ['care', 'Personal'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={panel === id}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="strategy-panel-content">
              {panel === 'roster' ? (
                rosterPanel()
              ) : panel === 'care' ? (
                <>
                  <MedicalCare
                    state={s}
                    sectorId={selected}
                    dispatch={dispatch}
                  />
                </>
              ) : (
                <>
                  <p className="eyebrow">CELDA {physical.grid}</p>
                  <h2>{def.name.split(' · ')[0]}</h2>
                  <p>
                    {owner === 'patriot'
                      ? `Bajo control de ${campaignFactionName(s, owner)}`
                      : owner === 'royalist'
                        ? `Ocupación de ${campaignFactionName(s, owner)}`
                        : physical.land
                          ? 'Terreno abierto'
                          : 'Agua abierta'}
                  </p>
                  {city ? (
                    <p className="city-summary">
                      {city.name}
                      <br />
                      <strong>
                        {city.sectors.length - city.uncontrolled.length}/
                        {city.sectors.length} sectores · {city.loyalty}% lealtad
                      </strong>
                    </p>
                  ) : (
                    <p>
                      {physical.land ? 'Zona rural' : 'Sin acceso terrestre'}
                    </p>
                  )}
                  {s.pendingBattle ? null : hostileDistrict ? (
                    <>
                      <p className="notice">
                        Liberá primero el sector principal de{' '}
                        {
                          place(physical.locality ?? selected)?.name.split(
                            ' · ',
                          )[0]
                        }{' '}
                        para recorrer sus barrios.
                      </p>
                      <button
                        className="line-button"
                        onClick={() => {
                          cancelPlot();
                          if (physical.locality) {
                            setSelected(physical.locality);
                          }
                        }}
                      >
                        Ver sector principal
                      </button>
                    </>
                  ) : (s.enemyGroups ?? []).some(
                      (g) => g.target === selected && g.status === 'stationed',
                    ) ? (
                    <button
                      className="gold-button"
                      disabled={
                        arrivalPending ||
                        moving ||
                        careBusy ||
                        !s.squad.length ||
                        Boolean(s.pendingEncounter)
                      }
                      onClick={() =>
                        dispatch({
                          type: 'attack',
                          sector: selected,
                          queue: true,
                        })
                      }
                    >
                      Contraatacar ocupación
                    </button>
                  ) : selected === s.location &&
                    owner !== 'royalist' &&
                    physical.land ? (
                    <button
                      className="gold-button"
                      disabled={
                        arrivalPending ||
                        moving ||
                        careBusy ||
                        !s.squad.length ||
                        Boolean(s.pendingEncounter)
                      }
                      onClick={() =>
                        dispatch({ type: 'visitSector', sector: selected })
                      }
                    >
                      Entrar al sector
                    </button>
                  ) : (
                    <button
                      className="gold-button"
                      disabled={
                        arrivalPending ||
                        moving ||
                        careBusy ||
                        !physical.land ||
                        !s.squad.length ||
                        Boolean(s.pendingEncounter)
                      }
                      onClick={() => {
                        setPlot({
                          squadId: s.activeSquadId,
                          destination: selected,
                          mode: 'march',
                          waypoints: [],
                        });
                        setHover('');
                        setPanel(null);
                      }}
                    >
                      {owner === 'royalist'
                        ? 'Avanzar y combatir'
                        : 'Mover escuadra aquí'}
                    </button>
                  )}
                  {careBusy && (
                    <p className="notice">
                      Hay personas en atención médica, descanso o trabajo en la
                      escuadra activa. Ponelos en servicio o dejalos en otra
                      escuadra antes de marchar.
                    </p>
                  )}
                  {SectorBriefing && (
                    <SectorBriefing
                      state={s}
                      selected={selected}
                      owner={owner}
                      careBusy={careBusy}
                      moving={moving}
                      dispatch={dispatch}
                    />
                  )}
                  <SectorPreparation
                    state={s}
                    sector={selected}
                    dispatch={dispatch}
                    onOpen={clock.pause}
                  />
                  <SectorEnvironment
                    state={s}
                    sector={selected}
                    hour={s.hour}
                    local={selected === s.location}
                  />
                  {sector ? (
                    <>
                      <SectorIncome state={s} definition={def} />
                      <button
                        className="line-button"
                        disabled={
                          arrivalPending ||
                          sector.owner !== 'patriot' ||
                          sector.fort >= 3 ||
                          s.resources.treasury < 150 ||
                          Boolean(s.pendingBattle) ||
                          s.defeated
                        }
                        onClick={() =>
                          dispatch({ type: 'fortify', sector: selected })
                        }
                      >
                        Fortificar · 150 pesos ({sector.fort}/3)
                      </button>
                      <MilitiaTraining
                        key={selected}
                        state={s}
                        sectorId={selected}
                        dispatch={dispatch}
                      />
                      <MilitiaDistribution
                        key={`distribution-${selected}`}
                        state={s}
                        sector={selected}
                        dispatch={dispatch}
                      />
                    </>
                  ) : (
                    <p>
                      Esta celda conserva su propio terreno y sus objetos. Los
                      servicios y las milicias se administran en el sector
                      principal de la localidad.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </StrategicPanel>
      )}
      {personMenu && (
        <StrategicPersonnelMenu
          key={`${personMenu.id}:${personMenu.kind}`}
          state={s}
          roster={roster}
          id={personMenu.id}
          kind={personMenu.kind}
          onClose={() => setPersonMenu(null)}
          dispatch={dispatch}
        />
      )}
      {dossierOperative && dossierRecord && (
        <CharacterDossier
          state={s}
          operative={dossierOperative}
          record={dossierRecord}
          onClose={() => setDossier(null)}
        />
      )}
    </section>
  );
}
