export const verificationStages = Object.freeze({
  commit: ['check:format', 'lint', 'check:architecture', 'check:dependencies'],
  push: [
    'check:format',
    'lint',
    'check:architecture',
    'check:dependencies',
    'typecheck',
    'test',
    'audit:dependencies',
    'audit:docs',
    'audit:baseline',
  ],
  full: [
    'check:format',
    'lint',
    'check:architecture',
    'check:dependencies',
    'typecheck',
    'test',
    'audit:dependencies',
    'audit:docs',
    'audit:baseline',
    'build',
  ],
});

export function stagesFor(profile: string): string[] {
  const match = Object.entries(verificationStages).find(([name]) => name === profile);
  if (!match) {
    throw new Error('Choose the commit, push, or full verification profile.');
  }
  return [...match[1]];
}

export function runStages(stages: readonly string[], run: (stage: string) => number): number {
  for (const stage of stages) {
    const status = run(stage);
    if (status !== 0) {
      return status;
    }
  }
  return 0;
}
