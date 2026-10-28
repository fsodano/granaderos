export function createGameSessionId() {
  return globalThis.crypto.randomUUID();
}
