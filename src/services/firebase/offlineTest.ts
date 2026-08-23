import { deleteDoc, doc, getDocFromServer, setDoc, waitForPendingWrites } from "firebase/firestore";
import { firebaseAuth, firestore } from "./client";

const stateKey = "buyala.offlineAcceptance.v1";
export type OfflineTestState = { phase: "idle" | "armed" | "queued" | "passed"; id?: string; startedAt?: string; passedAt?: string };

export function getOfflineTestState(): OfflineTestState {
  if (typeof window === "undefined") return { phase: "idle" };
  try { return JSON.parse(localStorage.getItem(stateKey) ?? '{"phase":"idle"}') as OfflineTestState; } catch { return { phase: "idle" }; }
}
function save(state: OfflineTestState) { localStorage.setItem(stateKey, JSON.stringify(state)); window.dispatchEvent(new Event("buyala:offline-test")); return state; }
export function armOfflineTest() { return save({ phase: "armed", startedAt: new Date().toISOString() }); }
export function resetOfflineTest() { return save({ phase: "idle" }); }

export function queueOfflineTest() {
  if (navigator.onLine) throw new Error("DISCONNECT_FIRST");
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("NOT_SIGNED_IN");
  const id = `offline-${user.uid}-${Date.now()}`;
  const state = save({ phase: "queued", id, startedAt: getOfflineTestState().startedAt ?? new Date().toISOString() });
  void setDoc(doc(firestore, "offlineDiagnostics", id), { id, uid: user.uid, queuedAt: new Date().toISOString(), purpose: "Offline acceptance test" }).catch(() => undefined);
  return state;
}

export async function finishOfflineTest() {
  const state = getOfflineTestState();
  if (state.phase !== "queued" || !state.id || !navigator.onLine) return state;
  await waitForPendingWrites(firestore);
  const reference = doc(firestore, "offlineDiagnostics", state.id);
  const snapshot = await getDocFromServer(reference);
  if (!snapshot.exists()) throw new Error("TEST_RECORD_NOT_SYNCED");
  await deleteDoc(reference);
  await waitForPendingWrites(firestore);
  return save({ ...state, phase: "passed", passedAt: new Date().toISOString() });
}
