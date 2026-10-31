const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 800) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= max &&
  // eslint-disable-next-line no-control-regex -- Reject control characters in authored text/IDs.
  !/[<>\x00-\x1f]/u.test(value);
const TRAIT_IDS = [
  'cavalry_commander',
  'guerrilla_tactician',
  'gunsmith_artillerist',
  'line_marksman',
];
const CLASS_IDS = ['gaucho', 'soldado', 'baqueano', 'artesano'];
const QUESTION_CHOICES = {
  specialty: ['rider', 'night', 'teacher', 'ambidextrous'],
  temperament: ['optimistic', 'pessimistic', 'steady'],
  origin: ['estancia', 'cabildo', 'workshop'],
  doctrine: TRAIT_IDS,
  crisis: ['rescue', 'rally', 'flank'],
};

/** @returns {string[]} */
export function validateOfficerCreation(value, content) {
  if (value === undefined) {
    return [];
  }
  const errors = [],
    check = (ok, message) => {
      if (!ok) {
        errors.push(`Creación de personajes: ${message}`);
      }
    };
  if (!object(value)) {
    return ['Creación de personajes: la presentación no es válida.'];
  }
  check(
    Object.keys(value).every((key) =>
      [
        'classes',
        'questions',
        'commissionQuestions',
        'traits',
        'defaults',
        'commission',
        'biography',
        'registry',
      ].includes(key),
    ),
    'opción desconocida.',
  );
  const weaponIds = new Set((content?.weapons ?? []).map((w) => w.id)),
    bladeIds = new Set((content?.weapons ?? []).filter((w) => w.template >= 1809).map((w) => w.id));
  const equipment = (reference, blade = false) =>
    reference === null || (blade ? bladeIds : weaponIds).has(reference);
  if (value.classes !== undefined) {
    check(
      Array.isArray(value.classes) &&
        value.classes.length > 0 &&
        value.classes.length <= CLASS_IDS.length &&
        new Set(value.classes.map((c) => c?.id)).size === value.classes.length &&
        value.classes.every(
          (c) =>
            object(c) &&
            Object.keys(c).every((k) =>
              ['id', 'name', 'description', 'weapon', 'blade', 'bladeFittingPattern'].includes(k),
            ) &&
            CLASS_IDS.includes(c.id) &&
            text(c.name, 100) &&
            text(c.description) &&
            equipment(c.weapon) &&
            equipment(c.blade, true) &&
            (c.bladeFittingPattern === undefined ||
              (typeof c.bladeFittingPattern === 'string' &&
                /^[a-z][a-z0-9_-]{0,79}$/.test(c.bladeFittingPattern))),
        ),
      'clases o equipo local inválidos.',
    );
  }
  function questions(list, ids) {
    return (
      Array.isArray(list) &&
      list.length === ids.length &&
      new Set(list.map((q) => q?.id)).size === ids.length &&
      list.every(
        (q) =>
          object(q) &&
          Object.keys(q).every((k) => ['id', 'label', 'choices'].includes(k)) &&
          ids.includes(q.id) &&
          text(q.label, 200) &&
          Array.isArray(q.choices) &&
          q.choices.length > 0 &&
          q.choices.length <= QUESTION_CHOICES[q.id].length &&
          new Set(q.choices.map((c) => c?.id)).size === q.choices.length &&
          q.choices.every(
            (c) =>
              object(c) &&
              Object.keys(c).length === 2 &&
              QUESTION_CHOICES[q.id].includes(c.id) &&
              text(c.name, 200),
          ),
      )
    );
  }
  if (value.questions !== undefined) {
    check(
      questions(value.questions, ['specialty', 'temperament']),
      'cuestionario personal inválido.',
    );
  }
  if (value.commissionQuestions !== undefined) {
    check(
      questions(value.commissionQuestions, ['origin', 'doctrine', 'crisis']),
      'cuestionario de formación inválido.',
    );
  }
  if (value.traits !== undefined) {
    check(
      Array.isArray(value.traits) &&
        value.traits.length > 0 &&
        value.traits.length <= TRAIT_IDS.length &&
        new Set(value.traits.map((t) => t?.id)).size === value.traits.length &&
        value.traits.every(
          (t) =>
            object(t) &&
            Object.keys(t).length === 3 &&
            TRAIT_IDS.includes(t.id) &&
            text(t.name, 100) &&
            text(t.description),
        ),
      'especialidades inválidas.',
    );
  }
  if (value.defaults !== undefined) {
    const classes = value.classes ?? [{ id: 'gaucho' }];
    check(
      object(value.defaults) &&
        Object.keys(value.defaults).every((k) => ['classId', 'portraitId'].includes(k)) &&
        (value.defaults.classId === undefined ||
          classes.some((c) => c.id === value.defaults.classId)) &&
        (value.defaults.portraitId === undefined ||
          value.defaults.portraitId === null ||
          text(value.defaults.portraitId, 80)),
      'selección inicial inválida.',
    );
  }
  if (value.commission !== undefined) {
    const c = value.commission;
    check(
      object(c) &&
        Object.keys(c).every((k) =>
          [
            'role',
            'biography',
            'questionError',
            'statusText',
            'availableText',
            'weapon',
            'doctrineWeapons',
          ].includes(k),
        ) &&
        ['role', 'biography', 'questionError', 'statusText', 'availableText'].every(
          (k) => c[k] === undefined || text(c[k]),
        ) &&
        (c.weapon === undefined || equipment(c.weapon)) &&
        (c.doctrineWeapons === undefined ||
          (object(c.doctrineWeapons) &&
            Object.entries(c.doctrineWeapons).every(
              ([id, ref]) => TRAIT_IDS.includes(id) && equipment(ref),
            ))),
      'datos de incorporación inválidos.',
    );
  }
  if (value.biography !== undefined) {
    check(text(value.biography, 1000), 'biografía inválida.');
  }
  if (value.registry !== undefined) {
    check(text(value.registry, 100), 'registro inválido.');
  }
  return errors;
}
