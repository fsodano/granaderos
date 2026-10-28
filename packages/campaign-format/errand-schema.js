export const QUEST_RESOURCES = ['treasury'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value) =>
  typeof value === 'string' &&
  /^[a-z][a-z0-9_-]{0,99}$/.test(value) &&
  !['constructor', 'prototype'].includes(value);
const text = (value, maximum) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const integer = (value, minimum, maximum) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;
export function validateErrandDefinitions(quests, content = {}) {
  const world = content.world ?? {};
  const sector = (id) => (world.sectors ?? []).some((value) => value.id === id);
  const cityForSector = (id) => (world.cities ?? []).find((city) => city.sectors.includes(id));
  if (!Array.isArray(quests) || quests.length > 200)
    return ['Encargos: se necesita una lista de hasta 200 encargos.'];
  const errors = [],
    ids = new Set(),
    contacts = new Set();
  const check = (ok, id, message) => {
    if (!ok) errors.push(`Encargo ${id}: ${message}`);
  };
  for (const quest of quests) {
    if (!object(quest)) {
      errors.push('Encargos: registro inválido.');
      continue;
    }
    check(
      identifier(quest.id) && !ids.has(quest.id),
      quest.id,
      'identificador inválido o repetido.',
    );
    ids.add(quest.id);
    check(identifier(quest.npcId), quest.id, 'contacto inválido.');
    check(
      Object.keys(quest).every((field) =>
        [
          'id',
          'npcId',
          'sector',
          'title',
          'offer',
          'delivery',
          'cost',
          'requiredSectors',
          'carried',
          'escort',
          'requires',
          'reward',
          'rewardChoice',
          'beneficiaries',
          'withdrawal',
        ].includes(field),
      ),
      quest.id,
      'campo desconocido.',
    );
    check(sector(quest.sector), quest.id, 'localidad inexistente.');
    check(
      text(quest.title, 120) && text(quest.offer, 800) && text(quest.delivery, 800),
      quest.id,
      'revisá el título y los textos (120 y 800 caracteres).',
    );
    check(
      object(quest.cost) &&
        Object.entries(quest.cost).every(
          ([field, value]) => QUEST_RESOURCES.includes(field) && integer(value, 1, 10000),
        ),
      quest.id,
      'recursos de entrega inválidos.',
    );
    check(
      Array.isArray(quest.requiredSectors) &&
        quest.requiredSectors.every(sector) &&
        new Set(quest.requiredSectors).size === quest.requiredSectors.length,
      quest.id,
      'localidades requeridas inválidas.',
    );
    check(
      quest.requires === undefined ||
        (Array.isArray(quest.requires) &&
          quest.requires.every(identifier) &&
          new Set(quest.requires).size === quest.requires.length),
      quest.id,
      'encargos previos inválidos.',
    );
    check(
      quest.reward === undefined ||
        (object(quest.reward) &&
          Object.keys(quest.reward).length === 2 &&
          integer(quest.reward.treasury, 0, 10000) &&
          typeof quest.reward.loyalty === 'boolean'),
      quest.id,
      'recompensa inválida.',
    );
    check(
      !quest.reward?.loyalty || cityForSector(quest.sector),
      quest.id,
      'esa localidad no registra lealtad; desactivá esa recompensa.',
    );
    if (quest.rewardChoice !== undefined) {
      check(
        object(quest.rewardChoice) &&
          Object.keys(quest.rewardChoice).length === 1 &&
          Object.hasOwn(quest.rewardChoice, 'reimbursement') &&
          integer(quest.rewardChoice.reimbursement, 1, 10000),
        quest.id,
        'el reintegro necesita un importe entero de 1 a 10000 pesos.',
      );
      check(
        Boolean(quest.carried) && !quest.escort && Boolean(cityForSector(quest.sector)),
        quest.id,
        'la elección de recompensa necesita una entrega física en una ciudad.',
      );
      check(
        quest.reward === undefined ||
          (quest.reward?.treasury === 0 && quest.reward?.loyalty === false),
        quest.id,
        'la elección de recompensa no admite una recompensa automática.',
      );
    }
    if (quest.withdrawal !== undefined) {
      check(
        object(quest.withdrawal) &&
          Object.keys(quest.withdrawal).length === 1 &&
          integer(quest.withdrawal.supportCost, 1, 20),
        quest.id,
        'el retiro necesita un costo entero de apoyo local de 1 a 20.',
      );
      check(
        Boolean(quest.carried) &&
          integer(quest.carried.count, 2, 100) &&
          !quest.escort &&
          (quest.beneficiaries
            ? Array.isArray(quest.beneficiaries) &&
              quest.beneficiaries.every(
                (beneficiary) => object(beneficiary) && cityForSector(beneficiary.sector),
              )
            : Boolean(cityForSector(quest.sector))),
        quest.id,
        'el retiro necesita una entrega física de al menos dos objetos con destinatarios en ciudades.',
      );
    }
    if (quest.beneficiaries !== undefined) {
      check(
        Array.isArray(quest.beneficiaries) &&
          quest.beneficiaries.length === 2 &&
          [...quest.beneficiaries].every(object),
        quest.id,
        'elegí exactamente dos destinatarios distintos.',
      );
      if (Array.isArray(quest.beneficiaries) && [...quest.beneficiaries].every(object)) {
        const branches = new Set(),
          recipients = new Set();
        for (const beneficiary of quest.beneficiaries) {
          check(
            Object.keys(beneficiary).length === 5 &&
              ['id', 'npcId', 'sector', 'delivery', 'reward'].every((field) =>
                Object.hasOwn(beneficiary, field),
              ) &&
              identifier(beneficiary.id) &&
              !branches.has(beneficiary.id) &&
              identifier(beneficiary.npcId) &&
              !recipients.has(beneficiary.npcId) &&
              sector(beneficiary.sector) &&
              text(beneficiary.delivery, 800) &&
              object(beneficiary.reward) &&
              Object.keys(beneficiary.reward).length === 2 &&
              integer(beneficiary.reward.treasury, 0, 10000) &&
              typeof beneficiary.reward.loyalty === 'boolean' &&
              (!beneficiary.reward.loyalty || cityForSector(beneficiary.sector)),
            quest.id,
            'destinatario o recompensa inválidos.',
          );
          branches.add(beneficiary.id);
          recipients.add(beneficiary.npcId);
        }
        check(
          quest.beneficiaries.some(
            (beneficiary) =>
              beneficiary.npcId === quest.npcId && beneficiary.sector === quest.sector,
          ),
          quest.id,
          'el contacto principal debe ser uno de los destinatarios en su localidad.',
        );
      }
      check(
        Boolean(quest.carried) &&
          quest.escort === undefined &&
          quest.rewardChoice === undefined &&
          (quest.reward === undefined ||
            (quest.reward?.treasury === 0 && quest.reward?.loyalty === false)),
        quest.id,
        'los destinatarios necesitan una entrega física sin otra recompensa o escolta.',
      );
    }
    const contactIds =
      quest.beneficiaries === undefined
        ? [quest.npcId]
        : Array.isArray(quest.beneficiaries)
          ? quest.beneficiaries.filter(object).map((beneficiary) => beneficiary.npcId)
          : [];
    for (const id of contactIds) {
      check(!contacts.has(id), quest.id, 'elegí un contacto distinto para cada encargo.');
      contacts.add(id);
    }
    if (quest.carried !== undefined) {
      const carried = quest.carried;
      check(
        object(carried) &&
          Object.keys(carried).length === 4 &&
          text(carried.label, 80) &&
          text(carried.instruction, 800) &&
          integer(carried.count, 1, 100) &&
          ((identifier(carried.item) && carried.outfit === undefined) ||
            (identifier(carried.outfit) && carried.item === undefined)),
        quest.id,
        'objeto de entrega inválido.',
      );
    }
    if (quest.escort !== undefined) {
      const escort = quest.escort;
      check(
        object(escort) &&
          Object.keys(escort).length === 2 &&
          sector(escort.destination) &&
          ['N', 'E', 'S', 'W'].includes(escort.edge),
        quest.id,
        'la escolta necesita una localidad existente y un borde válido.',
      );
    }
    check(
      !(quest.carried && quest.escort) &&
        (!(quest.carried || quest.escort) ||
          (object(quest.cost) && Object.keys(quest.cost).length === 0)),
      quest.id,
      'usá una sola forma de entrega.',
    );
  }
  if (errors.length) return errors;
  for (const quest of quests)
    for (const id of quest.requires ?? [])
      check(ids.has(id), quest.id, 'el encargo previo no existe.');
  const visiting = new Set(),
    done = new Set(),
    byId = new Map(quests.map((quest) => [quest.id, quest]));
  function visit(id) {
    if (visiting.has(id)) return false;
    if (done.has(id)) return true;
    visiting.add(id);
    for (const dependency of byId.get(id)?.requires ?? []) if (!visit(dependency)) return false;
    visiting.delete(id);
    done.add(id);
    return true;
  }
  check(
    quests.every((quest) => visit(quest.id)),
    'secuencia',
    'hay un ciclo entre encargos previos.',
  );
  return errors;
}

export function validateErrandContactReferences(content) {
  if (!Array.isArray(content.errands)) return [];
  const errors = [];
  const characters = Array.isArray(content.characters) ? content.characters : [];
  const placements = Array.isArray(content.placements) ? content.placements : [];
  for (const quest of content.errands) {
    if (!object(quest)) continue;
    const contacts =
      quest.beneficiaries === undefined
        ? [quest.npcId]
        : Array.isArray(quest.beneficiaries)
          ? quest.beneficiaries.filter(object).map((beneficiary) => beneficiary.npcId)
          : [];
    for (const contactId of contacts) {
      if (typeof contactId !== 'string' || !contactId.startsWith('authored-')) continue;
      const characterId = contactId.slice('authored-'.length);
      if (
        !characters.some((character) => character?.id === characterId) ||
        !placements.some((placement) => placement?.character === characterId)
      ) {
        errors.push(`Encargo ${quest.id}: el contacto no existe o no aparece en el mapa.`);
      }
    }
  }
  return errors;
}
