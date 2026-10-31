import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Generation tools update the campaign's one production asset manifest.
export async function refreshCampaignAssets(root, id = 'granaderos') {
  return refreshCampaignAssetFolder(join(root, 'content/campaigns', id));
}
export async function refreshCampaignAssetFolder(directory, manifestFile = 'assets.json') {
  const assets = [],
    ids = new Set();
  let previous = [];
  try {
    previous = JSON.parse(await readFile(join(directory, manifestFile), 'utf8')).assets ?? [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  async function collect(folder, path = 'assets') {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = join(folder, entry.name),
        relative = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        await collect(file, relative);
      } else if (entry.isFile()) {
        const type = entry.name.endsWith('.webp')
          ? 'image/webp'
          : entry.name.endsWith('.png')
            ? 'image/png'
            : /\.jpe?g$/.test(entry.name)
              ? 'image/jpeg'
              : entry.name.endsWith('.json')
                ? 'application/json'
                : null;
        if (!type) {
          throw Error(`Unsupported campaign asset: ${relative}`);
        }
        const id =
          previous.find((asset) => asset.path === relative)?.id ??
          `asset-${relative
            .slice(7)
            .replace(/\.[^.]+$/, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')}`;
        if (ids.has(id)) {
          throw Error(`Repeated campaign asset id: ${id}`);
        }
        ids.add(id);
        assets.push({
          id,
          path: relative,
          sha256: createHash('sha256')
            .update(await readFile(file))
            .digest('hex'),
          type,
        });
      } else {
        throw Error(`Campaign assets must be regular files: ${relative}`);
      }
    }
  }
  await collect(join(directory, 'assets'));
  await writeFile(
    join(directory, manifestFile),
    JSON.stringify({ version: 1, assets }, null, 2) + '\n',
  );
  return assets;
}
