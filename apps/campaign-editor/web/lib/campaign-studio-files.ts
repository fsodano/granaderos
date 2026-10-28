import { Inflate, zipSync } from 'fflate';
import { campaignRelativePath } from '../../../../packages/campaign-format/campaign-assets.js';
import { validateCampaignManifest } from '../../../../packages/campaign-format/campaign-manifest.js';
import {
  CAMPAIGN_RESOURCE_LIMITS as CAMPAIGN_PROJECT_LIMITS,
  campaignResourceType,
  decodeBase64,
  encodeBase64,
} from '../../../../packages/campaign-format/campaign-resources.js';
import {
  assertCampaignProjectEnvelope,
  campaignMapFile,
  encodeCampaignProject,
  decodeCampaignProject,
} from '../../domain/project-document.js';
import { validateCampaignProject } from '../../infrastructure/project-validation.js';
import { sitePath } from '../../../web/game-preview-assets.js';
import type { CampaignEntry } from './campaign-library.ts';

import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';
export type CampaignFileRecord = { path: string; bytes: Uint8Array; type?: string };
export { encodeCampaignProject, decodeCampaignProject };
export const encodeStudioProject = encodeCampaignProject,
  decodeStudioProject = decodeCampaignProject;
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
const safePath = (path: string) => campaignRelativePath(path);
function fail(message: string): never {
  throw Error(message);
}
const bytesCopy = (value: Uint8Array) => new Uint8Array(value);
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function jsonBytes(value: any) {
  return encoder.encode(JSON.stringify(value, null, 2) + '\n');
}

/** Import either a directory selection or an extracted package folder. Invalid content remains editable. */
export async function importCampaignFiles(
  records: CampaignFileRecord[],
): Promise<CampaignProjectDocument> {
  if (!Array.isArray(records) || !records.length || records.length > CAMPAIGN_PROJECT_LIMITS.files)
    fail('Elegí una carpeta de campaña con una cantidad válida de archivos.');
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (const record of records) {
    if (!record || !safePath(record.path) || !(record.bytes instanceof Uint8Array))
      fail('La carpeta contiene una ruta o archivo inválido.');
    if (files.has(record.path)) fail(`El archivo ${record.path} está repetido.`);
    if (record.bytes.length > CAMPAIGN_PROJECT_LIMITS.fileBytes)
      fail(`El archivo ${record.path} es demasiado grande.`);
    if (!/\.(json|png|jpg|jpeg|webp)$/.test(record.path))
      fail(`El archivo ${record.path} tiene un tipo no admitido.`);
    total += record.bytes.length;
    if (total > CAMPAIGN_PROJECT_LIMITS.totalBytes)
      fail('La carpeta de campaña es demasiado grande.');
    files.set(record.path, bytesCopy(record.bytes));
  }
  const manifests = [...files.keys()].filter(
    (path) => path === 'manifest.json' || path.endsWith('/manifest.json'),
  );
  if (manifests.length !== 1) fail('La carpeta debe contener exactamente un manifest.json.');
  const manifestPath = manifests[0],
    prefix = manifestPath.slice(0, -'manifest.json'.length);
  if ([...files.keys()].some((path) => !path.startsWith(prefix)))
    fail('La selección contiene archivos de otra carpeta.');
  const local = new Map(
    [...files.entries()].map(([path, bytes]) => [path.slice(prefix.length), bytes]),
  );
  const used = new Set<string>(),
    readJSON = (path: string) => {
      if (!safePath(path) || !path.endsWith('.json')) fail(`La ruta JSON ${path} no es válida.`);
      if (used.has(path)) fail(`El documento ${path} ocupa más de una sección.`);
      used.add(path);
      const bytes = local.get(path);
      if (!bytes) fail(`Falta el documento ${path}.`);
      if (bytes.length > CAMPAIGN_PROJECT_LIMITS.jsonBytes)
        fail(`El documento ${path} es demasiado grande.`);
      try {
        return JSON.parse(decoder.decode(bytes));
      } catch {
        fail(`El documento ${path} no contiene JSON válido.`);
      }
    };
  const manifest = readJSON('manifest.json');
  validateCampaignManifest(manifest);
  const content = readJSON(manifest.content),
    world = readJSON(manifest.world),
    presentation = readJSON(manifest.presentation),
    mapIndex = readJSON(manifest.maps),
    assets = readJSON(manifest.assets),
    maps: Record<string, any> = {};
  if (!mapIndex || !Array.isArray(mapIndex.maps)) fail('Falta el índice de mapas.');
  for (const entry of mapIndex.maps) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      !safePath(entry.id) ||
      entry.id.includes('/') ||
      ['constructor', 'prototype', '__proto__'].includes(entry.id) ||
      Object.hasOwn(maps, entry.id)
    )
      fail('El índice contiene una identidad de mapa inválida o repetida.');
    maps[entry.id] = readJSON(campaignMapFile(manifest, entry.path));
  }
  const resources: CampaignProjectDocument['resources'] = {};
  for (const [path, bytes] of local) {
    if (used.has(path)) continue;
    const type = campaignResourceType(path);
    if (!path.startsWith('assets/') || !type)
      fail(`El archivo ${path} no pertenece a un documento o recurso del paquete.`);
    resources[path] = { type, base64: encodeBase64(bytes) };
  }
  return assertCampaignProjectEnvelope({
    format: 'granaderos-editor-project',
    version: 1,
    manifest,
    content,
    world,
    presentation,
    maps,
    mapIndex,
    assets,
    resources,
  }) as CampaignProjectDocument;
}

/** The exact installable folder bytes, with no editor metadata or runtime origin. */
export async function campaignProjectFiles(
  project: CampaignProjectDocument,
): Promise<CampaignFileRecord[]> {
  const validation = await validateCampaignProject(project);
  if (!validation.valid)
    fail(
      `No se puede descargar una campaña inválida:\n${validation.issues.map((issue) => issue.message).join('\n')}`,
    );
  const files: CampaignFileRecord[] = [
    { path: 'manifest.json', bytes: jsonBytes(project.manifest) },
  ];
  for (const key of ['content', 'world', 'presentation', 'assets'] as const)
    files.push({ path: project.manifest[key], bytes: jsonBytes(project[key]) });
  files.push({ path: project.manifest.maps, bytes: jsonBytes(project.mapIndex) });
  for (const entry of project.mapIndex.maps)
    files.push({
      path: campaignMapFile(project.manifest, entry.path),
      bytes: jsonBytes(project.maps[entry.id]),
    });
  for (const [path, resource] of Object.entries(project.resources))
    files.push({ path, bytes: decodeBase64(resource.base64), type: resource.type });
  return files;
}

/** ZIP guards are checked before DEFLATE allocates output. ZIP64 and encrypted archives are not admitted. */
export function campaignArchiveEntries(bytes: Uint8Array) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 22 ||
    bytes.length > CAMPAIGN_PROJECT_LIMITS.totalBytes
  )
    fail('El ZIP está vacío o es demasiado grande.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    u16 = (offset: number) => view.getUint16(offset, true),
    u32 = (offset: number) => view.getUint32(offset, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) {
      end = i;
      break;
    }
  if (end < 0) fail('El archivo no contiene un directorio ZIP válido.');
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10))
    fail('Los ZIP divididos no están admitidos.');
  const count = u16(end + 10),
    directorySize = u32(end + 12),
    directoryOffset = u32(end + 16);
  if (
    count === 65535 ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    count > CAMPAIGN_PROJECT_LIMITS.files * 2 ||
    directoryOffset + directorySize !== end
  )
    fail('El directorio ZIP excede los límites o usa ZIP64.');
  const entries: {
      path: string;
      size: number;
      crc: number;
      compression: number;
      start: number;
      compressedSize: number;
    }[] = [],
    seen = new Set<string>();
  let offset = directoryOffset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) fail('El directorio ZIP está incompleto.');
    const flags = u16(offset + 8),
      compression = u16(offset + 10),
      crc = u32(offset + 16),
      compressedSize = u32(offset + 20),
      size = u32(offset + 24),
      nameLength = u16(offset + 28),
      extraLength = u16(offset + 30),
      commentLength = u16(offset + 32),
      disk = u16(offset + 34),
      attrs = u32(offset + 38),
      localOffset = u32(offset + 42),
      next = offset + 46 + nameLength + extraLength + commentLength;
    if (
      next > end ||
      flags & 1 ||
      flags & 0x2040 ||
      disk ||
      ![0, 8].includes(compression) ||
      [size, compressedSize, localOffset].includes(0xffffffff)
    )
      fail('El ZIP contiene una entrada cifrada, dividida o no admitida.');
    let path: string;
    try {
      path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    } catch {
      fail('El ZIP contiene un nombre de archivo inválido.');
    }
    const directory = path.endsWith('/'),
      normalized = directory ? path.slice(0, -1) : path;
    if (!safePath(normalized) || seen.has(normalized))
      fail(`El ZIP contiene una ruta inválida o repetida: ${path}.`);
    seen.add(normalized);
    const unixType = (attrs >>> 16) & 0xf000;
    if (unixType && unixType !== 0x8000 && unixType !== 0x4000)
      fail(`El ZIP contiene un enlace o archivo especial: ${path}.`);
    if (
      (!directory && unixType === 0x4000) ||
      (directory && unixType === 0x8000) ||
      size > CAMPAIGN_PROJECT_LIMITS.fileBytes ||
      (!directory && entries.length >= CAMPAIGN_PROJECT_LIMITS.files)
    )
      fail(`El archivo ${path} excede los límites.`);
    total += size;
    if (total > CAMPAIGN_PROJECT_LIMITS.totalBytes) fail('El ZIP expandido es demasiado grande.');
    if (
      localOffset + 30 > directoryOffset ||
      u32(localOffset) !== 0x04034b50 ||
      u16(localOffset + 6) !== flags ||
      u16(localOffset + 8) !== compression
    )
      fail('La cabecera local ZIP no coincide con su directorio.');
    const localNameLength = u16(localOffset + 26),
      localExtraLength = u16(localOffset + 28),
      start = localOffset + 30 + localNameLength + localExtraLength;
    if (
      start + compressedSize > directoryOffset ||
      decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)) !== path
    )
      fail('La entrada ZIP no coincide con su archivo.');
    if (
      !(flags & 8) &&
      (u32(localOffset + 14) !== crc ||
        u32(localOffset + 18) !== compressedSize ||
        u32(localOffset + 22) !== size)
    )
      fail('El tamaño local ZIP no coincide con su directorio.');
    if (directory) {
      if (size || crc || compressedSize > 128 || (compression === 0 && compressedSize))
        fail('El ZIP contiene una carpeta inválida.');
      if (compression === 8)
        new Inflate((chunk) => {
          if (chunk.length) fail('La carpeta ZIP contiene datos de archivo.');
        }).push(bytes.subarray(start, start + compressedSize), true);
      offset = next;
      continue;
    }
    entries.push({ path, size, crc, compression, start, compressedSize });
    offset = next;
  }
  if (offset !== end || !entries.length) fail('El directorio ZIP no contiene archivos válidos.');
  return entries;
}
export async function importCampaignArchive(bytes: Uint8Array): Promise<CampaignProjectDocument> {
  const entries = campaignArchiveEntries(bytes),
    records: CampaignFileRecord[] = [];
  for (const entry of entries) {
    const input = bytes.subarray(entry.start, entry.start + entry.compressedSize);
    let output: Uint8Array;
    if (entry.compression === 0) output = bytesCopy(input);
    else {
      const chunks: Uint8Array[] = [];
      let length = 0;
      const inflater = new Inflate((chunk) => {
        length += chunk.length;
        if (length > entry.size || length > CAMPAIGN_PROJECT_LIMITS.fileBytes)
          fail(`El archivo ${entry.path} excede el tamaño declarado.`);
        chunks.push(bytesCopy(chunk));
      });
      for (let offset = 0; offset < input.length; offset += 1024)
        inflater.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length);
      output = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
    }
    if (output.length !== entry.size || crc32(output) !== entry.crc)
      fail(`El archivo ${entry.path} está incompleto o cambió dentro del ZIP.`);
    records.push({ path: entry.path, bytes: output });
  }
  return importCampaignFiles(records);
}
export async function exportCampaignArchive(project: CampaignProjectDocument): Promise<Uint8Array> {
  const records = await campaignProjectFiles(project),
    files: Record<string, Uint8Array> = Object.create(null);
  for (const record of records) files[`${project.manifest.id}/${record.path}`] = record.bytes;
  return zipSync(files, { level: 1, mtime: new Date(1980, 0, 1, 0, 0, 0) });
}
export async function loadInstalledCampaignProject(
  entry: CampaignEntry,
  { reader = fetch, signal }: { reader?: typeof fetch; signal?: AbortSignal } = {},
): Promise<CampaignProjectDocument> {
  if (entry.manifest !== `${entry.id}/manifest.json`)
    fail('La entrada de campaña tiene una ruta inválida.');
  const base = `/campaigns/${entry.id}`,
    records: CampaignFileRecord[] = [],
    read = async (path: string) => {
      if (!safePath(path)) fail('La campaña tiene una ruta inválida.');
      const response = await reader(sitePath(`${base}/${path}`), { signal });
      if (!response.ok) fail(`No se pudo cargar ${path} (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      records.push({ path, bytes });
      return bytes;
    };
  const manifest = JSON.parse(decoder.decode(await read('manifest.json')));
  validateCampaignManifest(manifest);
  if (
    manifest.id !== entry.id ||
    manifest.name !== entry.name ||
    manifest.revision !== entry.revision
  )
    fail('El índice y la campaña no coinciden.');
  const index = JSON.parse(decoder.decode(await read(manifest.maps))),
    assets = JSON.parse(decoder.decode(await read(manifest.assets)));
  if (!Array.isArray(index.maps) || !Array.isArray(assets.assets))
    fail('Falta el índice de mapas o recursos.');
  const paths = [
    manifest.content,
    manifest.world,
    manifest.presentation,
    ...index.maps.map((map: any) => campaignMapFile(manifest, map.path)),
    ...assets.assets.map((asset: any) => asset.path),
  ];
  for (let i = 0; i < paths.length; i += 4) await Promise.all(paths.slice(i, i + 4).map(read));
  const project = await importCampaignFiles(records),
    report = await validateCampaignProject(project);
  if (!report.valid) fail(report.issues.map((issue) => issue.message).join('\n'));
  return project;
}
