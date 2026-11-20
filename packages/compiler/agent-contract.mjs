import fs from 'node:fs';
import path from 'node:path';

export const VALID_PLAN_STATUSES = new Set([
  'Proposed',
  'In progress',
  'Accepted',
  'Deferred',
  'Rejected',
]);

const PREFAB_POLICY_FILE = 'docs/prefab-workflow.md';
/** How a 3D scene is made to look good; `get_quality_route` returns the same route as data. */
const QUALITY_ROUTE_FILE = 'docs/quality-route.md';
const ROUTES_INDEX_FILE = 'docs/routes/README.md';
const ROUTES_TEMPLATE_FILE = 'docs/routes/TEMPLATE.md';
/** What every implementation route must say, so an agent can act on it and knows its limits. */
export const ROUTE_REQUIRED_SECTIONS = [
  '**Id:**',
  '**Kind:**',
  '**For:**',
  '**Checked on:**',
  '**Status:**',
  '## When to take this route',
  '## Tools',
  '## Steps',
  '## Pitfalls',
  '## Engine gaps and their workarounds',
  '## Checks',
  '## Not checked',
  '## Boundaries',
];

/**
 * The two kinds of route. `scene`: one kind of scene, built end to end by a
 * reference consumer. `workflow`: a path every project of its kind takes (a
 * new game, a model from a DCC tool, a film as data), whatever the scene.
 */
export const ROUTE_KINDS = ['workflow', 'scene'];
/** The header every route page carries, in this order, as `- **Name:** value`. */
export const ROUTE_HEADER_FIELDS = [
  'Id',
  'Kind',
  'For',
  'Checked on',
  'Status',
  'Reference consumer',
  'Engine version',
];

/**
 * A route page's header as data: its title, its one-paragraph summary and
 * the header fields (a value may run over indented lines). Pure.
 */
export function parseRoutePage(text) {
  const lines = text.split('\n');
  const title = (lines.find((line) => line.startsWith('# ')) ?? '').replace(/^# (Route: )?/, '');
  const fields = {};
  let current;
  for (const line of lines) {
    if (line.startsWith('## ')) break;
    const match = /^- \*\*([^*]+):\*\*\s*(.*)$/.exec(line);
    if (match) {
      current = match[1];
      fields[current] = match[2].trim();
    } else if (current && /^ {2,}\S/.test(line)) fields[current] += ' ' + line.trim();
    else if (line.trim() === '') current = undefined;
  }
  const first = lines.findIndex((line) => line.startsWith('# '));
  const summary = [];
  for (const line of lines.slice(first + 1)) {
    if (line.startsWith('- **') || line.startsWith('## ')) break;
    summary.push(line.trim());
  }
  const sections = lines.filter((line) => line.startsWith('## ')).map((line) => line.slice(3));
  return {
    title,
    summary: summary.join(' ').replace(/\s+/g, ' ').trim(),
    fields,
    sections,
  };
}

/**
 * Every route of the repository as data, sorted by kind then id: what an
 * agent reads to pick one without opening the pages. The page itself is the
 * source: nothing here is written down twice.
 */
export function listImplementationRoutes(projectRoot) {
  const routesRoot = path.join(projectRoot, 'docs/routes');
  if (!fs.existsSync(routesRoot)) return [];
  return fs
    .readdirSync(routesRoot)
    .filter((file) => file.endsWith('.md') && file !== 'README.md' && file !== 'TEMPLATE.md')
    .map((file) => {
      const page = parseRoutePage(fs.readFileSync(path.join(routesRoot, file), 'utf8'));
      const plain = (value) => (value ?? '').replace(/`/g, '');
      return {
        id: plain(page.fields.Id) || file.replace(/\.md$/, ''),
        kind: plain(page.fields.Kind),
        title: page.title,
        for: page.fields.For ?? '',
        checkedOn: page.fields['Checked on'] ?? '',
        status: page.fields.Status ?? '',
        referenceConsumer: page.fields['Reference consumer'] ?? '',
        engineVersion: page.fields['Engine version'] ?? '',
        document: path.posix.join('docs/routes', file),
      };
    })
    .sort(
      (a, b) =>
        ROUTE_KINDS.indexOf(a.kind) - ROUTE_KINDS.indexOf(b.kind) || a.id.localeCompare(b.id),
    );
}

/** One route: its listing entry and the whole page; undefined for an unknown id. */
export function readImplementationRoute(projectRoot, id) {
  const entry = listImplementationRoutes(projectRoot).find((route) => route.id === id);
  if (!entry) return undefined;
  const text = fs.readFileSync(path.join(projectRoot, entry.document), 'utf8');
  return { ...entry, summary: parseRoutePage(text).summary, text };
}

export const REQUIRED_AGENT_FILES = [
  'AGENTS.md',
  'docs/agent-development.md',
  PREFAB_POLICY_FILE,
  QUALITY_ROUTE_FILE,
  ROUTES_INDEX_FILE,
  ROUTES_TEMPLATE_FILE,
  'docs/plans/README.md',
  'docs/plans/TEMPLATE.md',
  'docs/plans/TASK-TEMPLATE.md',
  'docs/plans/VERIFICATION-TEMPLATE.md',
];

const REQUIRED_MARKERS = [
  ['AGENTS.md', ['npm run verify', 'AssetProvider', 'unverified', 'consumer']],
  [
    'docs/agent-development.md',
    ['TASK-TEMPLATE.md', 'VERIFICATION-TEMPLATE.md', 'UNAVAILABLE', 'stale'],
  ],
];

function readText(root, relativePath) {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function issue(code, file, message, hint) {
  return { code, file, message, hint };
}

/**
 * Validate the repository-level instructions that every coding agent relies
 * on. This deliberately checks content and links, not just file existence.
 */
export function auditAgentContract(projectRoot) {
  const missingFiles = REQUIRED_AGENT_FILES.filter(
    (file) => !fs.existsSync(path.join(projectRoot, file)),
  );
  const issues = missingFiles.map((file) =>
    issue(
      'AGENT_FILE_MISSING',
      file,
      `Required agent contract file is missing: ${file}`,
      `Restore ${file} from the repository contract before accepting agent work.`,
    ),
  );

  for (const [file, markers] of REQUIRED_MARKERS) {
    const text = readText(projectRoot, file);
    for (const marker of markers) {
      if (!text.includes(marker)) {
        issues.push(
          issue(
            'AGENT_CONTRACT_INCOMPLETE',
            file,
            `Agent contract is missing required guidance: ${marker}`,
            `Document the rule in ${file}; do not rely on chat context.`,
          ),
        );
      }
    }
  }

  const plansRoot = path.join(projectRoot, 'docs/plans');
  const planFiles = fs.existsSync(plansRoot)
    ? fs
        .readdirSync(plansRoot)
        .filter(
          (file) =>
            file.endsWith('.md') &&
            file !== 'README.md' &&
            file !== 'TEMPLATE.md' &&
            file !== 'TASK-TEMPLATE.md' &&
            file !== 'VERIFICATION-TEMPLATE.md',
        )
    : [];
  const planStatuses = [];
  for (const file of planFiles) {
    const text = readText(projectRoot, path.join('docs/plans', file));
    const match = text.match(/^Status:\s*(.+?)\s*$/m);
    const status = match?.[1]?.trim() || null;
    planStatuses.push({ file: path.join('docs/plans', file), status });
    if (!status) {
      issues.push(
        issue(
          'PLAN_STATUS_MISSING',
          path.join('docs/plans', file),
          'Every development plan must declare a Status field.',
          'Use one of Proposed, In progress, Accepted, Deferred or Rejected.',
        ),
      );
    } else if (!VALID_PLAN_STATUSES.has(status)) {
      issues.push(
        issue(
          'PLAN_STATUS_INVALID',
          path.join('docs/plans', file),
          `Unknown plan status: ${status}`,
          'Use one of Proposed, In progress, Accepted, Deferred or Rejected.',
        ),
      );
    }
    if (
      status === 'Accepted' &&
      !/##\s+(?:Acceptance gates|Acceptance evidence|Verification)/i.test(text)
    ) {
      issues.push(
        issue(
          'ACCEPTED_PLAN_WITHOUT_GATE',
          path.join('docs/plans', file),
          'An Accepted plan must contain an explicit acceptance or verification section.',
          'Keep the plan Proposed/ In progress until measured evidence is recorded.',
        ),
      );
    }
  }

  const planIndex = readText(projectRoot, 'docs/plans/README.md');
  // The npm package deliberately omits docs/plans/records (task/verification
  // history). When that whole directory is absent, its index links are not
  // broken plans; in a checkout with records every link is still enforced.
  const recordsPublished = fs.existsSync(path.join(plansRoot, 'records'));
  for (const match of planIndex.matchAll(/\]\(([^)]+\.md)\)/g)) {
    const link = match[1];
    if (link.startsWith('http://') || link.startsWith('https://')) continue;
    if (!recordsPublished && link.startsWith('records/')) continue;
    const resolved = path.resolve(plansRoot, link);
    if (!fs.existsSync(resolved)) {
      issues.push(
        issue(
          'PLAN_LINK_BROKEN',
          'docs/plans/README.md',
          `Plan index links to a missing file: ${link}`,
          'Fix the link or add the referenced plan before handoff.',
        ),
      );
    }
  }

  const routes = auditImplementationRoutes(projectRoot);
  issues.push(...routes.issues);

  return {
    passed: issues.length === 0,
    requiredFiles: REQUIRED_AGENT_FILES,
    missingFiles,
    planStatuses,
    routes: routes.routes,
    issues,
  };
}

/**
 * Implementation routes (docs/routes): every route the index links to exists and
 * says when to take it, its steps, pitfalls, checks, what was not checked and its
 * boundaries. Links from a route to other engine guides are not followed here.
 */
export function auditImplementationRoutes(projectRoot) {
  const routesRoot = path.join(projectRoot, 'docs/routes');
  const index = readText(projectRoot, ROUTES_INDEX_FILE);
  const issues = [];
  const routes = [];
  if (!index) return { routes, issues };
  const linked = new Set();
  for (const match of index.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
    const link = match[1];
    if (link.startsWith('http://') || link.startsWith('https://')) continue;
    const resolved = path.resolve(routesRoot, link);
    if (path.dirname(resolved) !== routesRoot) continue;
    linked.add(path.basename(resolved));
    if (!fs.existsSync(resolved))
      issues.push(
        issue(
          'ROUTE_LINK_BROKEN',
          ROUTES_INDEX_FILE,
          `Route index links to a missing route: ${link}`,
          'Fix the link or write the route from docs/routes/TEMPLATE.md.',
        ),
      );
  }
  const files = fs.existsSync(routesRoot)
    ? fs.readdirSync(routesRoot).filter((file) => file.endsWith('.md'))
    : [];
  for (const file of files) {
    if (file === 'README.md' || file === 'TEMPLATE.md') continue;
    const relative = path.join('docs/routes', file);
    const text = readText(projectRoot, relative);
    routes.push(relative);
    if (!linked.has(file))
      issues.push(
        issue(
          'ROUTE_UNLISTED',
          relative,
          `Route is not listed in ${ROUTES_INDEX_FILE}: ${file}`,
          `Add a row for it to the table in ${ROUTES_INDEX_FILE}.`,
        ),
      );
    const page = parseRoutePage(text);
    const id = (page.fields.Id ?? '').replace(/`/g, '');
    if (page.fields.Id !== undefined && id !== file.replace(/\.md$/, ''))
      issues.push(
        issue(
          'ROUTE_ID_MISMATCH',
          relative,
          `Route id ${id} is not its file name ${file}`,
          'A route is docs/routes/<id>.md: make the Id line and the file name the same.',
        ),
      );
    const kind = (page.fields.Kind ?? '').replace(/`/g, '');
    if (page.fields.Kind !== undefined && !ROUTE_KINDS.includes(kind))
      issues.push(
        issue(
          'ROUTE_KIND_INVALID',
          relative,
          `Route kind ${kind} is not one of: ${ROUTE_KINDS.join(', ')}`,
          'Use scene for one kind of scene built by a reference consumer, workflow for a path every project of its kind takes.',
        ),
      );
    for (const section of ROUTE_REQUIRED_SECTIONS)
      if (!text.includes(section))
        issues.push(
          issue(
            'ROUTE_SECTION_MISSING',
            relative,
            `Route is missing: ${section}`,
            `Add ${section} as in ${ROUTES_TEMPLATE_FILE}; a route says what it does not claim.`,
          ),
        );
  }
  return { routes, issues };
}

const TASK_ARRAY_FIELDS = [
  'invariants',
  'dependencies',
  'nonGoals',
  'acceptance',
  'evidence',
  'unverifiedLimits',
];
const TASK_SCOPE_FIELDS = ['engine', 'consumer'];

/** Validate the serializable task contract used by agents and MCP clients. */
export function validateTaskSpec(value) {
  const issues = [];
  const task = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!task) {
    return {
      passed: false,
      issues: [{ field: 'task', code: 'TASK_OBJECT_REQUIRED', message: 'task must be an object' }],
    };
  }
  for (const field of ['id', 'source', 'goal']) {
    if (typeof task[field] !== 'string' || task[field].trim() === '') {
      issues.push({
        field,
        code: 'TASK_FIELD_REQUIRED',
        message: `${field} must be a non-empty string`,
      });
    }
  }
  for (const field of TASK_ARRAY_FIELDS) {
    if (!Array.isArray(task[field])) {
      issues.push({ field, code: 'TASK_ARRAY_REQUIRED', message: `${field} must be an array` });
    }
  }
  for (const field of ['invariants', 'acceptance', 'nonGoals', 'unverifiedLimits']) {
    if (Array.isArray(task[field]) && task[field].length === 0) {
      issues.push({
        field,
        code: 'TASK_ARRAY_EMPTY',
        message: `${field} must contain at least one explicit entry`,
      });
    }
  }
  if (!task.scope || typeof task.scope !== 'object' || Array.isArray(task.scope)) {
    issues.push({
      field: 'scope',
      code: 'TASK_SCOPE_REQUIRED',
      message: 'scope must contain engine and consumer arrays',
    });
  } else {
    for (const field of TASK_SCOPE_FIELDS) {
      if (!Array.isArray(task.scope[field])) {
        issues.push({
          field: `scope.${field}`,
          code: 'TASK_SCOPE_ARRAY_REQUIRED',
          message: `scope.${field} must be an array`,
        });
      }
    }
  }
  for (const field of TASK_ARRAY_FIELDS) {
    if (
      Array.isArray(task[field]) &&
      task[field].some((entry) => typeof entry !== 'string' || entry.trim() === '')
    ) {
      issues.push({
        field,
        code: 'TASK_ARRAY_ENTRY_INVALID',
        message: `${field} entries must be non-empty strings`,
      });
    }
  }
  if (task.scope && typeof task.scope === 'object' && !Array.isArray(task.scope)) {
    for (const field of TASK_SCOPE_FIELDS) {
      if (
        Array.isArray(task.scope[field]) &&
        task.scope[field].some((entry) => typeof entry !== 'string' || entry.trim() === '')
      ) {
        issues.push({
          field: `scope.${field}`,
          code: 'TASK_SCOPE_ENTRY_INVALID',
          message: `scope.${field} entries must be non-empty strings`,
        });
      }
    }
  }
  if (
    task.status !== undefined &&
    (typeof task.status !== 'string' || !VALID_PLAN_STATUSES.has(task.status))
  ) {
    issues.push({
      field: 'status',
      code: 'TASK_STATUS_INVALID',
      message: 'status must use a documented plan status',
    });
  }
  return { passed: issues.length === 0, issues };
}

export function getAgentContract(projectRoot) {
  const audit = auditAgentContract(projectRoot);
  return {
    contractVersion: 1,
    repository: 'zhuda-laya-engine',
    passed: audit.passed,
    consumerRoute: 'docs/consumer-route.md',
    qualityRoute: QUALITY_ROUTE_FILE,
    implementationRoutes: ROUTES_INDEX_FILE,
    // Every route, to pick one from without opening a page: `list_routes` returns
    // the same, `get_route { id }` the page.
    routes: listImplementationRoutes(projectRoot).map(
      ({ id, kind, for: purpose, checkedOn, document }) => ({
        id,
        kind,
        for: purpose,
        checkedOn,
        document,
      }),
    ),
    requiredReading: [...REQUIRED_AGENT_FILES],
    commands: [
      'node packages/compiler/zhuda-init.mjs /absolute/path/to/consumer',
      'npm run verify',
      'git diff --check',
      'git status --short',
    ],
    workflow: [
      'read-contract',
      'follow-consumer-route',
      'write-task-spec',
      'inventory-assets-and-boundaries',
      'add-failing-fixture',
      'implement-smallest-change',
      'test-failure-and-lifecycle-paths',
      'run-verification',
      'write-verification-record',
    ],
    visualWorkflow: {
      appliesTo: 'New or changed consumer visual content, including procedural presets.',
      policyFile: PREFAB_POLICY_FILE,
      stages: [
        'inventory-assets',
        'author-prefab',
        'verify-isolated-nodes',
        'compose-approved-prefabs',
        'verify-consumer-scene',
      ],
      isolatedSelection: ['prefab ID', 'stable child path', 'state and deterministic inputs'],
      evidence: [
        'dependency revisions',
        'replay command and environment',
        'source reference',
        'actual draw',
        'comparison result',
      ],
      beforeComposition:
        'Require current passing isolated evidence for every required child and composed prefab. A changed dependency invalidates affected evidence.',
      integration:
        'Keep the isolated entry point runnable. The scene instantiates the same verified definition.',
      enforcement:
        'Agent workflow. Doctor checks the engine contract files; it does not approve consumer visuals.',
      consumerTools: {
        previewConfig: 'prefabPreview',
        evidenceConfig: 'prefabEvidence',
        browserCheck:
          'node packages/compiler/prefab-check.mjs --url=... --baseline=... --output=...',
        doctor: 'node packages/compiler/zhuda-doctor.mjs --project /absolute/consumer',
        scope:
          'Static 2D hierarchy with declared image dependencies. Consumer scenes expose the actual-instance report bridge.',
      },
    },
    boundaries: {
      engine: ['public runtime APIs', 'types', 'compiler', 'MCP', 'diagnostics', 'engine fixtures'],
      consumer: [
        'game rules',
        'network authority',
        'art/assets',
        'game-specific scenes/effects',
        'deployment',
      ],
      rule: 'Adapters cross the boundary through public contracts; consumer source paths and private engine implementation imports are forbidden.',
    },
    evidenceRules: [
      'A validator result proves configuration only, not pixels or device performance.',
      'Unavailable browser/device checks remain UNAVAILABLE and prevent Accepted status.',
      'Plan status Accepted requires explicit acceptance/verification evidence.',
      'Async resources must cover cancellation, timeout, stale completion, retry and disposal.',
    ],
    audit,
  };
}
