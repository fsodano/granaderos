/** Return the root or project path used by the static web deployment. */
export function normalizeBasePath(value = process.env.GRANADEROS_BASE_PATH ?? '') {
 if (value === '' || value === '/') return '';
 if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw Error('GRANADEROS_BASE_PATH must be an absolute path such as /granaderos.');
 const path = value.replace(/\/+$/, '');
 if (!path.split('/').slice(1).every(part => /^[a-zA-Z0-9._~-]+$/.test(part) && part !== '.' && part !== '..')) throw Error('GRANADEROS_BASE_PATH contains an invalid path segment.');
 return path;
}
