import { sha256Bytes } from './content-identity.js';
export const CAMPAIGN_RESOURCE_LIMITS = Object.freeze({
  files: 4096,
  fileBytes: 16 * 1024 * 1024,
  totalBytes: 128 * 1024 * 1024,
  jsonBytes: 8 * 1024 * 1024,
});
/** @param {Uint8Array} bytes @returns {string} */
export function encodeBase64(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw Error('El recurso necesita bytes válidos.');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  }
  return btoa(binary);
}
/** @param {string} value @returns {Uint8Array} */
export function decodeBase64(value) {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(CAMPAIGN_RESOURCE_LIMITS.fileBytes / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw Error('El recurso contiene bytes codificados inválidos.');
  }
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
/** @param {Uint8Array} bytes @returns {Promise<string>} */
export async function resourceSHA256(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('El recurso necesita bytes válidos.');
  }
  return sha256Bytes(bytes);
}
export const CAMPAIGN_RESOURCE_TYPES = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  json: 'application/json',
});
/** @param {string} path @returns {string | null} */
export function campaignResourceType(path) {
  return CAMPAIGN_RESOURCE_TYPES[path.split('.').at(-1)] ?? null;
}
