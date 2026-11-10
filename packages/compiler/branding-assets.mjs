import fs from 'node:fs';
import path from 'node:path';
import { normalizeBranding } from './branding.mjs';

/** Build-time custom logos are embedded, independent of asset allowlists. */
export function resolveConsumerBranding(projectRoot, value) {
  const config = normalizeBranding(value);
  if (config.mode !== 'custom') return config;
  const relative = config.logo;
  if (
    !relative ||
    path.isAbsolute(relative) ||
    /[\\:\0?#]/.test(relative) ||
    relative.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw Error('branding.logo must be a normalized project-relative image path');
  let file = projectRoot;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('branding.logo cannot contain symlinks');
  }
  const mime = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }[path.extname(file).toLowerCase()];
  if (!mime || !fs.statSync(file).isFile() || fs.statSync(file).size > 2_000_000)
    throw Error('branding.logo requires SVG/PNG/JPEG/WebP up to 2 MB');
  return { ...config, logo: `data:${mime};base64,${fs.readFileSync(file).toString('base64')}` };
}
