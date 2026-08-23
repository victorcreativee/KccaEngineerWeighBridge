"use client";

import { FormEvent, useEffect, useState } from "react";
import { createDataClerk, listStaffAccounts, setStaffActive } from "../../services/firebase/accountAdmin";
import type { FirebaseUserProfile } from "../../services/firebase/auth";
import { logAudit } from "../../utils/localAudit";

export function AccountManagementView({ engineerName }: { engineerName: string }) {
  const [accounts, setAccounts] = useState<FirebaseUserProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { listStaffAccounts().then(setAccounts).catch(() => setError("Staff accounts could not be loaded. Check the internet connection.")).finally(() => setLoading(false)); }, []);

  async function createClerk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    const name = String(data.get("fullName") ?? "").trim(); const username = String(data.get("username") ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const temporaryPassword = String(data.get("password") ?? ""); const confirmation = String(data.get("confirmPassword") ?? "");
    if (!name) return setError("Enter the clerk's full name.");
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return setError("Use 3–30 lowercase letters, numbers, dots, underscores or hyphens.");
    if (accounts.some((account) => account.username === username)) return setError("That username already exists.");
    if (temporaryPassword.length < 10) return setError("Use a temporary password with at least 10 characters.");
    if (temporaryPassword !== confirmation) return setError("The two passwords do not match.");
    setSaving(true);
    try { const account = await createDataClerk({ name, username, temporaryPassword }); setAccounts((current) => [...current, account].sort((a, b) => a.name.localeCompare(b.name))); logAudit(engineerName, "Engineer", "ACCOUNT_CREATED", `Created Firebase Data Clerk account for ${name}`, username); setMessage(`@${username} is ready. Give the temporary password privately; it must be changed at first sign-in.`); setShowCreate(false); form.reset(); }
    catch { setError(navigator.onLine ? "Firebase could not create this account. The username may already be registered." : "Connect to the internet before creating an account."); }
    finally { setSaving(false); }
  }

  async function toggleAccount(account: FirebaseUserProfile) {
    if (account.role !== "Data Clerk") return; setError(""); setMessage("");
    try { await setStaffActive(account.uid, !account.active); setAccounts((current) => current.map((item) => item.uid === account.uid ? { ...item, active: !item.active } : item)); logAudit(engineerName, "Engineer", account.active ? "ACCOUNT_DEACTIVATED" : "ACCOUNT_REACTIVATED", `${account.active ? "Deactivated" : "Reactivated"} Firebase Data Clerk ${account.name}`, account.username); setMessage(`${account.name} ${account.active ? "deactivated" : "reactivated"}. Firebase data access changed immediately.`); }
    catch { setError("The account could not be updated. Check the internet connection and try again."); }
  }

  return <div className="accounts-page">
    <div className="accounts-heading"><div><h2>User accounts</h2><p>Create and control protected Firebase staff access.</p></div><div className="accounts-heading-actions"><span>{accounts.length} staff</span><button onClick={() => { setShowCreate((shown) => !shown); setError(""); }}>{showCreate ? "Close" : "+ New Data Clerk"}</button></div></div>
    {message && <p className="account-message" role="status">{message}</p>}{error && !showCreate && <p className="account-error" role="alert">{error}</p>}
    {showCreate && <section className="create-account-panel"><div><p className="master-kicker">NEW FIREBASE ACCOUNT</p><h3>Add a Data Clerk</h3><p>Create the username and a private temporary password. The clerk must replace it at first sign-in.</p></div><form onSubmit={createClerk}><label>Full name<input name="fullName" autoComplete="name" required /></label><label>Username<input name="username" autoComplete="off" placeholder="e.g. clerk2" required /></label><label>Temporary password<input name="password" type="password" minLength={10} autoComplete="new-password" required /></label><label>Confirm password<input name="confirmPassword" type="password" minLength={10} autoComplete="new-password" required /></label>{error && <span>{error}</span>}<div><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Creating securely…" : "Create Data Clerk"}</button></div></form></section>}
    <section className="account-cards">{loading ? <p>Loading Firebase staff accounts…</p> : accounts.map((account) => <article className={account.active ? "" : "disabled"} key={account.uid}><span className="account-avatar">{account.initials}</span><div><p>{account.role}</p><h3>{account.name}</h3><span>@{account.username} · Firebase Authentication</span><small>{account.mustChangePassword ? "Password change required at next sign-in" : "Private password established"}</small></div><div className="account-state"><b>{account.active ? "Active" : "Inactive"}</b>{account.role === "Data Clerk" && <button className="toggle-account" onClick={() => toggleAccount(account)}>{account.active ? "Deactivate" : "Reactivate"}</button>}</div></article>)}</section>
    <section className="permissions-panel"><div><p className="master-kicker">ROLE PERMISSIONS</p><h3>Who can do what</h3><p>Engineers manage operations and Data Clerk accounts. Technical settings and audit logs remain restricted to System Admin.</p></div><div className="permissions-table" role="table" aria-label="Role permissions"><div className="permissions-row heading" role="row"><span>Action</span><b>Clerk</b><b>Engineer</b><b>Admin</b></div>{[["Record and complete vehicles",true,true,true],["Manage vehicles and drivers",true,true,true],["Correct completed records",false,true,true],["View and export reports",false,true,true],["Manage Data Clerk accounts",false,true,true],["Audit log and app settings",false,false,true]].map(([label,clerk,engineer,admin]) => <div className="permissions-row" role="row" key={String(label)}><span>{label}</span><b className={clerk ? "allowed" : "denied"}>{clerk ? "✓ Yes" : "— No"}</b><b className={engineer ? "allowed" : "denied"}>{engineer ? "✓ Yes" : "— No"}</b><b className={admin ? "allowed" : "denied"}>{admin ? "✓ Yes" : "— No"}</b></div>)}</div></section>
  </div>;
}
