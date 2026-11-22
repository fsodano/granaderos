/** Reported when a player-interface file reaches past the game public surface. */
export const interfaceImportRule =
  'The player interface depends only on game public entries and browser compositions.';

/** Reported when the game package reaches into the player application. */
export const gameImportRule = 'The game package is independent of the player application.';

const gameImplementationLayers = [
  'packages/game/domain',
  'packages/game/application',
  'packages/game/infrastructure',
];

/** A retained compatibility module sits directly inside `packages/game`. */
const retainedGameModule = /^packages\/game\/[^/]+$/;

function pathWithin(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

/**
 * Decide whether a repository-relative file may import a repository-relative
 * target. Files outside the player interface may import anything. No file under
 * `apps/web` may import a retained compatibility module from the root of
 * `packages/game`. Files under `apps/web/app` may not import a game domain,
 * application, or infrastructure module either; `apps/web/lib` is the browser
 * composition and may.
 */
export function interfaceFileMayImport(file: string, target: string): boolean {
  if (!pathWithin(file, 'apps/web')) {
    return true;
  }
  if (retainedGameModule.test(target)) {
    return false;
  }
  if (!pathWithin(file, 'apps/web/app')) {
    return true;
  }
  return !gameImplementationLayers.some((layer) => pathWithin(target, layer));
}

/**
 * Decide whether a file under `packages/game` may import a repository-relative
 * target. The game is independent of the player application, so it may not
 * import anything under `apps/web`. Files outside `packages/game` are unaffected
 * by this direction.
 */
export function gameFileMayImport(file: string, target: string): boolean {
  if (!pathWithin(file, 'packages/game')) {
    return true;
  }
  return !pathWithin(target, 'apps/web');
}
