import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AUDIT_LOG_PORT_METHODS,
  CLASS_SCHEDULE_REPO_METHODS,
  FACILITY_REPO_METHODS,
  ISSUE_REPO_METHODS,
  NOTIFICATION_PORT_METHODS,
  RESERVATION_REPO_METHODS,
  USER_REPO_METHODS,
  assertPortImplemented,
} from '../application/ports.js';

const repositoryRoot = process.cwd();
const coreDirectories = [
  path.join(repositoryRoot, 'backend/domain'),
  path.join(repositoryRoot, 'backend/application/useCases'),
];
const forbiddenCoreImports = [
  /from\s+['"][^'"]*(?:\/database\/|\/services\/|drizzle-orm|firebase-admin|express|\bpg\b)[^'"]*['"]/,
  /require\(['"][^'"]*(?:\/database\/|\/services\/|drizzle-orm|firebase-admin|express|\bpg\b)[^'"]*['"]\)/,
];

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:js|mjs|cjs|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

test('domain and application use cases do not depend on infrastructure or web frameworks', () => {
  const violations = [];
  for (const directory of coreDirectories) {
    for (const filePath of collectSourceFiles(directory)) {
      const source = fs.readFileSync(filePath, 'utf8');
      for (const pattern of forbiddenCoreImports) {
        if (pattern.test(source)) {
          violations.push(path.relative(repositoryRoot, filePath));
          break;
        }
      }
    }
  }
  assert.deepEqual(violations, [], 'Core layers must remain independent of adapters and frameworks');
});

test('HTTP controllers do not import database infrastructure', () => {
  const controllerPath = path.join(repositoryRoot, 'backend/controllers/apiControllers.js');
  const source = fs.readFileSync(controllerPath, 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*\/database\//);
  assert.doesNotMatch(source, /ensureFacilityCatalog/);
});

test('all declared outbound ports reject missing adapters and missing methods', () => {
  const contracts = [
    ['FacilityRepositoryPort', FACILITY_REPO_METHODS],
    ['ReservationRepositoryPort', RESERVATION_REPO_METHODS],
    ['IssueRepositoryPort', ISSUE_REPO_METHODS],
    ['UserRepositoryPort', USER_REPO_METHODS],
    ['NotificationPort', NOTIFICATION_PORT_METHODS],
    ['AuditLogPort', AUDIT_LOG_PORT_METHODS],
    ['ClassScheduleRepositoryPort', CLASS_SCHEDULE_REPO_METHODS],
  ];

  for (const [name, methods] of contracts) {
    assert.throws(() => assertPortImplemented(null, methods, name), /Missing required port/);
    const validAdapter = Object.fromEntries(methods.map((method) => [method, () => undefined]));
    assert.doesNotThrow(() => assertPortImplemented(validAdapter, methods, name));
    const incompleteAdapter = { ...validAdapter };
    delete incompleteAdapter[methods[0]];
    assert.throws(
      () => assertPortImplemented(incompleteAdapter, methods, name),
      new RegExp(methods[0])
    );
  }
});
