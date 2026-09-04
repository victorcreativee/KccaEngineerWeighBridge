"use client";

import { FormEvent, useState } from "react";
import { logAudit } from "../../utils/localAudit";
import { changeOwnPassword } from "../../services/firebase/auth";
import { applyAvailableAppUpdate, checkForAppUpdate, type AppUpdateResult } from "../../components/PwaRegister";

type AccountUser = { username: string; name: string; role: "Data Clerk" | "Engineer" | "System Admin"; initials: string };

export function MyAccountView({ user, forced = false, onPasswordChanged, onSignOut }: { user: AccountUser; forced?: boolean; onPasswordChanged: () => void; onSignOut?: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateResult | "checking" | "applying" | "">("");

  async function checkForUpdates() {
    setUpdateStatus("checking");
    setUpdateStatus(await checkForAppUpdate());
  }

  async function installUpdate() {
    setUpdateStatus("applying");
    if (!await applyAvailableAppUpdate()) setUpdateStatus("failed");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmPassword") ?? "");
    if (newPassword.length < 10) return setError("Use a new password with at least 10 characters.");
    if (newPassword === currentPassword) return setError("Choose a password different from the current password.");
    if (newPassword !== confirmation) return setError("The two new passwords do not match.");
    setSaving(true);
    try { await changeOwnPassword(currentPassword, newPassword); logAudit(user.name, user.role, "PASSWORD_CHANGED", "Changed their Firebase account password", user.username); form.reset(); onPasswordChanged(); }
    catch (caught) { setError(!navigator.onLine ? "Connect to the internet before changing your Firebase password." : caught instanceof Error && caught.message === "PASSWORD_CHANGED_PROFILE_PENDING" ? "Your password changed, but the account screen could not finish updating. Sign out and use the new password, then try once more." : "The current password is incorrect, or Firebase could not update it."); }
    finally { setSaving(false); }
  }

  return <div className={forced ? "my-account-page forced" : "my-account-page"}>
    <section className="my-account-card">
      <div className="my-account-identity"><span>{user.initials}</span><div><p>{user.role}</p><h2>{forced ? "Create your private password" : "My account"}</h2><small>{user.name} · @{user.username}</small></div></div>
      {forced && <div className="temporary-password-notice"><strong>Password change required</strong><p>A System Admin gave you a temporary password. Replace it before opening operational records.</p></div>}
      {!forced && <p className="my-account-intro">Change your Firebase password. The new password will work on every connected device.</p>}
      <form onSubmit={changePassword}>
        <label>{forced ? "Temporary password" : "Current password"}<input name="currentPassword" type={showPasswords ? "text" : "password"} required autoComplete="current-password" /></label>
        <label>New password<input name="newPassword" type={showPasswords ? "text" : "password"} minLength={10} required autoComplete="new-password" /></label>
        <label>Confirm new password<input name="confirmPassword" type={showPasswords ? "text" : "password"} minLength={10} required autoComplete="new-password" /></label>
        <label className="show-passwords"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} /> Show passwords</label>
        {error && <p className="my-account-error" role="alert">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving securely…" : "Save new password"}</button>
      </form>
      <div className="password-guidance"><strong>Password guidance</strong><p>Use at least 10 characters and avoid names, vehicle registrations or passwords used elsewhere.</p></div>
      {!forced && <section className="account-app-update">
        <div><strong>Application updates</strong><p>When internet is available, check Firebase for the newest screens and features. Saved records remain on this device and continue synchronizing normally.</p></div>
        <button type="button" onClick={checkForUpdates} disabled={updateStatus === "checking" || updateStatus === "applying"}>{updateStatus === "checking" ? "Checking…" : "Check for updates"}</button>
        {updateStatus === "available" && <div className="account-update-ready"><p className="account-update-result" role="status">A newer version is ready for this device.</p><button type="button" onClick={installUpdate}>Update app now</button></div>}
        {updateStatus === "applying" && <p className="account-update-result" role="status">Installing the update and refreshing the application…</p>}
        {updateStatus && !["checking", "applying", "available"].includes(updateStatus) && <p className="account-update-result" role="status">{{ current: "This device already has the latest application version.", offline: "Connect to the internet, then check again.", unsupported: "Automatic checking is unavailable here. Reopen the application while online.", failed: "The update check could not finish. Please try again." }[updateStatus]}</p>}
        <small>Normal feature updates do not require reinstalling the Windows or Mac desktop application.</small>
      </section>}
      {forced && onSignOut && <button className="forced-sign-out" type="button" onClick={onSignOut}>Sign out instead</button>}
    </section>
  </div>;
}
