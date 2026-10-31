import type { CampaignContext } from './public/compatibility-types.ts';
import type { CampaignOfficerProfile } from './public/campaign-types.ts';
import type {
  AlternativeLoad,
  CampaignContent,
  WeaponDefinition,
} from '../campaign-format/types.ts';
import type {
  OfficerCreation,
  OfficerClass,
  OfficerCreationDefinition,
} from '../campaign-format/officer-creation-types.ts';
import { campaignDefinitions } from './campaign-definition.js';
import { validateOfficerCreation as validateOfficerCreationSchema } from '../campaign-format/officer-creation-schema.js';
import { DEFAULT_CONTENT, DEFAULT_PRESENTATION } from '../../content/campaigns/default.js';
import { FITTING_PATTERNS } from './weapon-fittings.js';

const definitionsFor = (value: CampaignContext) => campaignDefinitions(value);
export const usesGenericOfficerCreation = (value: CampaignContext): boolean => {
  const d = definitionsFor(value);
  return d?.scenario === 'generic-v1' || Boolean(d?.campaignStory);
};
const choice = (id: string, name: string) => ({ id, name });
export const NEUTRAL_OFFICER_CREATION: OfficerCreation = {
  classes: [
    {
      id: 'gaucho',
      name: 'Personaje',
      description: 'Usá el equipo disponible en esta campaña.',
      weapon: null,
      blade: null,
    },
  ],
  questions: [
    {
      id: 'specialty',
      label: '¿Qué destreza personal te distingue?',
      choices: [
        choice('rider', 'Conducir caballos'),
        choice('night', 'Reconocer el terreno de noche'),
        choice('teacher', 'Instruir a otras personas'),
        choice('ambidextrous', 'Usar ambas manos'),
      ],
    },
    {
      id: 'temperament',
      label: '¿Cómo respondés después de un revés?',
      choices: [
        choice('optimistic', 'Confío en la recuperación'),
        choice('pessimistic', 'Preveo las dificultades'),
        choice('steady', 'Me concentro en la tarea'),
      ],
    },
  ],
  commissionQuestions: [
    {
      id: 'origin',
      label: '¿Dónde adquiriste tu formación?',
      choices: [
        choice('estancia', 'En el trabajo de campo'),
        choice('cabildo', 'En estudios y administración'),
        choice('workshop', 'En un taller'),
      ],
    },
    {
      id: 'doctrine',
      label: '¿Qué disciplina guiará tu servicio?',
      choices: [
        choice('cavalry_commander', 'Mando montado'),
        choice('guerrilla_tactician', 'Exploración y movilidad'),
        choice('gunsmith_artillerist', 'Mecánica y artillería'),
        choice('line_marksman', 'Tiro disciplinado'),
      ],
    },
    {
      id: 'crisis',
      label: 'Un compañero cae bajo el fuego. ¿Cómo respondés?',
      choices: [
        choice('rescue', 'Acudo a socorrerlo'),
        choice('rally', 'Reúno al grupo'),
        choice('flank', 'Busco un flanco'),
      ],
    },
  ],
  traits: [
    {
      id: 'cavalry_commander',
      name: 'Mando montado',
      description: 'Instrucción y maniobras a caballo.',
    },
    {
      id: 'guerrilla_tactician',
      name: 'Exploración y movilidad',
      description: 'Exploración y desplazamiento en el terreno.',
    },
    {
      id: 'gunsmith_artillerist',
      name: 'Mecánica y artillería',
      description: 'Reparación y servicio de las piezas.',
    },
    { id: 'line_marksman', name: 'Tiro disciplinado', description: 'Puntería y tiro deliberado.' },
  ],
  defaults: { classId: 'gaucho', portraitId: null },
  commission: {
    role: 'Oficial',
    biography: 'Personaje incorporado a la escuadra.',
    questionError: 'Completá las tres preguntas de formación.',
    statusText: 'se incorpora a la escuadra.',
    availableText: 'Disponible para incorporarse.',
    weapon: null,
    doctrineWeapons: {},
  },
  registry: 'Tu personaje',
  biography:
    'Personaje ficticio creado por el jugador. Sus atributos fueron asignados al comenzar la campaña.',
};

export function campaignOfficerCreation(context: CampaignContext = null): OfficerCreation {
  const d = definitionsFor(context),
    base = usesGenericOfficerCreation(context)
      ? NEUTRAL_OFFICER_CREATION
      : (DEFAULT_PRESENTATION.officerCreation ?? NEUTRAL_OFFICER_CREATION),
    authored = d?.presentation?.officerCreation;
  if (!authored) {
    return base;
  }
  return {
    ...base,
    ...authored,
    defaults: { ...base.defaults, ...authored.defaults },
    commission: { ...base.commission, ...authored.commission },
  };
}

// A creator assigns campaign-local weapon IDs. Omitted generic assignments
// are unarmed, even when the package happens to retain a familiar numeric ID.
export function officerCreationWeapon(
  reference: string | null | undefined,
  context: CampaignContext = null,
): WeaponDefinition | null {
  if (reference === null || reference === undefined) {
    return null;
  }
  const d = definitionsFor(context),
    weapons = d?.weapons ?? (usesGenericOfficerCreation(context) ? [] : DEFAULT_CONTENT.weapons);
  const weapon = weapons.find((w) => w.id === reference);
  if (!weapon) {
    throw Error('El equipo inicial del personaje no existe en esta campaña.');
  }
  const { alternativeLoads, ...definition } = weapon;
  if (!alternativeLoads) {
    return definition;
  }
  const validatedLoads = alternativeLoads.map(({ pattern, ...load }): AlternativeLoad => {
    if (pattern !== 'single' && pattern !== 'cone') {
      throw Error('El patrón de carga inicial no es válido.');
    }
    return { ...load, pattern };
  });
  return { ...definition, alternativeLoads: validatedLoads };
}

const validClassFitting = (
  cls: OfficerClass,
  weapons: Pick<WeaponDefinition, 'id' | 'template'>[],
) =>
  cls.bladeFittingPattern === undefined ||
  (typeof cls.bladeFittingPattern === 'string' &&
    Object.hasOwn(FITTING_PATTERNS, cls.bladeFittingPattern) &&
    weapons.find((w) => w.id === cls.weapon)?.template ===
      Object.entries(FITTING_PATTERNS).find(([id]) => id === cls.bladeFittingPattern)?.[1].host &&
    weapons.find((w) => w.id === cls.blade)?.template ===
      Object.entries(FITTING_PATTERNS).find(([id]) => id === cls.bladeFittingPattern)?.[1].weapon);
// Only the new-character order issues this authored fitting. Reconstructing
// an officer or restoring an old save must not identify an existing blade.
// A package must declare its own pattern; its local weapon IDs may be remapped.
export function officerStartingFitting(
  profile: CampaignOfficerProfile | undefined,
  context: CampaignContext = null,
): string | null {
  const definitions = definitionsFor(context),
    classes = definitions?.weapons
      ? (definitions.presentation?.officerCreation?.classes ?? [])
      : campaignOfficerCreation(context).classes;
  const cls = profile?.version === 2 && classes.find((c) => c.id === profile.classId);
  if (!cls || cls.bladeFittingPattern === undefined) {
    return null;
  }
  if (!validClassFitting(cls, definitions?.weapons ?? DEFAULT_CONTENT.weapons)) {
    throw Error('La bayoneta inicial no corresponde al equipo de esta clase.');
  }
  return cls.bladeFittingPattern;
}

export function validateOfficerCreation(
  value: OfficerCreationDefinition | undefined,
  content: Partial<CampaignContent>,
): string[] {
  const errors = validateOfficerCreationSchema(value, content);
  if (errors.length || value === undefined) {
    return errors;
  }
  if (value.classes?.some((cls) => !validClassFitting(cls, content?.weapons ?? []))) {
    errors.push('Creación de personajes: clases o equipo local inválidos.');
  }
  return errors;
}
