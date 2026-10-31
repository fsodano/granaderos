import { refreshCampaignAssets } from './refresh-campaign-assets.mjs';
// Rebuild production portraits from the checked-in source manifest.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'apps/web/package.json'));
const sharp = require('sharp');
const rows = JSON.parse(
  await readFile(resolve(root, 'content/assets/prompts/mercenary-portraits.json'), 'utf8'),
);
const manifest = [];
for (const row of rows) {
  const source = resolve(root, row.source),
    filename = `portrait-${row.id}.webp`;
  const output = await sharp(source)
    .resize(384, 384, { fit: 'cover' })
    .webp({ quality: 86 })
    .toBuffer();
  for (const base of ['content/assets/web', 'content/campaigns/granaderos/assets']) {
    await mkdir(resolve(root, base), { recursive: true });
    await writeFile(resolve(root, base, filename), output);
  }
  manifest.push({
    id: row.id,
    file: `/campaigns/granaderos/assets/${filename}`,
    source: row.source,
    size: [384, 384],
    bytes: output.length,
    sha256: createHash('sha256').update(output).digest('hex'),
    fictional: true,
  });
}
await writeFile(
  resolve(root, 'content/assets/web/mercenary-portraits.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
await copyFile(
  resolve(root, 'content/assets/web/mercenary-portraits.json'),
  resolve(root, 'content/campaigns/granaderos/assets/mercenary-portraits.json'),
);
console.log(`Built ${manifest.length} mercenary portraits.`);

await refreshCampaignAssets(root);
