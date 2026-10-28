import { pagePath } from '../../../web/game-preview-assets.js';

declare const __GRANADEROS_GAME_BASE_PATH__: string;

export function gamePath(path: string): string {
  return pagePath(path, __GRANADEROS_GAME_BASE_PATH__);
}
