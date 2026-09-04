import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/utils/divisions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeDivision, normalizeDivisionRecord, divisionLabel } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('Outside aliases share one reporting division', () => {
  for (const value of ['Outside', 'out side', 'OUTSIDE', ' Out  Side ', 'out\tside']) assert.equal(divisionLabel(value), 'Outside');
  assert.equal(normalizeDivision('Central'), 'Central');
  assert.equal(divisionLabel('Rubaga'), 'Lubaga');
  assert.equal(divisionLabel(''), 'Other / unconfirmed');
});
test('normalization preserves trip identity, weights, dates and audit history', () => {
  const trip = { id: 'trip1', division: 'out side', netKg: 4860, operationDate: '2026-09-02', correctionHistory: [{ division: 'out side' }] };
  assert.deepEqual(normalizeDivisionRecord(trip), { ...trip, division: 'Outside' });
  assert.equal(trip.division, 'out side');
  assert.deepEqual(normalizeDivisionRecord({ id: 'missing' }), { id: 'missing' });
});
