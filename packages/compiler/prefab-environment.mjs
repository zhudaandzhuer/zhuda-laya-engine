/** Browser viewport and design canvas are separate CSS-pixel measurements. */
export function requestedPrefabEnvironment(url, options = {}) {
  const params = new URL(url).searchParams;
  const value = (key, fallback) => Number(options[key] ?? params.get(key) ?? fallback);
  const width = value('width', 640), height = value('height', 360);
  const viewportWidth = value('viewportWidth', width), viewportHeight = value('viewportHeight', height);
  const dpr = value('dpr', 1), renderDpr = value('renderDpr', dpr);
  if (![width, height, viewportWidth, viewportHeight].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 4096) ||
      ![dpr, renderDpr].every(n => Number.isFinite(n) && n >= .5 && n <= 3) || renderDpr > dpr)
    throw Error('Invalid requested viewport/canvas/DPR (dimensions: 1..4096, DPR: 0.5..3, renderDpr <= dpr)');
  return { viewport: { width: viewportWidth, height: viewportHeight }, canvas: {width,height}, dpr, renderDpr };
}

/** This function is serialized into the browser; keep it self-contained. */
export function measurePrefabEnvironment() {
  const canvas = document.querySelector('canvas');
  const rect = canvas?.getBoundingClientRect();
  const stage = globalThis.Laya?.stage;
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio,
    canvas: canvas && rect ? {
      css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      backing: { width: canvas.width, height: canvas.height },
    } : null,
    stage: stage ? { width: stage.width, height: stage.height, scaleX: stage.clientScaleX, scaleY: stage.clientScaleY } : null,
  };
}

export function auditPrefabEnvironment(requested, measured) {
  const issues = [];
  try {
    requestedPrefabEnvironment('http://localhost/', {
      width: requested?.canvas?.width, height: requested?.canvas?.height,
      viewportWidth: requested?.viewport?.width, viewportHeight: requested?.viewport?.height,
      dpr: requested?.dpr, renderDpr: requested?.renderDpr,
    });
  } catch (error) { issues.push(error.message); }
  const same = (name, expected, actual, tolerance = .01) => {
    if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(expected - actual) > tolerance)
      issues.push(`${name}: requested ${expected}, measured ${actual}`);
  };
  same('viewport.width', requested?.viewport?.width, measured?.viewport?.width);
  same('viewport.height', requested?.viewport?.height, measured?.viewport?.height);
  same('devicePixelRatio', requested?.dpr, measured?.dpr);
  for (const axis of ['width', 'height']) {
    same(`canvas.css.${axis}`, requested?.canvas?.[axis], measured?.canvas?.css?.[axis]);
    same(`canvas.backing.${axis}`, Math.round(requested?.canvas?.[axis] * requested?.renderDpr), measured?.canvas?.backing?.[axis], 1);
  }
  for (const key of ['width','height','scaleX','scaleY']) {
    if (!Number.isFinite(measured?.stage?.[key]) || measured.stage[key] <= 0) issues.push(`stage.${key}: invalid or missing measured value`);
  }
  // Canvas resolution alone cannot establish design-space correctness: the
  // former runtime doubled stage.width at DPR 2 and halved every CSS element.
  for (const [axis, scale] of [['width','scaleX'], ['height','scaleY']]) {
    same(`stage.design.${axis}`, requested?.canvas?.[axis], measured?.stage?.[axis]);
    same(`stage.${scale}`, measured?.canvas?.backing?.[axis] / requested?.canvas?.[axis], measured?.stage?.[scale]);
  }
  return { requested, measured, passed: issues.length === 0, issues };
}
