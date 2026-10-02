/* global __GRANADEROS_BASE_PATH__ */
const basePath = typeof __GRANADEROS_BASE_PATH__ === 'undefined' ? '' : __GRANADEROS_BASE_PATH__;

/** Apply the hosting path only at the browser boundary. Saved art URLs stay portable.
 * @template {string | null | undefined} T
 * @param {T} path
 * @param {string} [base]
 * @returns {T}
 */
export function sitePath(path, base = basePath) {
 if (typeof path !== 'string' || !base || !path.startsWith('/') || path.startsWith('//')) return path;
 if (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`) || path.startsWith(`${base}#`)) return path;
 return /** @type {T} */ (`${base}${path}`);
}

/** Use directory URLs for the static pages in a project deployment.
 * @param {string} path
 * @param {string} [base]
 */
export function pagePath(path, base = basePath) {
 const url = sitePath(path, base);
 if (!base || !path.startsWith('/') || path.startsWith('//')) return url;
 const boundary = url.search(/[?#]/), pathname = boundary < 0 ? url : url.slice(0, boundary), suffix = boundary < 0 ? '' : url.slice(boundary);
 return `${pathname.endsWith('/') ? pathname : `${pathname}/`}${suffix}`;
}
