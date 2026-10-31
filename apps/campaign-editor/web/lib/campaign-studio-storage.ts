import { assertCampaignProjectEnvelope } from '../../domain/project-document.ts';
import {
  decodeBase64,
  encodeBase64,
} from '../../../../packages/campaign-format/campaign-resources.js';
import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';
type StoredProject = Omit<CampaignProjectDocument, 'resources'> & {
  resources: Record<string, { type: string; bytes: Blob }>;
};
const DB_NAME = 'granaderos.campaign-studio.v1',
  STORE = 'projects';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(Error('El navegador no permite guardar proyectos. Descargá una copia.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('No se pudo abrir el almacenamiento de proyectos.'));
    request.onblocked = () =>
      reject(Error('Cerrá otras pestañas del editor para actualizar su almacenamiento.'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result: T;
    const request = operation(tx.objectStore(STORE));
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(Error('No se pudo guardar o leer el proyecto. Descargá una copia antes de salir.'));
    };
  });
}
/** Atomic durable record. IndexedDB stores binary Blobs, not localStorage image strings. */
export async function saveStudioProject(project: CampaignProjectDocument): Promise<void> {
  assertCampaignProjectEnvelope(project);
  const value: StoredProject = {
    ...structuredClone(project),
    resources: Object.fromEntries(
      Object.entries(project.resources).map(([path, resource]) => [
        path,
        {
          type: resource.type,
          bytes: new Blob([new Uint8Array(decodeBase64(resource.base64))], { type: resource.type }),
        },
      ]),
    ),
  };
  await transaction('readwrite', (store) => store.put(value, project.manifest.id));
}
export async function loadStudioProjects(): Promise<CampaignProjectDocument[]> {
  const records = await transaction<unknown[]>('readonly', (store) => store.getAll());
  const projects: CampaignProjectDocument[] = [];
  for (const record of records) {
    if (
      typeof record !== 'object' ||
      record === null ||
      !('resources' in record) ||
      typeof record.resources !== 'object' ||
      record.resources === null ||
      Array.isArray(record.resources)
    ) {
      throw Error('El proyecto guardado no contiene recursos válidos.');
    }
    const resources: CampaignProjectDocument['resources'] = {};
    for (const [path, storedResource] of Object.entries(record.resources)) {
      const resource: unknown = storedResource;
      if (
        typeof resource !== 'object' ||
        resource === null ||
        !('bytes' in resource) ||
        !(resource.bytes instanceof Blob) ||
        !('type' in resource) ||
        typeof resource.type !== 'string'
      ) {
        throw Error('Un recurso guardado no contiene bytes válidos.');
      }
      resources[path] = {
        type: resource.type,
        base64: encodeBase64(new Uint8Array(await resource.bytes.arrayBuffer())),
      };
    }
    projects.push(assertCampaignProjectEnvelope({ ...record, resources }));
  }
  return projects.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}
export async function deleteStudioProject(id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(id));
}
