// Rebuild production custom portraits from the checked-in generated originals.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'web/package.json'));
const sharp = require('sharp');
const portraits = JSON.parse(await readFile(resolve(root, 'assets/prompts/custom-portraits.json'), 'utf8'));
const manifest = [];

for (const portrait of portraits) {
  const filename = `${portrait.id}.webp`;
  const output = await sharp(resolve(root, portrait.source))
    .resize(384, 384, { fit: 'cover' })
    .webp({ quality: 86 })
    .toBuffer();

  for (const base of ['assets/web', 'web/public/art']) {
    await mkdir(resolve(root, base), { recursive: true });
    await writeFile(resolve(root, base, filename), output);
  }

  manifest.push({
    id: portrait.id,
    file: `/art/${filename}`,
    source: portrait.source,
    size: [384, 384],
    bytes: output.length,
    sha256: createHash('sha256').update(output).digest('hex'),
    fictional: true,
    method: portrait.method,
  });
}

for (const base of ['assets/web', 'web/public/art']) {
  await writeFile(resolve(root, base, 'custom-portraits.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`Built ${manifest.length} custom portraits.`);
