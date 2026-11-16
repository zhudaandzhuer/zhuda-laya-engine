/**
 * What a fly-through measured, against a frame budget, and the critic's
 * report on its pictures. Pure: no renderer, usable in Node and in a page.
 *
 * A fly-through (`runZhudaFlythrough`) draws a scene along a camera path
 * frame by frame and times each frame: the CPU time spent submitting it and,
 * where the browser gives one, the GPU time (WebGPU timestamps, WebGL's
 * disjoint timer query). `summarizeZhudaFlythrough` turns the frames into
 * average, p99 and max and checks them against a budget. GPU time that was
 * not measured is reported as unavailable with the reason, never as 0, and
 * a GPU limit that could not be checked makes the result `unavailable`, not
 * a pass.
 *
 * The critic: fixed poses of the same run, and a short recording, go to a
 * reviewer that sees only the pictures (an agent or a person) with
 * `zhudaCriticBrief`, and returns defects ranked by severity.
 * `gateZhudaCriticReport` proposes a gate: no defect above minor. That is a
 * proposal for a person to accept, not a pass by itself.
 */

/** One timed frame of a fly-through. */
export interface ZhudaFlythroughFrame {
  index: number;
  /** Seconds along the camera path. */
  time: number;
  /** Time spent on the CPU drawing (submitting) the frame. */
  cpuMs: number;
  /** GPU time of the frame, when measured. */
  gpuMs?: number;
  drawCalls?: number;
  triangles?: number;
}

/** Limits in milliseconds; any left out is not checked. */
export interface ZhudaFlythroughBudget {
  cpuAverageMs?: number;
  cpuP99Ms?: number;
  cpuMaxMs?: number;
  gpuAverageMs?: number;
  gpuP99Ms?: number;
  gpuMaxMs?: number;
}

export type ZhudaFlythroughLimit = keyof ZhudaFlythroughBudget;

export interface ZhudaFlythroughStats {
  averageMs: number;
  p99Ms: number;
  maxMs: number;
  /** The frame of the maximum. */
  maxAt: { index: number; time: number };
}

export interface ZhudaFlythroughSummary {
  frames: number;
  cpu: ZhudaFlythroughStats;
  gpu:
    | ({ available: true; timed: number } & ZhudaFlythroughStats)
    | { available: false; timed: number; reason: string };
  /** Limits exceeded, with the frames over a p99 or max limit (at most 20, slowest first). */
  over: {
    limit: ZhudaFlythroughLimit;
    limitMs: number;
    valueMs: number;
    frames: { index: number; time: number; ms: number }[];
  }[];
  /** Limits asked for that could not be checked (GPU time not measured). */
  unchecked: ZhudaFlythroughLimit[];
  /** `fail` when a measured limit is exceeded; `unavailable` when one could not be checked; else `pass`. */
  status: 'pass' | 'fail' | 'unavailable';
}

/** Value at the p quantile, nearest rank (as `ZhudaRuntimeProfiler` reports it). */
function quantile(sorted: readonly number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

function stats(frames: readonly ZhudaFlythroughFrame[], pick: (f: ZhudaFlythroughFrame) => number) {
  const values = frames.map(pick);
  const sorted = [...values].sort((a, b) => a - b);
  let at = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[at]) at = i;
  return {
    averageMs: values.reduce((sum, v) => sum + v, 0) / values.length,
    p99Ms: quantile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1],
    maxAt: { index: frames[at].index, time: frames[at].time },
  };
}

const LIMITS: readonly ZhudaFlythroughLimit[] = [
  'cpuAverageMs',
  'cpuP99Ms',
  'cpuMaxMs',
  'gpuAverageMs',
  'gpuP99Ms',
  'gpuMaxMs',
];

/** Lists what is wrong with a budget; empty when it is valid. */
export function validateZhudaFlythroughBudget(budget: unknown): string[] {
  if (budget === undefined) return [];
  if (!budget || typeof budget !== 'object' || Array.isArray(budget))
    return ['budget: an object of limits in milliseconds'];
  const issues: string[] = [];
  for (const [key, value] of Object.entries(budget)) {
    if (!LIMITS.includes(key as ZhudaFlythroughLimit))
      issues.push(`budget.${key}: not a limit (use ${LIMITS.join(', ')})`);
    else if (typeof value !== 'number' || !(value > 0 && value <= 10000))
      issues.push(`budget.${key}: milliseconds above 0`);
  }
  return issues;
}

/**
 * Average, p99 and max of the CPU and GPU times of a fly-through, checked
 * against `budget`. `gpuReason` says why GPU time is missing when no frame
 * has one. Frames must be in order and at least one.
 */
export function summarizeZhudaFlythrough(
  frames: readonly ZhudaFlythroughFrame[],
  options: { budget?: ZhudaFlythroughBudget; gpuReason?: string } = {},
): ZhudaFlythroughSummary {
  if (!Array.isArray(frames) || !frames.length) throw Error('Fly-through: no frames');
  for (const f of frames)
    if (
      !Number.isFinite(f?.cpuMs) ||
      f.cpuMs < 0 ||
      (f.gpuMs !== undefined && !(Number.isFinite(f.gpuMs) && f.gpuMs >= 0))
    )
      throw Error('Fly-through: frame times must be finite and not negative');
  const budget = options.budget ?? {};
  const issues = validateZhudaFlythroughBudget(budget);
  if (issues.length) throw Error('Fly-through: ' + issues.join('; '));
  const timed = frames.filter((f) => f.gpuMs !== undefined);
  const cpu = stats(frames, (f) => f.cpuMs);
  const gpu: ZhudaFlythroughSummary['gpu'] = timed.length
    ? { available: true, timed: timed.length, ...stats(timed, (f) => f.gpuMs!) }
    : {
        available: false,
        timed: 0,
        reason: options.gpuReason || 'no GPU time was measured',
      };
  const over: ZhudaFlythroughSummary['over'] = [];
  const unchecked: ZhudaFlythroughLimit[] = [];
  const slowest = (
    list: readonly ZhudaFlythroughFrame[],
    pick: (f: ZhudaFlythroughFrame) => number,
    limit: number,
  ) =>
    list
      .filter((f) => pick(f) > limit)
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, 20)
      .map((f) => ({ index: f.index, time: f.time, ms: pick(f) }));
  for (const limit of LIMITS) {
    const limitMs = budget[limit];
    if (limitMs === undefined) continue;
    const onGpu = limit.startsWith('gpu');
    if (onGpu && !gpu.available) {
      unchecked.push(limit);
      continue;
    }
    const s = onGpu ? (gpu as ZhudaFlythroughStats) : cpu;
    const average = limit.endsWith('AverageMs');
    const valueMs = average ? s.averageMs : limit.endsWith('P99Ms') ? s.p99Ms : s.maxMs;
    if (valueMs > limitMs)
      over.push({
        limit,
        limitMs,
        valueMs,
        frames: average
          ? []
          : onGpu
            ? slowest(timed, (f) => f.gpuMs!, limitMs)
            : slowest(frames, (f) => f.cpuMs, limitMs),
      });
  }
  return {
    frames: frames.length,
    cpu,
    gpu,
    over,
    unchecked,
    status: over.length ? 'fail' : unchecked.length ? 'unavailable' : 'pass',
  };
}

/** What a critic looks for, in the brief and in its report. */
export const ZHUDA_CRITIC_DEFECTS = [
  'shimmer',
  'aliasing',
  'popping',
  'banding',
  'flat-light',
  'noise',
  'clipping',
  'other',
] as const;
export type ZhudaCriticDefectKind = (typeof ZHUDA_CRITIC_DEFECTS)[number];
export const ZHUDA_CRITIC_SEVERITIES = ['minor', 'major', 'critical'] as const;
export type ZhudaCriticSeverity = (typeof ZHUDA_CRITIC_SEVERITIES)[number];

export interface ZhudaCriticDefect {
  kind: ZhudaCriticDefectKind;
  severity: ZhudaCriticSeverity;
  /** The picture it shows in (a file name from the brief). */
  picture: string;
  /** Where in the picture and what it looks like. */
  where: string;
}

export interface ZhudaCriticReport {
  schemaVersion: 1;
  /** Who looked: an agent's model, or a person. */
  critic: string;
  /** The pictures it was given, by file name. */
  pictures: string[];
  /** Ranked, most severe first. */
  defects: ZhudaCriticDefect[];
}

/**
 * The brief handed to a critic with the pictures and nothing else: no
 * scene file, no code, no intended look. It names what to look for, the
 * severities and the report's format.
 */
export function zhudaCriticBrief(
  pictures: readonly string[],
  options: { recording?: string } = {},
): string {
  if (!Array.isArray(pictures) || !pictures.length) throw Error('Critic brief: no pictures');
  return [
    'You are reviewing rendered pictures of a real-time 3D scene. You get only the pictures;',
    'judge what you see, not what was meant.',
    '',
    'Pictures (fixed camera poses of one run):',
    ...pictures.map((p) => `- ${p}`),
    ...(options.recording
      ? [
          '',
          `Recording of the same camera move: ${options.recording} (look for flicker, popping and shimmer over time).`,
        ]
      : []),
    '',
    `Look for: ${ZHUDA_CRITIC_DEFECTS.join(', ')}.`,
    '- shimmer: edges or fine detail that crawl or sparkle between frames.',
    '- aliasing: stair-stepped edges, moire on fine patterns.',
    '- popping: objects, shadows or detail that appear or vanish abruptly.',
    '- banding: visible steps in smooth gradients (sky, fog, falloff).',
    '- flat-light: no shape from light, missing contact shadows, a scene without depth.',
    '- noise: grain or speckle that does not belong to the look.',
    '- clipping: large areas burnt to white or crushed to black.',
    '',
    'Severity: minor (seen only when looking for it), major (a viewer notices it),',
    'critical (it breaks the picture: wrong colour, missing geometry, black frames).',
    '',
    'Reply with JSON only:',
    '{"schemaVersion":1,"critic":"<who you are>","pictures":[<the file names above>],',
    ' "defects":[{"kind":"<one of the kinds>","severity":"minor|major|critical",',
    '   "picture":"<file name>","where":"<where in the picture, what it looks like>"}]}',
    'Rank defects most severe first. An empty list is allowed only if you found nothing.',
  ].join('\n');
}

/** Lists what is wrong with a critic's report; empty when it is valid. */
export function validateZhudaCriticReport(value: unknown, pictures?: readonly string[]): string[] {
  const issues: string[] = [];
  const v = value as Partial<ZhudaCriticReport> | null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['report: an object'];
  if (v.schemaVersion !== 1) issues.push('schemaVersion: 1');
  if (typeof v.critic !== 'string' || !v.critic.trim()) issues.push('critic: who looked');
  if (
    !Array.isArray(v.pictures) ||
    !v.pictures.length ||
    !v.pictures.every((p) => typeof p === 'string')
  )
    issues.push('pictures: the file names the critic was given');
  if (!Array.isArray(v.defects)) issues.push('defects: a list (empty when none)');
  else
    v.defects.forEach((d, i) => {
      const at = `defects[${i}]`;
      if (!d || typeof d !== 'object') return void issues.push(`${at}: an object`);
      if (!ZHUDA_CRITIC_DEFECTS.includes(d.kind))
        issues.push(`${at}.kind: one of ${ZHUDA_CRITIC_DEFECTS.join(', ')}`);
      if (!ZHUDA_CRITIC_SEVERITIES.includes(d.severity))
        issues.push(`${at}.severity: minor, major or critical`);
      if (
        typeof d.picture !== 'string' ||
        (Array.isArray(v.pictures) && !v.pictures.includes(d.picture))
      )
        issues.push(`${at}.picture: one of the pictures`);
      if (typeof d.where !== 'string' || !d.where.trim())
        issues.push(`${at}.where: what and where`);
      if (
        i > 0 &&
        ZHUDA_CRITIC_SEVERITIES.indexOf(d.severity) >
          ZHUDA_CRITIC_SEVERITIES.indexOf(v.defects![i - 1]?.severity as ZhudaCriticSeverity)
      )
        issues.push(`${at}: defects are ranked most severe first`);
    });
  if (pictures && Array.isArray(v.pictures)) {
    const missing = pictures.filter((p) => !v.pictures!.includes(p));
    if (missing.length) issues.push(`pictures: not reviewed: ${missing.join(', ')}`);
  }
  return issues;
}

/**
 * The gate the critic proposes: `minor-only` when no defect is above minor,
 * else `blocked` with the defects that block. A report that does not
 * validate is `invalid`. `minor-only` is a proposal for a person to accept.
 */
export function gateZhudaCriticReport(
  value: unknown,
  pictures?: readonly string[],
): {
  status: 'minor-only' | 'blocked' | 'invalid';
  issues: string[];
  blocking: ZhudaCriticDefect[];
} {
  const issues = validateZhudaCriticReport(value, pictures);
  if (issues.length) return { status: 'invalid', issues, blocking: [] };
  const blocking = (value as ZhudaCriticReport).defects.filter((d) => d.severity !== 'minor');
  return { status: blocking.length ? 'blocked' : 'minor-only', issues: [], blocking };
}
