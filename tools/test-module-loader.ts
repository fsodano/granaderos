import type { ResolveHook } from 'node:module';

const webPackage = new URL('../apps/web/package.json', import.meta.url).href;

// Tests use the same runtime packages as the application, including constructor identity.
export const resolve: ResolveHook = (specifier, context, nextResolve) => {
  if (
    ['three', 'react', 'react-dom', 'jsdom', 'fake-indexeddb'].some(
      (name) => specifier === name || specifier.startsWith(`${name}/`),
    )
  ) {
    return nextResolve(specifier, { ...context, parentURL: webPackage });
  }
  return nextResolve(specifier, context);
};
