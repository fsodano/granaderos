/* global __GRANADEROS_BASE_PATH__ */
const basePath =
  typeof __GRANADEROS_BASE_PATH__ === 'undefined'
    ? ''
    : __GRANADEROS_BASE_PATH__;
const previewScopes = [];
/** @type {Set<() => void>} */
const previewAssetListeners = new Set();
let previewAssetsRevision = 0;
function publishPreviewAssets() {
  previewAssetsRevision++;
  for (const listener of previewAssetListeners) {
    listener();
  }
}
/** Subscribe to editor asset scopes used by browser presentation. @param {() => void} listener */
export function subscribePreviewAssets(listener) {
  previewAssetListeners.add(listener);
  return () => {
    previewAssetListeners.delete(listener);
  };
}
export function getPreviewAssetsRevision() {
  return previewAssetsRevision;
}

/** Private editor assets are presentation URLs only. Definitions retain their
 * portable package paths. The scope disappears when the editor unmounts.
 * @param {Map<string,string>} assets
 */
export function registerPreviewAssets(assets) {
  const scope = { assets };
  previewScopes.push(scope);
  publishPreviewAssets();
  return () => {
    const index = previewScopes.indexOf(scope);
    if (index >= 0) {
      previewScopes.splice(index, 1);
      publishPreviewAssets();
    }
  };
}

/** Apply the hosting path only at the browser boundary. Saved art URLs stay portable.
 * @template {string | null | undefined} T
 * @param {T} path
 * @param {string} [base]
 * @returns {T}
 */
export function sitePath(path, base = basePath) {
  if (typeof path === 'string') {
    for (let index = previewScopes.length - 1; index >= 0; index--) {
      const resolved = previewScopes[index].assets.get(path);
      if (resolved) {
        return /** @type {T} */ (resolved);
      }
    }
  }
  if (
    typeof path !== 'string' ||
    !base ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    return path;
  }
  if (
    path === base ||
    path.startsWith(`${base}/`) ||
    path.startsWith(`${base}?`) ||
    path.startsWith(`${base}#`)
  ) {
    return path;
  }
  return /** @type {T} */ (`${base}${path}`);
}

/** Use directory URLs for the static pages in a project deployment.
 * @param {string} path
 * @param {string} [base]
 */
export function pagePath(path, base = basePath) {
  const url = sitePath(path, base);
  if (!base || !path.startsWith('/') || path.startsWith('//')) {
    return url;
  }
  const boundary = url.search(/[?#]/),
    pathname = boundary < 0 ? url : url.slice(0, boundary),
    suffix = boundary < 0 ? '' : url.slice(boundary);
  return `${pathname.endsWith('/') ? pathname : `${pathname}/`}${suffix}`;
}
