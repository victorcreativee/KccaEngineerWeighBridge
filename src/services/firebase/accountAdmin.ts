import { deleteUser, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { firebaseConfig, firestore } from "./client";
import type { FirebaseUserProfile } from "./auth";

const secondaryName = "buyala-account-creator";
function emailFor(username: string) { return `${username.trim().toLowerCase()}@buyalaweighbridge.app`; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DC"; }
export async function listStaffAccounts() { const snapshot = await getDocs(collection(firestore, "profiles")); return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as FirebaseUserProfile)).sort((a, b) => a.name.localeCompare(b.name)); }
export async function createDataClerk(input: { name: string; username: string; temporaryPassword: string }) {
  const secondaryApp = getApps().find((app) => app.name === secondaryName) ?? initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(getApp(secondaryApp.name));
  const credential = await createUserWithEmailAndPassword(secondaryAuth, emailFor(input.username), input.temporaryPassword);
  const profile: Omit<FirebaseUserProfile, "uid"> & { createdAt: string } = { username: input.username, name: input.name, role: "Data Clerk", initials: initials(input.name), active: true, mustChangePassword: true, createdAt: new Date().toISOString() };
  try { await setDoc(doc(firestore, "profiles", credential.user.uid), profile); } catch (error) { await deleteUser(credential.user).catch(() => undefined); throw error; }
  await signOut(secondaryAuth).catch(() => undefined); return { uid: credential.user.uid, ...profile } as FirebaseUserProfile;
}
export async function setStaffActive(uid: string, active: boolean) { await updateDoc(doc(firestore, "profiles", uid), { active }); }
