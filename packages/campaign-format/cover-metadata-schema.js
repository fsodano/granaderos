export function validateCoverMetadata(value) {
  for (const [key, max] of [
    ['obstacleHeight', 10],
    ['projectileResistance', 1000],
    ['concealment', 100],
  ]) {
    if (
      value[key] !== undefined &&
      (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > max)
    )
      throw Error('La cobertura guardada no es válida.');
  }
}
