export function requestedPrefabCycles(url) {
  const cycles = Number(new URL(url).searchParams.get('cycles') || 0);
  if (!Number.isSafeInteger(cycles) || cycles < 0 || cycles > 100)
    throw Error('Invalid preview cycle count (0..100)');
  return cycles;
}

/** A pixel match never substitutes for a completed lifecycle request. */
export function auditPrefabLifecycle(report, url) {
  const requestedCycles = requestedPrefabCycles(url);
  const issues = [];
  const params = new URL(url).searchParams;
  for (const key of ['id', 'state', 'node']) {
    if (params.has(key) && (report?.selection?.[key] ?? '') !== params.get(key))
      issues.push(`selection.${key} does not match request`);
  }
  if (report?.provenance && (report.selection?.id !== report.provenance.id ||
      report.selection?.state !== report.provenance.state)) issues.push('Instance provenance differs from selection');
  const check = report?.lifecycleCheck;
  if (requestedCycles || check) {
    if (!check || check.requestedCycles !== requestedCycles ||
        check.completedCycles !== requestedCycles || check.status !== 'complete')
      issues.push(`Lifecycle incomplete: requested ${requestedCycles}, completed ${check?.completedCycles ?? 'unknown'}`);
    if (!Array.isArray(report?.lifecycle) || report.lifecycle.length !== requestedCycles ||
        report.lifecycle.some(r => r.instances !== 0 || r.references !== 0 || r.pending !== 0 ||
          (r.shared3D && (r.shared3D.references !== 0 || r.shared3D.pending !== 0))))
      issues.push('Lifecycle disposal counts missing or nonzero');
    if (requestedCycles && (!check?.before || !check?.after ||
        JSON.stringify(check.before) !== JSON.stringify(check.after)))
      issues.push('Lifecycle resource snapshots missing or changed');
  }
  return { passed: issues.length === 0, requestedCycles, completedCycles: check?.completedCycles ?? 0, issues };
}
