import { collection, doc, getDocs, onSnapshot, setDoc, waitForPendingWrites, type Unsubscribe } from "firebase/firestore";
import { firestore } from "./client";

export const sharedKeys = {
  entries: "buyala.local.entries.v1",
  vehicles: "buyala.local.vehicles.v1",
  drivers: "buyala.local.drivers.v1",
  auditEvents: "buyala.local.audit.v1",
} as const;

type SharedKey = typeof sharedKeys[keyof typeof sharedKeys];
type SharedRecord = Record<string, unknown> & { id: string };
const collectionForKey: Record<SharedKey, string> = {
  [sharedKeys.entries]: "entries",
  [sharedKeys.vehicles]: "vehicles",
  [sharedKeys.drivers]: "drivers",
  [sharedKeys.auditEvents]: "auditEvents",
};
const pendingKey = "buyala.sync.pending.v1";

function pendingTokens() { try { const value = JSON.parse(localStorage.getItem(pendingKey) ?? "[]") as string[]; return Array.isArray(value) ? value : []; } catch { return []; } }
function publishPending(tokens: string[]) { localStorage.setItem(pendingKey, JSON.stringify(tokens)); window.dispatchEvent(new CustomEvent("buyala:sync-status", { detail: { pending: tokens.length } })); }
function beginPending(key: SharedKey) { const token = `${key}:${crypto.randomUUID()}`; publishPending([...pendingTokens(), token]); return token; }
function finishPending(token: string) { publishPending(pendingTokens().filter((item) => item !== token)); }
export function getPendingSyncCount() { return typeof window === "undefined" ? 0 : pendingTokens().length; }

function readLocal(key: SharedKey): SharedRecord[] {
  try { const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as SharedRecord[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function clean(record: SharedRecord) { return JSON.parse(JSON.stringify(record)) as SharedRecord; }
function storeLocal(key: SharedKey, records: SharedRecord[]) {
  localStorage.setItem(key, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("buyala:shared-data", { detail: { key } }));
}

async function upload(key: SharedKey, records: SharedRecord[]) {
  const token = beginPending(key);
  const name = collectionForKey[key];
  await Promise.all(records.map((record) => setDoc(doc(firestore, name, record.id), clean(record))));
  finishPending(token);
}

export async function hydrateSharedData(role: "Data Clerk" | "Engineer") {
  const keys = (Object.values(sharedKeys) as SharedKey[]).filter((key) => role === "Engineer" || key !== sharedKeys.auditEvents);
  await Promise.all(keys.map(async (key) => {
    try {
      const snapshot = await getDocs(collection(firestore, collectionForKey[key]));
      const remote = snapshot.docs.map((item) => item.data() as SharedRecord);
      const local = readLocal(key);
      if (remote.length) storeLocal(key, remote);
      else if (local.length) await upload(key, local);
    } catch { /* Device-local data remains available if Firebase cannot be reached. */ }
  }));
}

export function subscribeSharedData(role: "Data Clerk" | "Engineer") {
  const stops: Unsubscribe[] = [];
  (Object.values(sharedKeys) as SharedKey[]).filter((key) => role === "Engineer" || key !== sharedKeys.auditEvents).forEach((key) => {
    stops.push(onSnapshot(collection(firestore, collectionForKey[key]), (snapshot) => {
      if (!snapshot.metadata.fromCache || snapshot.docs.length) storeLocal(key, snapshot.docs.map((item) => item.data() as SharedRecord));
    }, () => undefined));
  });
  if (getPendingSyncCount()) void waitForPendingWrites(firestore).then(() => publishPending([])).catch(() => undefined);
  return () => stops.forEach((stop) => stop());
}

export function saveSharedData<T extends { id: string }>(key: SharedKey, records: T[]) {
  storeLocal(key, records as SharedRecord[]);
  void upload(key, records as SharedRecord[]).catch(() => undefined);
}
