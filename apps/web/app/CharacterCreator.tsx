'use client';

import type {
  CampaignSnapshot,
  CampaignOfficerProfile,
} from '../../../packages/game/public/campaign-types.ts';
import { campaignOfficerCreation } from '../../../packages/game/campaign-officer-creation.ts';
import { sitePath } from '../lib/site-path.js';
import { useId, useRef, useState } from 'react';
import {
  PROFILE_ATTRIBUTES,
  PROFILE_POINTS,
  PORTRAIT_GENDERS,
  PORTRAIT_ROLES,
  PORTRAIT_SKIN_TONES,
  defaultProfile,
  createOfficerRecord,
} from '../../../packages/game/recruitment.ts';
import {
  MIN_OFFICER_HEALTH,
  validateOfficerCreationHealth,
} from '../../../packages/game/character-profile.ts';
import './CharacterCreator.css';
import { campaignCharacterPortraits } from '../../../packages/game/campaign-portraits.js';
type Portrait = {
  id: string;
  name: string;
  src: string;
  gender: string;
  role: string;
  skinTone: string;
  selectable?: boolean;
};

function PortraitPicker({
  selectedId,
  onSelect,
  portraits,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  portraits: Portrait[];
}) {
  const CHARACTER_PORTRAITS = portraits,
    SELECTABLE_CHARACTER_PORTRAITS = portraits.filter((p) => p.selectable !== false);
  const genders = [...new Set(SELECTABLE_CHARACTER_PORTRAITS.map((p) => p.gender))].map((id) => ({
      id,
      name: PORTRAIT_GENDERS.find((p) => p.id === id)?.name ?? 'Persona',
    })),
    roles = [...new Set(SELECTABLE_CHARACTER_PORTRAITS.map((p) => p.role))].map((id) => ({
      id,
      name: PORTRAIT_ROLES.find((p) => p.id === id)?.name ?? 'Personaje',
    }));
  const [gender, setGender] = useState(''),
    [role, setRole] = useState('');
  const genderSelect = useRef<HTMLSelectElement>(null);
  const pickerId = useId(),
    galleryId = `${pickerId}-gallery`,
    helpId = `${pickerId}-help`,
    ready = Boolean(gender && role);
  const selected = CHARACTER_PORTRAITS.find((p) => p.id === selectedId) ?? CHARACTER_PORTRAITS[0];
  const visible = ready
    ? SELECTABLE_CHARACTER_PORTRAITS.filter((p) => p.gender === gender && p.role === role)
    : [];
  const selectedVisible = visible.some((p) => p.id === selectedId);
  const clearFilters = () => {
    setGender('');
    setRole('');
    genderSelect.current?.focus();
  };
  const label = (options: readonly { id: string; name: string }[], id: string) =>
    options.find((option) => option.id === id)?.name ?? id;
  const description = (p: Portrait) =>
    `${label(PORTRAIT_GENDERS, p.gender)} · ${label(PORTRAIT_ROLES, p.role)} · ${label(PORTRAIT_SKIN_TONES, p.skinTone)}`;
  const groups = PORTRAIT_SKIN_TONES.map((t) => ({
    id: t.id,
    name: t.name,
    portraits: visible.filter((p) => p.skinTone === t.id),
  })).filter((group) => group.portraits.length);
  if (!selected) {
    return <p>No hay retratos disponibles.</p>;
  }
  return (
    <fieldset className="creator-portrait-fieldset">
      <legend>Retrato</legend>
      <div className="creator-portrait-heading">
        <span>Elegí tu rostro</span>
        <span aria-live="polite" aria-atomic="true">
          <output>
            {ready
              ? `${visible.length} de ${SELECTABLE_CHARACTER_PORTRAITS.length} retratos`
              : `${SELECTABLE_CHARACTER_PORTRAITS.length} retratos en total`}
          </output>
        </span>
      </div>
      <div className="creator-portrait-filters">
        <label>
          1. Género
          <select
            ref={genderSelect}
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              setRole('');
            }}
            aria-controls={galleryId}
          >
            <option value="">Elegí un género</option>
            {genders.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          2. Tipo de retrato
          <select
            value={role}
            disabled={!gender}
            onChange={(e) => setRole(e.target.value)}
            aria-controls={galleryId}
            aria-describedby={helpId}
          >
            <option value="">Elegí un tipo</option>
            {roles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p id={helpId} className="creator-portrait-help">
        El tipo describe la ropa y el aspecto del retrato. Podés elegir cualquier oficio y
        habilidad.
      </p>
      <div className="creator-portrait-picker">
        <figure className="creator-portrait-preview">
          <img
            src={sitePath(selected.src)}
            alt={`${selected.name}, retrato seleccionado`}
            width={160}
            height={190}
          />
          <figcaption aria-live="polite">
            <strong>{selected.name}</strong>
            <span className="creator-portrait-details">{description(selected)}</span>
            <small>Seleccionado{ready && !selectedVisible && ' · de otro grupo'}</small>
          </figcaption>
        </figure>
        <div className="creator-portrait-results">
          {!ready ? (
            <div aria-live="polite" id={galleryId} className="creator-portrait-prompt">
              <span aria-hidden="true">{gender ? '2' : '1'}</span>
              <p>
                {gender ? 'Ahora elegí un tipo de retrato.' : 'Primero elegí un género.'}
                <small>Después verás los rostros disponibles, organizados por tono de piel.</small>
              </p>
            </div>
          ) : visible.length > 0 ? (
            <>
              <fieldset
                style={{ border: 0, margin: 0, padding: 0 }}
                id={galleryId}
                className="creator-portraits"
                aria-label="Retratos disponibles"
              >
                {groups.map((group) => (
                  <section
                    key={group.id}
                    className="creator-portrait-group"
                    aria-labelledby={`${pickerId}-${group.id}`}
                  >
                    <h3 id={`${pickerId}-${group.id}`}>Tono de piel · {group.name}</h3>
                    <div className="creator-portrait-grid">
                      {group.portraits.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          data-portrait-id={p.id}
                          className={selectedId === p.id ? 'chosen' : ''}
                          aria-label={`Elegir ${p.name}. ${description(p)}`}
                          title={`${p.name} · ${description(p)}`}
                          aria-pressed={selectedId === p.id}
                          onClick={() => onSelect(p.id)}
                        >
                          <img
                            src={sitePath(p.src)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={72}
                            height={88}
                          />
                          <span className="creator-portrait-tone">
                            {label(PORTRAIT_SKIN_TONES, p.skinTone)}
                          </span>
                          {selectedId === p.id && (
                            <span className="creator-portrait-check" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </fieldset>
              <button type="button" className="creator-portrait-reset" onClick={clearFilters}>
                Cambiar género y tipo
              </button>
            </>
          ) : (
            <div id={galleryId} className="creator-portrait-empty">
              <p>No hay retratos de este tipo.</p>
              <button type="button" className="creator-portrait-reset" onClick={clearFilters}>
                Cambiar género y tipo
              </button>
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export default function CharacterCreator({
  onCreate,
  busy = false,
  state,
}: {
  state?: CampaignSnapshot;
  onCreate: (
    name: string,
    answers: Record<string, string>,
    profile: CampaignOfficerProfile,
  ) => void;
  busy?: boolean;
}) {
  const [name, setName] = useState(''),
    [profile, setProfile] = useState<CampaignOfficerProfile>(() => defaultProfile(state)),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  const portraits = campaignCharacterPortraits(state).map((portrait) => ({
      ...portrait,
      gender: portrait.gender ?? 'person',
      role: portrait.role ?? 'character',
      skinTone: portrait.skinTone ?? 'brown',
    })),
    creation = campaignOfficerCreation(state),
    CHARACTER_CLASSES = creation.classes,
    OFFICER_QUESTIONS = creation.commissionQuestions,
    PROFILE_QUESTIONS = creation.questions;
  const healthHelpId = useId();
  const remaining = PROFILE_POINTS - Object.values(profile.attributes).reduce((a, b) => a + b, 0);
  return (
    <section className="character-creator">
      <p className="eyebrow">Tu personaje</p>
      <h2>Hoja de servicio</h2>
      <p>
        Elegí tu rostro y oficio, distribuí 550 puntos y respondé el cuestionario. Este personaje te
        representa durante la campaña y no cobra contratación.
      </p>
      <label>
        Nombre
        <input
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellido"
        />
      </label>
      <label>
        Apodo (opcional)
        <input
          maxLength={16}
          value={profile.nickname ?? ''}
          onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
          placeholder="Cómo te llama la escuadra"
        />
      </label>
      <PortraitPicker
        portraits={portraits}
        selectedId={profile.portraitId}
        onSelect={(portraitId) => setProfile((current) => ({ ...current, portraitId }))}
      />
      <label>
        Oficio
        <select
          value={profile.classId}
          onChange={(e) => setProfile({ ...profile, classId: e.target.value })}
        >
          {CHARACTER_CLASSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.description}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Atributos · {remaining} puntos por distribuir</legend>
        <p id={healthHelpId}>
          La salud inicial debe estar entre {MIN_OFFICER_HEALTH} y 85 para que tu personaje esté
          consciente. Los demás atributos admiten de 0 a 85.
        </p>
        <div className="creator-attributes">
          {PROFILE_ATTRIBUTES.map((a) => (
            <label key={a.id}>
              <span>
                {a.name} · {profile.attributes[a.id]}
              </span>
              <input
                type="range"
                min={a.id === 'maxHp' ? MIN_OFFICER_HEALTH : 0}
                max={85}
                step={1}
                value={profile.attributes[a.id]}
                aria-label={a.name}
                aria-describedby={a.id === 'maxHp' ? healthHelpId : undefined}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    attributes: {
                      ...profile.attributes,
                      [a.id]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      {[...OFFICER_QUESTIONS, ...PROFILE_QUESTIONS].map((q) => (
        <label key={q.id}>
          {q.label}
          <select
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
          >
            <option value="" disabled>
              Elegí una respuesta
            </option>
            {q.choices.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        La equitación facilita marchar a caballo; la experiencia nocturna amplía la visión; la
        enseñanza mejora la instrucción. El optimismo o pesimismo afectan la moral inicial.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="line-button"
        disabled={busy}
        onClick={() => {
          try {
            createOfficerRecord(name, answers, profile, state);
            validateOfficerCreationHealth(profile);
            setError('');
            onCreate(name, answers, profile);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Revisá la hoja de servicio.');
          }
        }}
      >
        Comenzar mi campaña
      </button>
    </section>
  );
}
