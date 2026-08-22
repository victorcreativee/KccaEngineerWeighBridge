import { onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut as firebaseSignOut, EmailAuthProvider, updatePassword, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "./client";

export type FirebaseUserProfile = { uid: string; username: string; name: string; role: "Data Clerk" | "Engineer"; initials: string; active: boolean; mustChangePassword?: boolean };

function emailFor(username: string) { return `${username.trim().toLowerCase()}@buyalaweighbridge.app`; }

async function profileFor(user: User): Promise<FirebaseUserProfile> {
  const snapshot = await getDoc(doc(firestore, "profiles", user.uid));
  if (!snapshot.exists()) throw new Error("ACCOUNT_NOT_CONFIGURED");
  const profile = snapshot.data() as Omit<FirebaseUserProfile, "uid">;
  if (!profile.active) throw new Error("ACCOUNT_INACTIVE");
  return { uid: user.uid, ...profile };
}

export async function signIn(username: string, password: string) {
  const credential = await signInWithEmailAndPassword(firebaseAuth, emailFor(username), password);
  try { return await profileFor(credential.user); } catch (error) { await firebaseSignOut(firebaseAuth); throw error; }
}

export async function signOut() { await firebaseSignOut(firebaseAuth); }

export function observeUser(callback: (profile: FirebaseUserProfile | null) => void) {
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) return callback(null);
    try { callback(await profileFor(user)); } catch { await firebaseSignOut(firebaseAuth); callback(null); }
  });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = firebaseAuth.currentUser;
  if (!user?.email) throw new Error("NOT_SIGNED_IN");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}
