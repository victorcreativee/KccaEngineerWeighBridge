import { browserLocalPersistence, onAuthStateChanged, reauthenticateWithCredential, setPersistence, signInWithEmailAndPassword, signOut as firebaseSignOut, EmailAuthProvider, updatePassword, type User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "./client";

export type StaffRole = "Data Clerk" | "Engineer" | "System Admin";
export type FirebaseUserProfile = { uid: string; username: string; name: string; role: StaffRole; initials: string; active: boolean; mustChangePassword?: boolean };

function emailFor(username: string) {
  const normalized = username.trim().toLowerCase().replace(/^@+/, "").replace(/@buyalaweighbridge\.app$/, "");
  return `${normalized}@buyalaweighbridge.app`;
}

export function signInErrorMessage(error: unknown, online: boolean) {
  if (!online) return "This device is offline. Use the installed desktop app with an account that has signed in successfully before, or reconnect for web sign-in.";
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : error instanceof Error ? error.message : "";
  if (code.includes("ACCOUNT_INACTIVE") || code.includes("auth/user-disabled")) return "This account is inactive. Ask the System Admin to reactivate it in User Accounts.";
  if (code.includes("ACCOUNT_NOT_CONFIGURED")) return "Firebase accepted the password, but this staff account has no Buyala profile. Ask the System Admin to repair the account.";
  if (code.includes("auth/too-many-requests")) return "Firebase temporarily blocked sign-in after several attempts. Wait a few minutes, then try again once.";
  if (code.includes("auth/network-request-failed") || code.includes("auth/internal-error")) return "Firebase could not be reached. Check the connection and the computer’s date and time, then try again.";
  if (code.includes("auth/invalid-email")) return "Enter the assigned username, for example clerk or @clerk—not a personal email address.";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) return "The username or password does not match. You may enter clerk or @clerk; passwords are case-sensitive and must not contain an extra backslash.";
  return "Sign-in could not be completed. Refresh the app and try again, or ask the System Admin to reset this account’s password.";
}
let persistenceSetup: Promise<void> | null = null;
function preparePersistence() {
  if (!persistenceSetup) persistenceSetup = setPersistence(firebaseAuth, browserLocalPersistence);
  return persistenceSetup;
}

const cachedProfileKey = (uid: string) => `buyala.auth.profile.${uid}.v1`;
function cachedProfile(uid: string) { try { const value = JSON.parse(localStorage.getItem(cachedProfileKey(uid)) ?? "null") as FirebaseUserProfile | null; return value?.uid === uid && value.active ? value : null; } catch { return null; } }
function cacheProfile(profile: FirebaseUserProfile) { localStorage.setItem(cachedProfileKey(profile.uid), JSON.stringify(profile)); }

async function profileFor(user: User): Promise<FirebaseUserProfile> {
  try {
    const snapshot = await getDoc(doc(firestore, "profiles", user.uid));
    if (!snapshot.exists()) throw new Error("ACCOUNT_NOT_CONFIGURED");
    const profile = snapshot.data() as Omit<FirebaseUserProfile, "uid">;
    if (!profile.active) throw new Error("ACCOUNT_INACTIVE");
    const result = { uid: user.uid, ...profile }; cacheProfile(result); return result;
  } catch (error) {
    if (typeof navigator !== "undefined" && !navigator.onLine) { const saved = cachedProfile(user.uid); if (saved) return saved; }
    throw error;
  }
}

export async function signIn(username: string, password: string) {
  await preparePersistence();
  const credential = await signInWithEmailAndPassword(firebaseAuth, emailFor(username), password);
  try { return await profileFor(credential.user); } catch (error) { await firebaseSignOut(firebaseAuth); throw error; }
}

export async function signOut() { await firebaseSignOut(firebaseAuth); }

export function observeUser(callback: (profile: FirebaseUserProfile | null) => void) {
  let stop: (() => void) | undefined;
  let cancelled = false;
  void preparePersistence().then(() => {
    if (cancelled) return;
    stop = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) return callback(null);
      try { callback(await profileFor(user)); } catch { await firebaseSignOut(firebaseAuth); callback(null); }
    });
  }).catch(() => callback(null));
  return () => { cancelled = true; stop?.(); };
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = firebaseAuth.currentUser;
  if (!user?.email) throw new Error("NOT_SIGNED_IN");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
  try { await updateDoc(doc(firestore, "profiles", user.uid), { mustChangePassword: false }); }
  catch { throw new Error("PASSWORD_CHANGED_PROFILE_PENDING"); }
}
