const fields = ['version', 'id', 'cell', 'x', 'y', 'crowbarCondition', 'linenShirtCondition'];
const validCondition = (value) => Number.isSafeInteger(value) && value >= 1 && value <= 100;

export function validateRoadsideDiscoveries(definitions, context = {}) {
  if (definitions === undefined) return [];
  if (
    !Array.isArray(definitions) ||
    definitions.length > 1 ||
    Object.keys(definitions).length !== definitions.length
  )
    return ['Hallazgos de camino: se necesita una lista de hasta un hallazgo.'];
  const errors = [];
  for (const definition of definitions) {
    const validRecord =
      definition !== null &&
      typeof definition === 'object' &&
      !Array.isArray(definition) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(definition));
    if (
      !validRecord ||
      Object.keys(definition).length !== fields.length ||
      !fields.every((key) => Object.hasOwn(definition, key)) ||
      definition.version !== 1 ||
      typeof definition.id !== 'string' ||
      !/^[a-z][a-z0-9-]{0,59}$/.test(definition.id) ||
      ['constructor', 'prototype'].includes(definition.id) ||
      typeof definition.cell !== 'string' ||
      !/^cell-([0-9]|[12][0-9]|3[0-5])-([0-9]|[12][0-9]|3[0-2])$/.test(definition.cell) ||
      (context?.world &&
        (!Array.isArray(context.world.cells) ||
          !context.world.cells.some((cell) => cell.id === definition.cell && cell.land))) ||
      !Number.isSafeInteger(definition.x) ||
      !Number.isSafeInteger(definition.y) ||
      definition.x < 0 ||
      definition.y < 0 ||
      definition.x >= 20 ||
      definition.y >= 16 ||
      !validCondition(definition.crowbarCondition) ||
      !validCondition(definition.linenShirtCondition)
    )
      errors.push('Hallazgo de camino: definición o versión inválida.');
  }
  return errors;
}
