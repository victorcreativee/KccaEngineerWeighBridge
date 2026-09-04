// Scoped, add-only import. Default is preview; --commit rechecks live data first.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const auth = require('/Users/Victorcreativee/.npm-global/lib/node_modules/firebase-tools/lib/auth.js');
const project = 'buyala-weighbridge';
const database = `projects/${project}/databases/(default)`;
const endpoint = `https://firestore.googleapis.com/v1/${database}/documents`;
const outputDir = new URL('../work/september-2026-import/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
const source = JSON.parse(execFileSync('/Users/Victorcreativee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3', [fileURLToPath(new URL('./inspect-september-source.py', import.meta.url))], { encoding: 'utf8' }));
const account = auth.getProjectDefaultAccount(process.cwd());
assert(account?.tokens?.refresh_token, 'Sign in to Firebase CLI before running this import');
const token = await auth.getAccessToken(account.tokens.refresh_token, []);
assert(token.access_token, 'No Firebase access token');
async function request(suffix, body) {
  const response = await fetch(endpoint + suffix, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${data.error?.message ?? response.statusText}`);
  return data;
}
function decode(value) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decode(item)]));
  throw new Error('Unsupported Firestore field');
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encode(item)])) } };
}
async function collection(name) {
  const docs = []; let pageToken = '';
  do { const page = await request(`/${name}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`); docs.push(...(page.documents ?? [])); pageToken = page.nextPageToken; } while (pageToken);
  return docs.map(doc => ({ name: doc.name, updateTime: doc.updateTime, data: Object.fromEntries(Object.entries(doc.fields ?? {}).map(([key, value]) => [key, decode(value)])) }));
}
function normalizeReg(value) { return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function time(value) { const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i); if (!match) return ''; let hour = Number(match[1]); if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0); return `${String(hour).padStart(2, '0')}:${match[2]}`; }
function key(row) { return [row.operationDate, normalizeReg(row.registration), time(row.arrivalTime), Number(row.grossKg), Number(row.tareKg)].join('|'); }
function summary(rows) { return Object.fromEntries(['2026-09-01', '2026-09-02'].map(date => { const selected = rows.filter(row => row.operationDate === date); return [date, { trips: selected.length, netKg: selected.reduce((sum, row) => sum + Number(row.netKg || 0), 0) }]; })); }
function plan(existingDocs) {
  const existing = existingDocs.map(doc => ({ ...doc.data, documentId: doc.name.split('/').at(-1) }));
  const exact = []; const uncertain = []; const additions = []; const invalid = []; const seen = new Set();
  for (const row of source.rows) {
    assert(!seen.has(key(row)), `Duplicate workbook row ${row.sourceRow}`); seen.add(key(row));
    if (row.validationErrors.length) { invalid.push(row); continue; }
    const candidates = existing.filter(entry => entry.operationDate === row.operationDate && normalizeReg(entry.registration) === normalizeReg(row.registration));
    const matches = candidates.filter(entry => key(entry) === key(row));
    if (matches.length) { exact.push({ row, existing: matches.map(entry => entry.documentId) }); continue; }
    // Same registration/day/time OR same weights may be an edited trip or mistyped time. Never silently add these.
    const possible = candidates.filter(entry => time(entry.arrivalTime) === time(row.arrivalTime) || (Number(entry.grossKg) === row.grossKg && Number(entry.tareKg) === row.tareKg) || (Number(entry.netKg) === row.netKg && entry.netKg > 0));
    if (possible.length) { uncertain.push({ row, existing: possible.map(entry => ({ id: entry.documentId, arrivalTime: entry.arrivalTime, grossKg: entry.grossKg, tareKg: entry.tareKg, netKg: entry.netKg, status: entry.status })) }); continue; }
    additions.push(row);
  }
  return { additions, exact, uncertain, invalid };
}
const [existingDocs, vehiclesDocs] = await Promise.all([collection('entries'), collection('vehicles')]);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await fs.writeFile(new URL(`before-${stamp}.json`, outputDir), JSON.stringify({ project, exportedAt: new Date().toISOString(), entries: existingDocs, vehicles: vehiclesDocs }, null, 2), { mode: 0o600, flag: 'wx' });
const preview = plan(existingDocs);
await fs.writeFile(new URL(`preview-${stamp}.json`, outputDir), JSON.stringify({ sourceFile: source.file, sourceSha256: source.sha256, sourceSummary: summary(source.rows), ...preview }, null, 2), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ mode: process.argv.includes('--commit') ? 'commit' : 'preview', source: summary(source.rows), liveBefore: summary(existingDocs.map(doc => doc.data)), proposedAdditions: summary(preview.additions), exactDuplicates: summary(preview.exact.map(item => item.row)), heldForReview: summary(preview.uncertain.map(item => item.row)), invalid: preview.invalid, review: preview.uncertain }, null, 2));
if (!process.argv.includes('--commit')) process.exit(0);
assert(preview.additions.length > 0, 'Nothing new to import');
const approvedPath = process.argv[process.argv.indexOf('--commit') + 1];
assert(approvedPath, 'Pass the inspected preview file after --commit');
const approved = JSON.parse(await fs.readFile(approvedPath, 'utf8'));
assert.equal(source.sha256, approved.sourceSha256, 'Source workbook changed since preview');
assert.deepEqual(preview.additions.map(key), approved.additions.map(key), 'Live comparison changed since the reviewed preview');
// Read the affected dates inside a server transaction, preventing concurrent changes
// to the compared records from being silently ignored at commit.
const { transaction } = await request(':beginTransaction', { options: { readWrite: {} } });
const query = await request(':runQuery', { transaction, structuredQuery: { from: [{ collectionId: 'entries' }], where: { fieldFilter: { field: { fieldPath: 'operationDate' }, op: 'IN', value: { arrayValue: { values: ['2026-09-01', '2026-09-02'].map(date => ({ stringValue: date })) } } } } } });
const freshDocs = query.filter(item => item.document).map(({ document: doc }) => ({ name: doc.name, updateTime: doc.updateTime, data: Object.fromEntries(Object.entries(doc.fields ?? {}).map(([key, value]) => [key, decode(value)])) }));
const fresh = plan(freshDocs);
assert.deepEqual(fresh.additions.map(key), preview.additions.map(key), 'Live duplicates changed: rerun preview before committing');
const now = new Date().toISOString();
const batchId = `sept-2026-${source.sha256.slice(0, 16)}`;
const actor = `System Admin via Firebase CLI (${account.user.email})`;
const entries = fresh.additions.map(row => {
  row = { ...row, transactionAt: new Date(row.transactionAt).toISOString(), departureAt: new Date(row.departureAt).toISOString() };
  const matches = vehiclesDocs.map(doc => ({ ...doc.data, documentId: doc.name.split('/').at(-1) })).filter(vehicle => vehicle.active !== false && normalizeReg(vehicle.registration) === normalizeReg(row.registration));
  const vehicle = matches.length === 1 ? matches[0] : undefined;
  const division = /^out\s*side$/i.test(row.division) ? 'Outside' : /^(lubaga|rubaga)$/i.test(row.division) ? 'Lubaga' : row.division;
  const id = `hist-${createHash('sha256').update(`buyala|${key(row)}`).digest('hex').slice(0, 40)}`;
  return { id, facilityId: 'buyala', localTicket: `HIST-SEPT-${row.operationDate.replaceAll('-', '')}-${row.sourceRow}`, createdBy: actor, updatedBy: actor, createdAt: now, updatedAt: now, synchronizedAt: now, registration: row.registration, vehicleId: vehicle?.id ?? vehicle?.documentId, vehicleMatched: Boolean(vehicle), vehicleType: vehicle?.vehicleType, division, originArea: division === 'Outside' ? 'Nearby suburbs / outside Kampala' : ['Central', 'Makindye', 'Lubaga', 'Kawempe', 'Nakawa'].includes(division) ? 'Kampala city' : '', operatorCategory: row.concessionaire === 'Yes' ? 'Concessionaire' : 'Non-concessionaire', concessionaire: row.concessionaire, company: row.company, routeSource: row.routeSource, driverName: 'Not recorded', driverPhone: '', driverMatched: false, operationDate: row.operationDate, arrivalTime: row.arrivalTime, transactionAt: row.transactionAt, departureTime: row.departureTime, departureDate: row.departureDate, departureAt: row.departureAt, departureTimeEstimated: true, departureEstimationMinutes: 8, departureEstimationReason: 'Source contains no departure time; arrival plus 8 minutes authorized by System Admin.', grossKg: row.grossKg, tareKg: row.tareKg, netKg: row.netKg, tareCaptureMode: 'UNCONFIRMED', status: 'COMPLETED', completedAt: row.departureAt, importBatchId: batchId, importSourceFile: source.file, importSourceSha256: source.sha256, importSourceSheet: source.sheet, importSourceRow: row.sourceRow, importSourceConcessionaire: row.concessionaire, importedAt: now, importedBy: actor, importNotes: 'Historical Excel import. Original transaction date retained. Departure estimated as arrival + 8 minutes; no driver recorded in source.' };
});
assert(entries.length < 499, 'Too many writes for the scoped atomic commit');
const audit = { id: `${batchId}-${stamp}`, at: now, actor, role: 'System Admin', action: 'HISTORICAL_TRANSACTIONS_IMPORTED', reference: batchId, details: `Added ${entries.length} transactions from sept.xlsx for 1–2 September 2026. Skipped ${fresh.exact.length} exact duplicates; held ${fresh.uncertain.length} possible duplicates and ${fresh.invalid.length} zero-tare rows. No existing records replaced. Source concessionaire flags preserved. All departure times estimated as arrival + 8 minutes; original trip dates retained.` };
const writes = [...entries.map(entry => ({ update: { name: `${database}/documents/entries/${entry.id}`, fields: encode(entry).mapValue.fields }, currentDocument: { exists: false } })), { update: { name: `${database}/documents/auditEvents/${audit.id}`, fields: encode(audit).mapValue.fields }, currentDocument: { exists: false } }];
await fs.writeFile(new URL(`submitted-${stamp}.json`, outputDir), JSON.stringify({ entries, audit }, null, 2), { mode: 0o600, flag: 'wx' });
await request(':commit', { writes, transaction });
const afterDocs = await collection('entries');
const after = new Map(afterDocs.map(doc => [doc.name.split('/').at(-1), doc.data]));
for (const entry of entries) assert.deepEqual(after.get(entry.id), JSON.parse(JSON.stringify(entry)), `Verification failed for ${entry.id}`);
const changedExisting = freshDocs.filter(doc => { try { assert.deepEqual(after.get(doc.name.split('/').at(-1)), doc.data); return false; } catch { return true; } });
const result = { verified: true, batchId, added: summary(entries), exactDuplicatesSkipped: summary(fresh.exact.map(item => item.row)), possibleDuplicatesHeld: summary(fresh.uncertain.map(item => item.row)), invalidHeld: summary(fresh.invalid), liveAfter: summary(afterDocs.map(doc => doc.data)), existingRecordChangesObserved: changedExisting.length };
await fs.writeFile(new URL(`result-${stamp}.json`, outputDir), JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
