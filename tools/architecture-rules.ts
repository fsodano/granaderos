/** Reported when a player-interface file reaches past the game public surface. */
export const interfaceImportRule =
  'The player interface depends only on game public entries and browser compositions.';

const gameImplementationLayers = [
  'packages/game/domain',
  'packages/game/application',
  'packages/game/infrastructure',
];

function pathWithin(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

/**
 * Decide whether a repository-relative file may import a repository-relative
 * target. Files outside the player interface may import anything; files under
 * `apps/web/app` may not import a game domain, application, or infrastructure
 * module.
 */
export function interfaceFileMayImport(file: string, target: string): boolean {
  if (!pathWithin(file, 'apps/web/app')) {
    return true;
  }
  return !gameImplementationLayers.some((layer) => pathWithin(target, layer));
}
