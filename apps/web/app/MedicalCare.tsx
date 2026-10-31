'use client';

import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignOperative,
  CampaignOperativeState,
  TrainableSkill,
} from '../../../packages/game/public/campaign-types.ts';
import { operativeInTransit } from '../../../packages/game/squads.js';
import { maximumEnergy } from '../../../packages/game/fatigue.js';
import { useState } from 'react';
import { operativeLocation, rosterFor } from '../../../packages/game/campaign.js';
import {
  CARE_ASSIGNMENTS,
  ALL_ASSIGNMENTS,
  careAssignmentReason,
  careStatus,
} from '../../../packages/game/medical-care.js';
import {
  WORK_ASSIGNMENTS,
  STUDY_SKILLS,
  workAssignmentReason,
  workStatus,
  repairEquipmentQueue,
} from '../../../packages/game/assignments.js';
import { sleepNeedStatus } from '../../../packages/game/sleep-needs.ts';
import { sleepOrderReason } from '../../../packages/game/sleep.js';
import { moraleStatus } from '../../../packages/game/morale.js';
import { equipmentInventoryUsage } from '../../../packages/game/equipment.js';
import { repairMaterialPoints } from '../../../packages/game/repair-materials.js';
import './medical-care.css';
import StudyForecast from './StudyForecast';
import MilitiaCare from './MilitiaCare';
import { weaponSpecification } from '../../../packages/game/weapon-definition.ts';
import { campaignPlace } from '../../../packages/game/world-cells.ts';
import CampaignWeaponSummary from './CampaignWeaponSummary';

export function MedicalSupplyPurchase({ s, op }: { s: CampaignSnapshot; op: CampaignOperative }) {
  return (
    <div className="care-supplies">
      <span>{s.operativeState[op.id]?.medkits ?? 0} vendas llevadas</span>
    </div>
  );
}

function isStudySkill(value: string): value is TrainableSkill {
  return Object.hasOwn(STUDY_SKILLS, value);
}
function PersonnelCard({
  s,
  record,
  op,
  roster,
  blocked,
  dispatch,
}: {
  s: CampaignSnapshot;
  record: CampaignOperativeState;
  op: CampaignOperative;
  roster: CampaignOperative[];
  blocked: boolean;
  dispatch: (action: CampaignAction) => void;
}) {
  const maxHp = record.maxHp ?? op.maxHp;
  const energyLimit = maximumEnergy(record),
    shownEnergy = Math.min(record.energy ?? 100, energyLimit);
  const [skill, setSkill] = useState<TrainableSkill>(record.trainingSkill ?? 'marksmanship'),
    [teacherId, setTeacherId] = useState(String(record.instructorId ?? '')),
    [targetId, setTargetId] = useState(String(record.repairTargetId ?? op.id)),
    [repairScope, setRepairScope] = useState<'equipment' | 'primary'>(
      record.repairScope ?? (record.assignment === 'repair' ? 'primary' : 'equipment'),
    );
  const instructors = roster.filter(
    (o) =>
      o.id !== op.id &&
      s.recruited.includes(o.id) &&
      s.operativeState[o.id]?.alive &&
      !operativeInTransit(s, o.id) &&
      operativeLocation(s, o.id) === operativeLocation(s, op.id) &&
      s.operativeState[o.id]?.assignment === 'instructor' &&
      s.operativeState[o.id]?.trainingSkill === skill &&
      (o[skill] ?? 0) > (op[skill] ?? 0),
  );
  const teacher = instructors.find((o) => String(o.id) === teacherId) ?? instructors[0];
  const targets = roster.filter(
    (o) =>
      s.recruited.includes(o.id) &&
      s.operativeState[o.id]?.alive &&
      !operativeInTransit(s, o.id) &&
      operativeLocation(s, o.id) === operativeLocation(s, op.id) &&
      (repairScope === 'equipment' || (weaponSpecification(o)?.capacity ?? 0) > 0),
  );
  const target = targets.find((o) => String(o.id) === targetId) ?? targets[0];
  const work = Object.hasOwn(WORK_ASSIGNMENTS, record.assignment ?? 'active');
  const usage = equipmentInventoryUsage(s, op),
    sleepReason = sleepOrderReason(s, op.id, !record.asleep);
  const options = {
    skill,
    ...(teacher ? { instructorId: teacher.id } : {}),
    ...(target ? { targetId: target.id } : {}),
    repairScope,
  };
  const repairQueue =
    target && s.operativeState[target.id] && repairScope === 'equipment'
      ? repairEquipmentQueue(s.operativeState[target.id], target)
      : [];
  const reason = (assignment: string) =>
    Object.hasOwn(CARE_ASSIGNMENTS, assignment)
      ? careAssignmentReason(s, op, assignment)
      : workAssignmentReason(s, op, assignment, options, roster);
  const assign = (assignment: string) =>
    dispatch(
      Object.hasOwn(CARE_ASSIGNMENTS, assignment)
        ? { type: 'assignCare', operativeId: op.id, assignment }
        : { type: 'assignWork', operativeId: op.id, assignment, ...options },
    );
  return (
    <article
      data-care-id={op.id}
      className={`care-record${record.bleeding > 0 ? ' care-bleeding' : ''}`}
    >
      <div className="care-name">
        <h3>{op.nickname}</h3>
        <span>
          Medicina {op.medical} · Mecánica {op.mechanical}
        </span>
      </div>
      <div className="care-vitals">
        <label>
          Salud{' '}
          <strong>
            {record.hp}/{maxHp}
          </strong>
          <meter aria-label={`Salud de ${op.nickname}`} min={0} max={maxHp} value={record.hp} />
        </label>
        <label>
          Energía{' '}
          <strong>
            {Math.round(shownEnergy)}/{energyLimit}
          </strong>
          <meter
            aria-label={`Energía de ${op.nickname}`}
            min={0}
            max={energyLimit}
            value={shownEnergy}
          />
        </label>
      </div>
      <p className="care-condition">
        {!record.alive
          ? 'Caído'
          : record.bleeding > 0
            ? `Hemorragia ${record.bleeding} · necesita atención`
            : record.hp < 15
              ? 'Estado crítico · necesita un médico'
              : (record.bandaged ?? 0) > 0
                ? `${record.bandaged} puntos de herida vendada`
                : 'Sin hemorragia'}{' '}
        · Fatiga {record.fatigue}
      </p>
      <p className="care-condition">{sleepNeedStatus({ ...op, ...record })}</p>
      <p className="care-condition">{moraleStatus(s, op.id)}</p>
      <label className="care-order">
        Asignación
        <select
          aria-label={`Asignación de ${op.nickname}`}
          value={record.assignment ?? 'active'}
          disabled={blocked || !record.alive}
          onChange={(event) => assign(event.target.value)}
        >
          {Object.entries(ALL_ASSIGNMENTS).map(([value, label]) => {
            const why = reason(value);
            return (
              <option key={value} value={value} disabled={Boolean(why)} title={why}>
                {label}
              </option>
            );
          })}
        </select>
      </label>
      <button
        className="line-button"
        aria-label={`${record.asleep ? 'Despertar' : 'Dormir'}: ${op.nickname}`}
        disabled={blocked || Boolean(sleepReason)}
        title={sleepReason || 'Conserva su asignación mientras duerme.'}
        onClick={() =>
          dispatch({
            type: 'setSleep',
            operativeId: op.id,
            asleep: !record.asleep,
          })
        }
      >
        {record.asleep ? 'Despertar' : 'Dormir'}
      </button>
      <p className="care-status" aria-live="polite">
        {work ? workStatus(s, op, roster) : careStatus(s, op, roster)}
      </p>
      <details className="care-work" open={work || undefined}>
        <summary>Preparar práctica o reparación</summary>
        <div>
          <label>
            Habilidad
            <select
              aria-label={`Habilidad de ${op.nickname}`}
              value={skill}
              disabled={blocked || !record.alive}
              onChange={(event) => {
                if (isStudySkill(event.target.value)) {
                  setSkill(event.target.value);
                }
              }}
            >
              {Object.keys(STUDY_SKILLS)
                .filter(isStudySkill)
                .map((value) => (
                  <option key={value} value={value} disabled={(op[value] ?? 0) <= 0}>
                    {STUDY_SKILLS[value]} · {op[value] ?? 0}
                  </option>
                ))}
            </select>
          </label>
          <StudyForecast record={record} op={op} skill={skill} instructor={teacher} />
          <label>
            Instructor
            <select
              aria-label={`Instructor de ${op.nickname}`}
              value={teacher?.id ?? ''}
              disabled={blocked || !record.alive}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              {!instructors.length && <option value="">Sin instructor de esta habilidad</option>}
              {instructors.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nickname} · {o[skill]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipo de
            <select
              aria-label={`Equipo para reparar de ${op.nickname}`}
              value={target?.id ?? ''}
              disabled={blocked || !record.alive}
              onChange={(event) => setTargetId(event.target.value)}
            >
              {!targets.length && <option value="">No hay combatientes presentes</option>}
              {targets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nickname}
                  {repairScope === 'primary' ? ` · ${s.operativeState[o.id]?.condition}%` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reparar
            <select
              aria-label={`Alcance de reparación de ${op.nickname}`}
              value={repairScope}
              disabled={blocked || !record.alive}
              onChange={(event) => {
                if (event.target.value === 'equipment' || event.target.value === 'primary') {
                  setRepairScope(event.target.value);
                }
              }}
            >
              <option value="equipment">Todo el equipo llevado</option>
              <option value="primary">Solo el arma principal actual</option>
            </select>
          </label>
          {repairScope === 'equipment' && (
            <div aria-label={`Orden de reparación de ${op.nickname}`}>
              <small>
                Secundaria → principal y bayoneta → mochila. La lista sigue el equipo que lleve esta
                persona.
              </small>
              {repairQueue.length ? (
                <ol>
                  {repairQueue.slice(0, 4).map((item) => (
                    <li key={item.key}>
                      {item.label}
                      {item.count > 1 ? ` × ${item.count}` : ''} · {Math.round(item.condition)}%
                      {item.jammed ? ' · atascada' : ''}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No hay equipo dañado ni armas atascadas.</p>
              )}
              {repairQueue.length > 4 && <small>Y {repairQueue.length - 4} entradas más.</small>}
            </div>
          )}
          {work && (
            <button
              className="line-button"
              disabled={blocked || Boolean(reason(record.assignment))}
              onClick={() => assign(record.assignment)}
            >
              Aplicar selección
            </button>
          )}
          <small>
            Primero asigná un instructor. Después elegí su alumno y la misma habilidad. Cada
            instructor atiende a un alumno.
          </small>
        </div>
      </details>
      <MedicalSupplyPurchase s={s} op={op} />
      <p className="care-condition">
        Mochila: {usage.used}/{usage.capacity} espacios con la reserva de cartuchos.
      </p>
      <div className="care-supplies">
        <span>{repairMaterialPoints(record)} puntos de herramientas llevadas</span>
      </div>
      <p className="care-condition" aria-label="Arma principal">
        <CampaignWeaponSummary operative={op} record={record} showCondition />
      </p>
    </article>
  );
}

export default function MedicalCare({
  state: s,
  sectorId = s.location,
  dispatch,
}: {
  state: CampaignSnapshot;
  sectorId?: string;
  dispatch: (action: CampaignAction) => void;
}) {
  const roster = rosterFor(s),
    personnel = roster.filter(
      (o) =>
        s.recruited.includes(o.id) &&
        !s.operativeState[o.id]?.captured &&
        !operativeInTransit(s, o.id) &&
        operativeLocation(s, o.id) === sectorId,
    );
  const blocked = Boolean(s.pendingBattle || s.pendingEncounter) || s.defeated;
  const place = campaignPlace(sectorId, s);
  return (
    <section
      className="medical-care"
      aria-label="Atención médica en campaña"
      aria-labelledby="medical-care-title"
    >
      <header>
        <div>
          <p className="eyebrow">PERSONAL EN {place?.grid}</p>
          <h2 id="medical-care-title">Asignaciones del personal</h2>
        </div>
        <p>
          Organizá la atención, el descanso, la práctica y las reparaciones. Cada trabajo necesita
          tiempo y personal presente en un sector seguro.
        </p>
      </header>
      {!personnel.length ? (
        <p className="care-empty">No hay combatientes contratados en {place?.name}.</p>
      ) : (
        <div className="care-personnel">
          {personnel.map((op) => {
            const record = s.operativeState[op.id];
            return record ? (
              <PersonnelCard
                key={op.id}
                s={s}
                op={op}
                record={record}
                roster={roster}
                blocked={blocked}
                dispatch={dispatch}
              />
            ) : null;
          })}
        </div>
      )}
      <MilitiaCare state={s} sectorId={sectorId} roster={roster} />
      <p className="care-help">
        Las vendas reducen la hemorragia y estabilizan heridas críticas hasta 15 de salud; el médico
        continúa la recuperación con botiquines. El descanso recupera energía y 1 de salud cada 6
        horas sin hemorragia, salvo heridas críticas. La práctica mejora habilidades de forma
        gradual; un instructor con más habilidad acelera el aprendizaje. Reparar consume
        herramientas para mantener armas, bayonetas y herramientas llevadas. Desatascar un arma
        también consume un punto; no repone munición. La fatiga limita la energía máxima. El
        personal agotado duerme automáticamente y retoma su tarea al recuperarse. Dormir conserva la
        asignación y recupera energía más rápido que estar en servicio sin actividad. Para marchar,
        despertá al personal y elegí «En servicio» o dejá al personal en otra escuadra.
      </p>
    </section>
  );
}
