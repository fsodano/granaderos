const SIDES = ['player', 'enemy', 'neutral'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => {
  throw new Error(message);
};
function safeKey(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    // eslint-disable-next-line no-control-regex -- Reject control characters in authored text/IDs.
    !/[<>\x00-\x1f]/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function number(value, low, high, message) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
    fail(message);
}
function validateStoredItemRecord(stack) {
  if (!object(stack) || typeof stack.item !== 'string') fail('El objeto transferido no es válido.');
  if (!Number.isSafeInteger(stack.count) || stack.count < 1 || stack.count > 1000000)
    fail('La cantidad debe ser un entero válido.');
  if (stack.instanceId !== undefined) {
    if (!safeKey(stack.instanceId)) fail('La clave del objeto no es válida.');
    if (stack.count > 1) fail('Un objeto identificado debe conservarse por separado.');
  }
}

export function validateEnvironmentRecord(target) {
  if (!object(target) || !['door', 'chest', 'container'].includes(target.type))
    fail('El objeto del entorno no es válido.');
  for (const key of ['open', 'locked', 'broken'])
    if (target[key] !== undefined && typeof target[key] !== 'boolean')
      fail('El estado del cierre no es válido.');
  for (const key of ['keyId'])
    if (target[key] !== undefined && !safeKey(target[key]))
      fail('La identificación de la llave no es válida.');
  for (const key of ['lockDifficulty', 'lockIntegrity'])
    if (target[key] !== undefined)
      number(target[key], 0, 100, 'La resistencia del cierre no es válida.');
  if ((target.open && target.locked) || (target.broken && target.locked))
    fail('El cierre tiene estados incompatibles.');
  if (target.trap !== undefined) {
    const trap = target.trap;
    if (!object(trap) || !['alarm', 'injury'].includes(trap.type)) fail('La trampa no es válida.');
    number(trap.difficulty, 0, 100, 'La dificultad de la trampa no es válida.');
    if (trap.armed !== undefined && typeof trap.armed !== 'boolean')
      fail('El estado de la trampa no es válido.');
    if (
      trap.discoveredBy !== undefined &&
      (!Array.isArray(trap.discoveredBy) ||
        new Set(trap.discoveredBy).size !== trap.discoveredBy.length ||
        trap.discoveredBy.some((side) => !SIDES.includes(side)))
    )
      fail('El conocimiento de la trampa no es válido.');
    for (const key of ['damage', 'breathLoss'])
      if (trap[key] !== undefined)
        number(trap[key], 0, 100, 'El efecto de la trampa no es válido.');
  }
  if (target.contents !== undefined) {
    if (!Array.isArray(target.contents) || target.contents.length > 1000)
      fail('El contenido del recipiente no es válido.');
    const identities = new Set();
    for (const stack of target.contents) {
      validateStoredItemRecord(stack);
      if (stack.instanceId !== undefined) {
        if (identities.has(stack.instanceId))
          fail('El recipiente contiene un objeto identificado repetido.');
        identities.add(stack.instanceId);
      }
    }
  }
  return true;
}
