import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPortImplemented,
  INBOUND_USE_CASE_PORT_METHODS,
} from './ports.js';

test('inbound use-case port contracts cover every application boundary', () => {
  assert.deepEqual(
    Object.keys(INBOUND_USE_CASE_PORT_METHODS).sort(),
    ['analytics', 'classSchedule', 'dashboard', 'facility', 'maintenance', 'reservation', 'user'].sort(),
  );

  for (const [name, methods] of Object.entries(INBOUND_USE_CASE_PORT_METHODS)) {
    assert.ok(methods.length > 0, `Expected ${name} inbound port to declare methods.`);
    assert.equal(new Set(methods).size, methods.length, `Expected ${name} port methods to be unique.`);
  }
});

test('assertPortImplemented accepts a complete inbound application port', () => {
  const port = Object.fromEntries(
    INBOUND_USE_CASE_PORT_METHODS.dashboard.map((method) => [method, () => undefined]),
  );

  assert.doesNotThrow(() => {
    assertPortImplemented(port, INBOUND_USE_CASE_PORT_METHODS.dashboard, 'DashboardUseCasePort');
  });
});

test('assertPortImplemented rejects missing port implementations and methods', () => {
  assert.throws(
    () => assertPortImplemented(null, ['listAll'], 'FacilityRepositoryPort'),
    /Missing required port implementation: FacilityRepositoryPort/,
  );
  assert.throws(
    () => assertPortImplemented({ listAll: true }, ['listAll'], 'FacilityRepositoryPort'),
    /must implement method "listAll\(\)"/,
  );
});
