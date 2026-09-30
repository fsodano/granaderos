export const MAX_SAVE_BYTES = 5_000_000;
const utf8 = new TextEncoder();

export function saveByteLength(text) { return utf8.encode(text).byteLength; }

export function assertSaveSize(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES || saveByteLength(text) > MAX_SAVE_BYTES) {
    throw Error('El archivo de campaña es demasiado grande. El límite es de 5 MB.');
  }
  return text;
}
