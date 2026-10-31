import fs from 'node:fs';
import path from 'node:path';

export const VALID_PLAN_STATUSES = new Set([
  'Proposed',
  'In progress',
  'Accepted',
  'Deferred',
  'Rejected'
]);

export const REQUIRED_AGENT_FILES = [
  'AGENTS.md',
  'docs/agent-development.md',
  'docs/plans/README.md',
  'docs/plans/TEMPLATE.md',
  'docs/plans/TASK-TEMPLATE.md',
  'docs/plans/VERIFICATION-TEMPLATE.md'
];

const REQUIRED_MARKERS = [
  ['AGENTS.md', ['npm run verify', 'AssetProvider', 'unverified', 'consumer']],
  ['docs/agent-development.md', ['TASK-TEMPLATE.md', 'VERIFICATION-TEMPLATE.md', 'UNAVAILABLE', 'stale']]
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
  const missingFiles = REQUIRED_AGENT_FILES.filter((file) => !fs.existsSync(path.join(projectRoot, file)));
  const issues = missingFiles.map((file) => issue(
    'AGENT_FILE_MISSING',
    file,
    `Required agent contract file is missing: ${file}`,
    `Restore ${file} from the repository contract before accepting agent work.`
  ));

  for (const [file, markers] of REQUIRED_MARKERS) {
    const text = readText(projectRoot, file);
    for (const marker of markers) {
      if (!text.includes(marker)) {
        issues.push(issue(
          'AGENT_CONTRACT_INCOMPLETE',
          file,
          `Agent contract is missing required guidance: ${marker}`,
          `Document the rule in ${file}; do not rely on chat context.`
        ));
      }
    }
  }

  const plansRoot = path.join(projectRoot, 'docs/plans');
  const planFiles = fs.existsSync(plansRoot)
    ? fs.readdirSync(plansRoot).filter((file) => file.endsWith('.md') && file !== 'README.md' && file !== 'TEMPLATE.md' && file !== 'TASK-TEMPLATE.md' && file !== 'VERIFICATION-TEMPLATE.md')
    : [];
  const planStatuses = [];
  for (const file of planFiles) {
    const text = readText(projectRoot, path.join('docs/plans', file));
    const match = text.match(/^Status:\s*(.+?)\s*$/m);
    const status = match?.[1]?.trim() || null;
    planStatuses.push({ file: path.join('docs/plans', file), status });
    if (!status) {
      issues.push(issue(
        'PLAN_STATUS_MISSING',
        path.join('docs/plans', file),
        'Every development plan must declare a Status field.',
        'Use one of Proposed, In progress, Accepted, Deferred or Rejected.'
      ));
    } else if (!VALID_PLAN_STATUSES.has(status)) {
      issues.push(issue(
        'PLAN_STATUS_INVALID',
        path.join('docs/plans', file),
        `Unknown plan status: ${status}`,
        'Use one of Proposed, In progress, Accepted, Deferred or Rejected.'
      ));
    }
    if (status === 'Accepted' && !/##\s+(?:Acceptance gates|Acceptance evidence|Verification)/i.test(text)) {
      issues.push(issue(
        'ACCEPTED_PLAN_WITHOUT_GATE',
        path.join('docs/plans', file),
        'An Accepted plan must contain an explicit acceptance or verification section.',
        'Keep the plan Proposed/ In progress until measured evidence is recorded.'
      ));
    }
  }

  const planIndex = readText(projectRoot, 'docs/plans/README.md');
  for (const match of planIndex.matchAll(/\]\(([^)]+\.md)\)/g)) {
    const link = match[1];
    if (link.startsWith('http://') || link.startsWith('https://')) continue;
    const resolved = path.resolve(plansRoot, link);
    if (!fs.existsSync(resolved)) {
      issues.push(issue(
        'PLAN_LINK_BROKEN',
        'docs/plans/README.md',
        `Plan index links to a missing file: ${link}`,
        'Fix the link or add the referenced plan before handoff.'
      ));
    }
  }

  return {
    passed: issues.length === 0,
    requiredFiles: REQUIRED_AGENT_FILES,
    missingFiles,
    planStatuses,
    issues
  };
}

const TASK_ARRAY_FIELDS = ['invariants', 'dependencies', 'nonGoals', 'acceptance', 'evidence', 'unverifiedLimits'];
const TASK_SCOPE_FIELDS = ['engine', 'consumer'];

/** Validate the serializable task contract used by agents and MCP clients. */
export function validateTaskSpec(value) {
  const issues = [];
  const task = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!task) {
    return { passed: false, issues: [{ field: 'task', code: 'TASK_OBJECT_REQUIRED', message: 'task must be an object' }] };
  }
  for (const field of ['id', 'source', 'goal']) {
    if (typeof task[field] !== 'string' || task[field].trim() === '') {
      issues.push({ field, code: 'TASK_FIELD_REQUIRED', message: `${field} must be a non-empty string` });
    }
  }
  for (const field of TASK_ARRAY_FIELDS) {
    if (!Array.isArray(task[field])) {
      issues.push({ field, code: 'TASK_ARRAY_REQUIRED', message: `${field} must be an array` });
    }
  }
  for (const field of ['invariants', 'acceptance', 'nonGoals', 'unverifiedLimits']) {
    if (Array.isArray(task[field]) && task[field].length === 0) {
      issues.push({ field, code: 'TASK_ARRAY_EMPTY', message: `${field} must contain at least one explicit entry` });
    }
  }
  if (!task.scope || typeof task.scope !== 'object' || Array.isArray(task.scope)) {
    issues.push({ field: 'scope', code: 'TASK_SCOPE_REQUIRED', message: 'scope must contain engine and consumer arrays' });
  } else {
    for (const field of TASK_SCOPE_FIELDS) {
      if (!Array.isArray(task.scope[field])) {
        issues.push({ field: `scope.${field}`, code: 'TASK_SCOPE_ARRAY_REQUIRED', message: `scope.${field} must be an array` });
      }
    }
  }
  for (const field of TASK_ARRAY_FIELDS) {
    if (Array.isArray(task[field]) && task[field].some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
      issues.push({ field, code: 'TASK_ARRAY_ENTRY_INVALID', message: `${field} entries must be non-empty strings` });
    }
  }
  if (task.scope && typeof task.scope === 'object' && !Array.isArray(task.scope)) {
    for (const field of TASK_SCOPE_FIELDS) {
      if (Array.isArray(task.scope[field]) && task.scope[field].some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
        issues.push({ field: `scope.${field}`, code: 'TASK_SCOPE_ENTRY_INVALID', message: `scope.${field} entries must be non-empty strings` });
      }
    }
  }
  if (task.status !== undefined && (typeof task.status !== 'string' || !VALID_PLAN_STATUSES.has(task.status))) {
    issues.push({ field: 'status', code: 'TASK_STATUS_INVALID', message: 'status must use a documented plan status' });
  }
  return { passed: issues.length === 0, issues };
}

export function getAgentContract(projectRoot) {
  const audit = auditAgentContract(projectRoot);
  return {
    contractVersion: 1,
    repository: 'zhuda-laya-engine',
    passed: audit.passed,
    requiredReading: [
      'AGENTS.md',
      'docs/agent-development.md',
      'docs/plans/README.md',
      'docs/plans/TEMPLATE.md',
      'docs/plans/TASK-TEMPLATE.md',
      'docs/plans/VERIFICATION-TEMPLATE.md'
    ],
    commands: [
      'npm run verify',
      'git diff --check',
      'git status --short'
    ],
    workflow: [
      'read-contract',
      'write-task-spec',
      'inventory-assets-and-boundaries',
      'add-failing-fixture',
      'implement-smallest-change',
      'test-failure-and-lifecycle-paths',
      'run-verification',
      'write-verification-record'
    ],
    boundaries: {
      engine: ['public runtime APIs', 'types', 'compiler', 'MCP', 'diagnostics', 'engine fixtures'],
      consumer: ['game rules', 'network authority', 'art/assets', 'game-specific scenes/effects', 'deployment'],
      rule: 'Adapters cross the boundary through public contracts; consumer source paths and private engine implementation imports are forbidden.'
    },
    evidenceRules: [
      'A validator result proves configuration only, not pixels or device performance.',
      'Unavailable browser/device checks remain UNAVAILABLE and prevent Accepted status.',
      'Plan status Accepted requires explicit acceptance/verification evidence.',
      'Async resources must cover cancellation, timeout, stale completion, retry and disposal.'
    ],
    audit
  };
}
