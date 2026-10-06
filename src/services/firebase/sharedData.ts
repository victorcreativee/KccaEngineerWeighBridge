import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, waitForPendingWrites, writeBatch, type Unsubscribe } from "firebase/firestore";
import { firestore } from "./client";
import { normalizeDivisionRecord } from "../../utils/divisions";

export const sharedKeys = {
  entries: "buyala.local.entries.v1",
  vehicles: "buyala.local.vehicles.v1",
  drivers: "buyala.local.drivers.v1",
  auditEvents: "buyala.local.audit.v1",
  recoveryEntries: "buyala.local.recovery.v1",
} as const;

type SharedKey = typeof sharedKeys[keyof typeof sharedKeys];
type SharedRecord = Record<string, unknown> & { id: string };
const collectionForKey: Record<SharedKey, string> = {
  [sharedKeys.entries]: "entries",
  [sharedKeys.vehicles]: "vehicles",
  [sharedKeys.drivers]: "drivers",
  [sharedKeys.auditEvents]: "auditEvents",
  [sharedKeys.recoveryEntries]: "recoveryEntries",
};
const pendingKey = "buyala.sync.outbox.v2";
const lastSyncedKey = "buyala.sync.lastSuccessful.v1";
const tombstoneKey = "buyala.sync.tombstones.v1";
const batchSize = 200;
const recoveryConcurrency = 12;
const networkTimeoutMs = 60000;
let activeFlush: Promise<boolean> | null = null;

type Outbox = Partial<Record<SharedKey, SharedRecord[]>>;
type Tombstones = Partial<Record<SharedKey, string[]>>;
function readOutbox(): Outbox { try { const value = JSON.parse(localStorage.getItem(pendingKey) ?? "{}") as Outbox; return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function readTombstones(): Tombstones { try { const value = JSON.parse(localStorage.getItem(tombstoneKey) ?? "{}") as Tombstones; return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function pendingCount(outbox = readOutbox()) { return Object.values(outbox).reduce((sum, records) => sum + (Array.isArray(records) ? records.length : 0), 0); }
function publishOutbox(outbox: Outbox, detail: Record<string, unknown> = {}) { localStorage.setItem(pendingKey, JSON.stringify(outbox)); window.dispatchEvent(new CustomEvent("buyala:sync-status", { detail: { pending: pendingCount(outbox), ...detail } })); }
function queueRecords(key: SharedKey, records: SharedRecord[]) { const outbox = readOutbox(); const queued = new Map((outbox[key] ?? []).map((record) => [record.id, record])); records.forEach((record) => queued.set(record.id, clean(record))); outbox[key] = [...queued.values()]; publishOutbox(outbox); }
function removeQueuedRecords(key: SharedKey, ids: Set<string>) { if (!ids.size) return; const outbox = readOutbox(); const remaining = (outbox[key] ?? []).filter((record) => !ids.has(record.id)); if (remaining.length) outbox[key] = remaining; else delete outbox[key]; publishOutbox(outbox); }
export function getPendingSyncCount() { return typeof window === "undefined" ? 0 : pendingCount(); }
export function getPendingTransactionCount() { return typeof window === "undefined" ? 0 : (readOutbox()[sharedKeys.entries] ?? []).length; }
export function getPendingSyncSummary() {
  if (typeof window === "undefined") return [];
  const labels: Record<SharedKey, string> = {
    [sharedKeys.entries]: "transaction",
    [sharedKeys.vehicles]: "vehicle",
    [sharedKeys.drivers]: "driver",
    [sharedKeys.auditEvents]: "audit event",
    [sharedKeys.recoveryEntries]: "materials record",
  };
  return (Object.entries(readOutbox()) as [SharedKey, SharedRecord[]][])
    .filter(([, records]) => records.length)
    .map(([key, records]) => ({ key, label: labels[key], count: records.length }));
}
export function getLastSuccessfulSync() { return typeof window === "undefined" ? null : localStorage.getItem(lastSyncedKey); }

function readLocal(key: SharedKey): SharedRecord[] {
  try { const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as SharedRecord[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function clean(record: SharedRecord) { return JSON.parse(JSON.stringify(record)) as SharedRecord; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "synchronizedAt").sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
function sameRecord(left: unknown, right: unknown) { return canonical(left) === canonical(right); }
function withTimeout<T>(operation: Promise<T>, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), networkTimeoutMs);
    operation.then((value) => { window.clearTimeout(timeout); resolve(value); }, (error) => { window.clearTimeout(timeout); reject(error); });
  });
}
function canIsolateRecordError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code.includes("permission-denied") || code.includes("invalid-argument") || code.includes("failed-precondition");
}
function storeLocal(key: SharedKey, records: SharedRecord[]) {
  const serialized = JSON.stringify(records);
  if (localStorage.getItem(key) === serialized) return;
  localStorage.setItem(key, serialized);
  window.dispatchEvent(new CustomEvent("buyala:shared-data", { detail: { key } }));
}

function confirmQueuedRecords(key: SharedKey, sentRecords: SharedRecord[], synchronizedAt: string) {
  if (!sentRecords.length) return;
  const sent = new Map(sentRecords.map((record) => [record.id, JSON.stringify(record)]));
  const current = readOutbox();
  const remaining = (current[key] ?? []).filter((record) => sent.get(record.id) !== JSON.stringify(record));
  if (remaining.length) current[key] = remaining; else delete current[key];
  const originals = new Map(sentRecords.map((record) => [record.id, record]));
  storeLocal(key, readLocal(key).map((record) => {
    const original = originals.get(record.id);
    return original && sameRecord(record, original) ? { ...record, synchronizedAt } : record;
  }));
  publishOutbox(current);
}

async function recoverChunk(key: SharedKey, records: SharedRecord[], synchronizedAt: string) {
  for (let start = 0; start < records.length; start += recoveryConcurrency) {
    const group = records.slice(start, start + recoveryConcurrency);
    const results = await Promise.all(group.map(async (record) => {
      const reference = doc(firestore, collectionForKey[key], record.id);
      try {
        await withTimeout(setDoc(reference, clean({ ...record, synchronizedAt })), "SYNC_RECORD");
        return record;
      } catch {
        // A previous request may have reached Firebase even when its response was lost.
        try {
          const existing = await withTimeout(getDoc(reference), "SYNC_VERIFY");
          return existing.exists() && sameRecord(existing.data(), record) ? record : null;
        } catch { return null; }
      }
    }));
    confirmQueuedRecords(key, results.filter((record): record is SharedRecord => Boolean(record)), synchronizedAt);
  }
}

async function runPendingFlush() {
  if (!navigator.onLine) return false;
  const sending = readOutbox();
  const priority: SharedKey[] = [sharedKeys.entries, sharedKeys.vehicles, sharedKeys.drivers, sharedKeys.recoveryEntries, sharedKeys.auditEvents];
  const work = (Object.entries(sending) as [SharedKey, SharedRecord[]][]).sort(([a], [b]) => priority.indexOf(a) - priority.indexOf(b));
  if (!work.length || !pendingCount(sending)) return true;
  const synchronizedAt = new Date().toISOString();
  publishOutbox(sending, { syncing: true, total: pendingCount(sending) });
  for (const [key, records] of work) {
    for (let start = 0; start < records.length; start += batchSize) {
      const chunk = records.slice(start, start + batchSize);
      const batch = writeBatch(firestore);
      chunk.forEach((record) => batch.set(doc(firestore, collectionForKey[key], record.id), clean({ ...record, synchronizedAt })));
      try {
        await withTimeout(batch.commit(), "SYNC_BATCH");
        // Persist progress after every successful batch. A later timeout must not
        // make thousands of already-uploaded records appear pending again.
        confirmQueuedRecords(key, chunk, synchronizedAt);
      } catch (error) {
        if (!canIsolateRecordError(error)) throw error;
        // Isolate invalid/unauthorized records concurrently so one old record
        // cannot make a large offline backlog take hours to recover.
        await recoverChunk(key, chunk, synchronizedAt);
      }
    }
  }
  await withTimeout(waitForPendingWrites(firestore), "SYNC_CONFIRMATION");
  const current = readOutbox();
  if (!pendingCount(current)) localStorage.setItem(lastSyncedKey, new Date().toISOString());
  publishOutbox(current, { syncing: false });
  return !pendingCount(current);
}

function flushPending() {
  if (activeFlush) return activeFlush;
  activeFlush = runPendingFlush().finally(() => {
    publishOutbox(readOutbox(), { syncing: false });
    activeFlush = null;
  });
  return activeFlush;
}

function recordTime(record: SharedRecord) {
  for (const field of ["updatedAt", "recordedAt", "completedAt", "at", "createdAt"]) { const value = record[field]; if (typeof value === "string" && value) return Date.parse(value) || 0; }
  return 0;
}

function mergeRemote(key: SharedKey, remote: SharedRecord[]) {
  const deleted = new Set(readTombstones()[key] ?? []);
  const local = readLocal(key).filter((record) => !deleted.has(record.id));
  const queued = new Map((readOutbox()[key] ?? []).map((record) => [record.id, record]));
  const merged = new Map(remote.filter((record) => !deleted.has(record.id)).map((record) => [record.id, record]));
  const shouldUpload: SharedRecord[] = [];
  const staleQueued = new Set<string>();
  local.forEach((record) => {
    const pending = queued.get(record.id);
    const server = merged.get(record.id);
    if (pending && server && sameRecord(server, pending)) { merged.set(record.id, server); staleQueued.add(record.id); }
    else if (pending && server && recordTime(server) > recordTime(pending)) { merged.set(record.id, server); staleQueued.add(record.id); }
    else if (pending) merged.set(record.id, pending);
    else if (!server || (recordTime(record) > recordTime(server) && JSON.stringify(record) !== JSON.stringify(server))) { merged.set(record.id, record); shouldUpload.push(record); }
  });
  storeLocal(key, [...merged.values()]);
  removeQueuedRecords(key, staleQueued);
  if (shouldUpload.length) queueRecords(key, shouldUpload);
}

export async function hydrateSharedData(role: "Data Clerk" | "Engineer" | "System Admin") {
    try { const state = await getDoc(doc(firestore, "systemState", "current")); if (state.exists()) { const value = state.data() as { resetAt?: string; clearedCollections?: string[] }; const applied = localStorage.getItem("buyala.reset.appliedAt") ?? ""; if (value.resetAt && value.resetAt > applied) { const resetTime = Date.parse(value.resetAt) || 0; const reverse = Object.fromEntries(Object.entries(collectionForKey).map(([key, name]) => [name, key])); const outbox = readOutbox(); (value.clearedCollections ?? []).forEach((name) => { const key = reverse[name] as SharedKey | undefined; if (!key) return; storeLocal(key, readLocal(key).filter((record) => recordTime(record) > resetTime)); if (outbox[key]) { const current = outbox[key]!.filter((record) => recordTime(record) > resetTime); if (current.length) outbox[key] = current; else delete outbox[key]; } }); publishOutbox(outbox); ["buyala.local.operationDraft.v1", "buyala.local.resumeEntryId", "buyala.offline.test.v1", "buyala.sync.pending.v1"].forEach((key) => localStorage.removeItem(key)); localStorage.setItem("buyala.reset.appliedAt", value.resetAt); } } } catch { /* Reset marker will be checked again on the next connected start. */ }
  // Reconcile with Firebase before uploading. This safely removes records that
  // reached the server during an earlier attempt whose response was interrupted.
  const keys = (Object.values(sharedKeys) as SharedKey[]).filter((key) => role === "System Admin" || key !== sharedKeys.auditEvents);
  await Promise.all(keys.map(async (key) => {
    try {
      const snapshot = await getDocs(collection(firestore, collectionForKey[key]));
      const remote = snapshot.docs.map((item) => item.data() as SharedRecord);
      mergeRemote(key, remote);
    } catch { /* Device-local data remains available if Firebase cannot be reached. */ }
  }));
  if (navigator.onLine) {
    const complete = await flushPending().catch(() => false);
    if (complete) { localStorage.setItem(lastSyncedKey, new Date().toISOString()); window.dispatchEvent(new Event("buyala:sync-status")); }
  }
}

export function subscribeSharedData(role: "Data Clerk" | "Engineer" | "System Admin") {
  const stops: Unsubscribe[] = [];
  (Object.values(sharedKeys) as SharedKey[]).filter((key) => role === "System Admin" || key !== sharedKeys.auditEvents).forEach((key) => {
    stops.push(onSnapshot(collection(firestore, collectionForKey[key]), (snapshot) => {
      if (!snapshot.metadata.fromCache || snapshot.docs.length) mergeRemote(key, snapshot.docs.map((item) => item.data() as SharedRecord));
    }, () => undefined));
  });
  const reconnect = () => { void synchronizeNow(role).catch(() => undefined); };
  const retry = window.setInterval(() => { if (navigator.onLine && getPendingSyncCount()) void flushPending().catch(() => undefined); }, 15000);
  const visible = () => { if (document.visibilityState === "visible" && navigator.onLine && getPendingSyncCount()) reconnect(); };
  window.addEventListener("online", reconnect);
  document.addEventListener("visibilitychange", visible);
  if (getPendingSyncCount()) void flushPending().catch(() => undefined);
  return () => { stops.forEach((stop) => stop()); window.clearInterval(retry); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", visible); };
}

export function saveSharedData<T extends { id: string }>(key: SharedKey, records: T[]) {
  const normalize = (record: SharedRecord): SharedRecord => (key === sharedKeys.entries || key === sharedKeys.vehicles) && typeof record.division === "string" ? normalizeDivisionRecord(record as SharedRecord & { division: string }) : record;
  records = (records as SharedRecord[]).map(normalize) as T[];
  const previous = new Map(readLocal(key).map((record) => [record.id, JSON.stringify(normalize(record))]));
  const changed = (records as SharedRecord[]).filter((record) => previous.get(record.id) !== JSON.stringify(record));
  storeLocal(key, records as SharedRecord[]);
  if (changed.length) { queueRecords(key, changed); void flushPending().catch(() => undefined); }
}

export async function deleteSharedDataRecords(key: SharedKey, ids: string[]) {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const targets = [...new Set(ids)].filter(Boolean); if (!targets.length) return;
  const tombstones = readTombstones(); tombstones[key] = [...new Set([...(tombstones[key] ?? []), ...targets])]; localStorage.setItem(tombstoneKey, JSON.stringify(tombstones));
  const targetSet = new Set(targets); const outbox = readOutbox(); if (outbox[key]) { const remaining = outbox[key]!.filter((record) => !targetSet.has(record.id)); if (remaining.length) outbox[key] = remaining; else delete outbox[key]; publishOutbox(outbox); }
  storeLocal(key, readLocal(key).filter((record) => !targetSet.has(record.id)));
  for (let start = 0; start < targets.length; start += batchSize) { const batch = writeBatch(firestore); targets.slice(start, start + batchSize).forEach((id) => batch.delete(doc(firestore, collectionForKey[key], id))); await batch.commit(); }
  await waitForPendingWrites(firestore);
  localStorage.setItem(lastSyncedKey, new Date().toISOString()); window.dispatchEvent(new Event("buyala:sync-status"));
}

export async function synchronizeNow(role: "Data Clerk" | "Engineer" | "System Admin") {
  if (!navigator.onLine) throw new Error("OFFLINE");
  await hydrateSharedData(role);
  await flushPending();
  if (getPendingSyncCount()) throw new Error("SYNC_PENDING");
  localStorage.setItem(lastSyncedKey, new Date().toISOString());
  window.dispatchEvent(new Event("buyala:sync-status"));
}
