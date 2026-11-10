import crypto from 'node:crypto';
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const within = (file, prefix) => file === prefix || file.startsWith(prefix + '/');
export function validatePrefabComponents(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('prefabComponents must be an ID map');
  for (const [id, entry] of Object.entries(value)) {
    if (!id || !entry || typeof entry.entry !== 'string')
      throw Error(`prefabComponents.${id}: entry is required`);
    for (const key of Object.keys(entry))
      if (!['entry', 'assets', 'dependsOn'].includes(key))
        throw Error(`prefabComponents.${id}: unknown ${key}`);
    for (const file of [entry.entry, ...(entry.assets || [])])
      if (
        typeof file !== 'string' ||
        !file ||
        file.startsWith('/') ||
        /[\\:*?\0]/.test(file) ||
        file.split('/').some((p) => !p || p === '.' || p === '..')
      )
        throw Error(`prefabComponents.${id}: invalid relative dependency ${file}`);
    if (entry.assets !== undefined && !Array.isArray(entry.assets))
      throw Error(`prefabComponents.${id}: assets must be an array`);
    if (entry.dependsOn !== undefined && !Array.isArray(entry.dependsOn))
      throw Error(`prefabComponents.${id}: dependsOn must be an array`);
    for (const child of entry.dependsOn || [])
      if (!Object.hasOwn(value, child))
        throw Error(`prefabComponents.${id}: unknown child ${child}`);
  }
  return value;
}

/** Fingerprints emitted component code + runtime + shell + assets; parent edges add child proofs. */
export function buildPrefabDependencies(payload, components = {}, bundles = {}) {
  validatePrefabComponents(components);
  const result = Object.create(null),
    visiting = new Set();
  const visit = (id) => {
    if (result[id]) return result[id];
    if (visiting.has(id)) throw Error(`prefabComponents.${id}: dependency cycle`);
    visiting.add(id);
    const component = components[id];
    const children = Object.fromEntries(
      [...(component.dependsOn || [])].sort().map((child) => [child, visit(child).fingerprint]),
    );
    for (const asset of component.assets || [])
      if (!payload.some((file) => within(file.path, 'assets/' + asset)))
        throw Error(`prefabComponents.${id}: asset absent from payload: ${asset}`);
    const files = payload
      .filter((file) => {
        if (file.path === 'app.js' || file.path === 'index.html') return false;
        if (file.path === 'prefab-preview.js' || file.path.startsWith('prefab-component-'))
          return file.path === bundles[id];
        if (file.path.startsWith('assets/') && component.assets !== undefined)
          return component.assets.some((asset) => within(file.path, 'assets/' + asset));
        return true;
      })
      .map(({ path, sha256 }) => ({ path, sha256 }))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (!files.some((file) => file.path === bundles[id]))
      throw Error(`prefabComponents.${id}: missing emitted bundle`);
    const proof = { id, bundle: bundles[id], files, children };
    result[id] = { ...proof, fingerprint: sha(proof) };
    visiting.delete(id);
    return result[id];
  };
  for (const id of Object.keys(components).sort()) visit(id);
  return { schemaVersion: 1, components: result };
}

/** Unverifiable/external loads keep legacy whole-payload evidence. */
export function selectPrefabDependencyProof(manifest, report, requests, url) {
  const proof = manifest.prefabDependencies?.components?.[report.selection?.id];
  if (!proof || report.componentId !== proof.id) return null;
  const base = new URL('.', url),
    hashes = new Map(proof.files.map((file) => [file.path, file.sha256]));
  if (!requests.some((request) => request === new URL(proof.bundle, base).href)) return null;
  for (const request of requests) {
    const resource = new URL(request);
    if (resource.protocol === 'data:' || resource.protocol === 'blob:') continue;
    if (resource.origin !== base.origin || !resource.pathname.startsWith(base.pathname))
      return null;
    const relative = decodeURIComponent(resource.pathname.slice(base.pathname.length));
    if (relative === 'payload-manifest.json') continue;
    if (!hashes.has(relative)) return null;
  }
  for (const [id, hash] of Object.entries(report.provenance?.sources || {}))
    if (hashes.get('assets/' + id) !== hash) return null;
  return proof;
}

export function prefabEvidenceMatches(evidence, fingerprint, dependencies) {
  const proof = dependencies?.components?.[evidence.selection?.id];
  if (evidence.dependencyProof)
    return Boolean(
      proof &&
        evidence.dependencyProof.id === evidence.selection.id &&
        evidence.dependencyProof.fingerprint === proof.fingerprint &&
        JSON.stringify(evidence.dependencyProof) === JSON.stringify(proof),
    );
  return evidence.fingerprint === fingerprint;
}
