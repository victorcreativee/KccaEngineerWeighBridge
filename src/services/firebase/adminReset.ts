import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { firebaseAuth, firestore } from "./client";

export type ResetScope = "transactions" | "operations" | "fresh";
const operationalCollections = ["entries", "recoveryEntries", "auditEvents", "offlineDiagnostics"] as const;
const masterCollections = ["vehicles", "drivers"] as const;
const localKeys: Record<string, string> = { entries: "buyala.local.entries.v1", recoveryEntries: "buyala.local.recovery.v1", auditEvents: "buyala.local.audit.v1", vehicles: "buyala.local.vehicles.v1", drivers: "buyala.local.drivers.v1" };
function collectionsFor(scope: ResetScope) { if (scope === "transactions") return ["entries"]; return scope === "fresh" ? [...operationalCollections, ...masterCollections] : [...operationalCollections]; }

export async function prepareResetBackup(scope: ResetScope) {
  const names: string[] = collectionsFor(scope); const backup: Record<string, unknown> = { schemaVersion: 4, application: "Buyala Waste Operations", purpose: "Pre-reset recovery backup", resetScope: scope, exportedAt: new Date().toISOString() };
  for (const name of [...names, "profiles"]) { const snapshot = await getDocs(collection(firestore, name)); backup[name] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); }
  return backup;
}

export async function resetTrainingData(scope: ResetScope, password: string, adminName: string) {
  const user = firebaseAuth.currentUser; if (!user?.email) throw new Error("NOT_SIGNED_IN");
  const profile = await getDoc(doc(firestore, "profiles", user.uid)); if (!profile.exists() || profile.data().role !== "System Admin" || profile.data().active !== true) throw new Error("ADMIN_REQUIRED");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const names: string[] = collectionsFor(scope);
  for (const name of names) { const snapshot = await getDocs(collection(firestore, name)); for (let start = 0; start < snapshot.docs.length; start += 450) { const batch = writeBatch(firestore); snapshot.docs.slice(start, start + 450).forEach((item) => batch.delete(item.ref)); await batch.commit(); } }
  const resetAt = new Date().toISOString();
  await setDoc(doc(firestore, "systemState", "current"), { resetAt, resetBy: adminName, resetScope: scope, clearedCollections: names, serverResetAt: serverTimestamp() }, { merge: true });
  const details = scope === "transactions" ? "All weighbridge transactions cleared; vehicles, drivers, materials recovery and accounts preserved" : scope === "fresh" ? "Started fresh after training; operational and master records cleared" : "Training operational records cleared; vehicles and drivers preserved";
  const auditId = crypto.randomUUID(); await setDoc(doc(firestore, "auditEvents", auditId), { id: auditId, at: resetAt, actor: adminName, role: "System Admin", action: scope === "transactions" ? "TRANSACTIONS_RESET" : "TRAINING_DATA_RESET", details });
  Object.entries(localKeys).forEach(([name, key]) => { if (names.includes(name)) localStorage.setItem(key, "[]"); });
  ["buyala.local.operationDraft.v1", "buyala.local.resumeEntryId", "buyala.offline.test.v1", "buyala.sync.pending.v1", "buyala.sync.outbox.v2"].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem("buyala.reset.appliedAt", resetAt); window.dispatchEvent(new Event("buyala:sync-status")); return resetAt;
}
