import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function setting(name) {
  try {
    return git(['config', '--get', name]);
  } catch (error) {
    if (error.status === 1) {
      return '';
    }
    throw error;
  }
}

const current = setting('core.hooksPath');
if (current && current !== '.githooks') {
  console.log(
    `Existing hooks retained: ${current}. Add npm run verify:commit and npm run verify:quick to those hooks.`,
  );
} else {
  // A relative hooks path follows each worktree's checked-out hook version.
  git(['config', '--local', 'core.hooksPath', '.githooks']);
  console.log('Repository hooks installed: commit checks and pre-push verification.');
}
