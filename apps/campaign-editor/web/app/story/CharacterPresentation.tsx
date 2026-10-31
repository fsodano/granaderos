import type {
  CampaignContent,
  CharacterDefinition,
  DraftPatch,
} from '../../../../../packages/campaign-format/types.ts';
import { sitePath } from '../../../../web/game-preview-assets.js';
import {
  AUTHORABLE_SPEECH_EVENTS,
  OPTIONAL_SPEECH_EVENTS,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import { campaignCharacterPortraits } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  APPEARANCE_LABELS,
  SPEECH_LABELS,
  SPEECH_LINE_LIMIT,
  characterPresentationDefaults,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  spriteRender,
  spriteViewport,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import ServiceRelationshipsEditor from './ServiceRelationshipsEditor.tsx';

export default function CharacterPresentation({
  character,
  portraits,
  characters,
  weapon,
  onChange,
  content,
  resolveAsset = sitePath,
}: {
  resolveAsset?: (reference: string) => string;
  content?: CampaignContent;
  character: CharacterDefinition;
  portraits: CharacterDefinition[];
  characters?: CharacterDefinition[];
  weapon: number | string;
  onChange: (patch: DraftPatch<CharacterDefinition>) => void;
}) {
  const values = characterPresentationDefaults(character, content);
  const choices = [
    ...new Map(
      [
        ...campaignCharacterPortraits(content).filter((p) => p.selectable !== false),
        ...portraits.filter((c) => c.portrait).map((c) => ({ src: c.portrait, name: c.name })),
      ].map((p) => [p.src, p]),
    ).values(),
  ];
  const sprite = spriteRender(
    {
      id: 'preview',
      side: 'player',
      hp: 100,
      spriteAppearance: values.spriteAppearance,
      skinTone: values.skinTone,
      weapon,
    },
    { direction: 2, moving: false, frame: 0 },
  );
  const viewport = spriteViewport(sprite, { x: 0, y: 0 }, 2, 0, 90);
  return (
    <section aria-label="Voz y apariencia del personaje" className="character-presentation">
      <h3>Retrato y apariencia</h3>
      <label>
        Retrato disponible
        <select
          value={choices.some((p) => p.src === character.portrait) ? character.portrait : ''}
          onChange={(e) => onChange({ portrait: e.target.value })}
        >
          <option value="" disabled>
            Imagen propia
          </option>
          {choices.map((p) => (
            <option key={p.src} value={p.src}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="appearance-choice">
        <svg
          viewBox={viewport.viewBox}
          width="112"
          height="112"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG crops the sprite atlas; an HTML image cannot preserve this viewport.
          role="img"
          aria-label={`Apariencia: ${Object.entries(APPEARANCE_LABELS).find(([id]) => id === values.spriteAppearance)?.[1] ?? values.spriteAppearance}`}
        >
          <image
            href={resolveAsset(sprite.href)}
            width={sprite.size[0]}
            height={sprite.size[1]}
            style={{ imageRendering: 'pixelated' }}
          />
        </svg>
        <label>
          Apariencia en combate
          <select
            value={values.spriteAppearance}
            onChange={(e) => onChange({ spriteAppearance: e.target.value })}
          >
            {Object.entries(APPEARANCE_LABELS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <small>
            El retrato y la apariencia se eligen por separado. No cambian los atributos ni las
            habilidades.
          </small>
        </label>
      </div>
      <label>
        Paleta de piel
        <select
          value={character.skinTone ?? ''}
          onChange={(e) => onChange({ skinTone: e.target.value || undefined })}
        >
          <option value="">Valor del personaje</option>
          <option value="light">Clara</option>
          <option value="brown">Morena</option>
          <option value="dark">Oscura</option>
        </select>
      </label>
      <h3>Carácter y frases</h3>
      <label>
        Carácter
        <textarea
          rows={3}
          maxLength={2000}
          value={values.personality}
          onChange={(e) => onChange({ personality: e.target.value })}
        />
      </label>
      <small>
        Describe su personalidad en la hoja de servicio. La moral mantiene las reglas de combate.
      </small>
      {characters && (
        <ServiceRelationshipsEditor
          character={character}
          characters={characters}
          onChange={onChange}
        />
      )}
      <p>
        Estas frases se usan cuando ocurre cada evento. Dejá una frase vacía para que no hable en
        esa situación. Las reacciones breves no se repiten en cada evento.
      </p>
      {AUTHORABLE_SPEECH_EVENTS.map((event) => (
        <label key={event}>
          {Object.entries(SPEECH_LABELS).find(([id]) => id === event)?.[1] ?? event}
          <textarea
            rows={2}
            maxLength={SPEECH_LINE_LIMIT}
            value={values.speech[event] ?? ''}
            onChange={(e) => {
              const speech = { ...values.speech, [event]: e.target.value };
              if (OPTIONAL_SPEECH_EVENTS.includes(event) && !e.target.value) {
                delete speech[event];
              }
              onChange({ speech });
            }}
          />
          {event === 'treated' && (
            <small>
              Habla después de recibir vendas de otra persona si está consciente. No habla al
              vendarse solo, durante un tratamiento que lo deja inconsciente ni al recuperarse con
              el tiempo.
            </small>
          )}
          {event === 'near' && (
            <small>
              Reacciona a un disparo que pasó cerca. Esta frase no indica que haya visto al tirador.
            </small>
          )}
          {event === 'interrupt' && (
            <small>
              Reacciona cuando tiene una oportunidad de actuar. No usa la frase de detección de
              enemigos.
            </small>
          )}
        </label>
      ))}
    </section>
  );
}
