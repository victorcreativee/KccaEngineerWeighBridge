"use client";

import { FormEvent, useEffect, useState } from "react";
import { MasterDataView } from "../src/features/master-data/MasterDataView";
import { OperationsFlow } from "../src/features/operations/OperationsFlow";
import { ConnectionStatus } from "../src/components/ConnectionStatus";
import { RecordsView } from "../src/features/records/RecordsView";
import { DashboardView } from "../src/features/dashboard/DashboardView";
import { ReportsView } from "../src/features/reports/ReportsView";
import { AuditLogView } from "../src/features/audit/AuditLogView";
import { logAudit } from "../src/utils/localAudit";
import { AccountManagementView } from "../src/features/accounts/AccountManagementView";
import { MyAccountView } from "../src/features/accounts/MyAccountView";
import { observeUser, signIn as firebaseSignIn, signOut as firebaseSignOut } from "../src/services/firebase/auth";
import { hydrateSharedData, subscribeSharedData } from "../src/services/firebase/sharedData";
import { AppSettingsView } from "../src/features/settings/AppSettingsView";

type LocalUser = { uid: string; username: string; name: string; role: "Data Clerk" | "Engineer" | "System Admin"; initials: string; mustChangePassword?: boolean };
const adminNavItems = ["Dashboard", "Daily Operations", "Records", "Reports", "Vehicles", "Drivers", "User Accounts", "Audit Log", "App Settings", "My Account"];
const engineerNavItems = ["Dashboard", "Daily Operations", "Records", "Reports", "Vehicles", "Drivers", "User Accounts", "My Account"];
const clerkNavItems = ["Dashboard", "Daily Operations", "Records", "Vehicles", "Drivers", "My Account"];
export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [user, setUser] = useState<LocalUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ kind: "vehicles" | "drivers"; value: string } | null>(null);

  useEffect(() => {
    let stopDataSync: (() => void) | undefined;
    const unsubscribe = observeUser(async (restored) => {
      stopDataSync?.(); stopDataSync = undefined;
      if (restored) { await hydrateSharedData(restored.role); stopDataSync = subscribeSharedData(restored.role); }
      setUser(restored);
      if (restored) setActive(restored.mustChangePassword ? "My Account" : restored.role === "Data Clerk" ? "Daily Operations" : "Dashboard");
      setSessionReady(true);
    });
    return () => { stopDataSync?.(); unsubscribe(); };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoginError(""); const data = new FormData(event.currentTarget); const username = String(data.get("username") ?? "").trim().toLowerCase(); const password = String(data.get("password") ?? ""); try { const nextUser = await firebaseSignIn(username, password); logAudit(nextUser.name, nextUser.role, "SIGN_IN", "Signed in with Firebase Authentication", nextUser.username); setUser(nextUser); setActive(nextUser.mustChangePassword ? "My Account" : nextUser.role === "Data Clerk" ? "Daily Operations" : "Dashboard"); } catch { setLoginError(navigator.onLine ? "Username or password is incorrect, or this account is inactive." : "Internet is required for this first Firebase sign-in. Offline sign-in will be added next."); } }
  async function signOut() { if (user) logAudit(user.name, user.role, "SIGN_OUT", "Signed out of Firebase Authentication"); await firebaseSignOut(); setUser(null); setActive("Dashboard"); setShowMobileMore(false); }
  function passwordChanged() { if (!user) return; const nextUser = { ...user, mustChangePassword: false }; setUser(nextUser); setActive(nextUser.role === "Data Clerk" ? "Daily Operations" : "Dashboard"); }

  if (!sessionReady) return <main className="session-loading" aria-label="Opening Buyala"><span className="brand-mark large" aria-hidden="true">B</span><p>Opening Buyala…</p></main>;
  if (!user) {
    return (
      <main className="access-page">
        <section className="access-brand" aria-label="Buyala Waste Operations">
          <div className="access-brand-content">
            <span className="brand-mark large" aria-hidden="true">B</span>
            <p className="eyebrow light">Buyala Waste Management Facility</p>
            <h1>Waste operations,<br />made simpler.</h1>
            <p>A focused weighbridge system designed to make every vehicle transaction faster, clearer and safer.</p>
            <ul><li>Fast vehicle and driver lookup</li><li>Automatic weight calculations</li><li>Reliable daily records</li></ul>
          </div>
        </section>
        <section className="access-panel">
          <div className="access-card">
            <p className="access-kicker">SECURE FIREBASE ACCESS</p>
            <h2>Sign in to Buyala</h2>
            <p className="access-copy">Use your assigned Buyala account.</p>
            <form className="local-login-form" onSubmit={signIn}><label>Username<input name="username" autoComplete="username" required /></label><label>Password<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></div></label>{loginError && <p className="login-error" role="alert">{loginError}</p>}<button className="access-button" type="submit">Sign in <span aria-hidden="true">→</span></button></form>
            <div className="local-access-note"><span aria-hidden="true">i</span><p><strong>Firebase Authentication</strong>Your password and role now follow your account securely across connected devices.</p></div>
            <div className="account-role-preview"><span><b>Data Clerk</b>Daily entry and operational records</span><span><b>Engineer</b>Operations, reports and staff accounts</span><span><b>System Admin</b>Full access and technical administration</span></div>
            <p className="access-footer">No public registration · Assigned staff accounts only</p>
          </div>
        </section>
      </main>
    );
  }
  if (user.mustChangePassword) return <MyAccountView user={user} forced onPasswordChanged={passwordChanged} onSignOut={signOut} />;
  const navItems = user.role === "System Admin" ? adminNavItems : user.role === "Engineer" ? engineerNavItems : clerkNavItems;
  const moreItems = navItems.filter((item) => ["Reports", "Vehicles", "Drivers", "User Accounts", "Audit Log", "App Settings", "My Account"].includes(item));
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand"><span className="brand-mark" aria-hidden="true">B</span><div><strong>Buyala</strong><span>Waste Operations</span></div></div>
        <nav>{navItems.map((item) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}><span className="nav-icon" aria-hidden="true">{item.charAt(0)}</span>{item}</button>)}</nav>
          <div className="sidebar-footer"><ConnectionStatus /></div>
      </aside>
      <main>
        <header className="topbar">
          <div><p className="eyebrow">Buyala Waste Management Facility</p><h1>{active}</h1></div>
          <div className="topbar-tools"><ConnectionStatus compact /><div className="operator"><span>{user.initials}</span><div><strong>{user.name}</strong><small>{user.role} · Firebase account</small></div><button className="sign-out" onClick={signOut}>Sign out</button></div></div>
        </header>
        <section className="content" aria-label="Dashboard overview">
          {active === "Daily Operations" ? (
            <OperationsFlow operatorName={user.name} onAddVehicle={(value) => { setQuickAdd({ kind: "vehicles", value }); setActive("Vehicles"); }} onAddDriver={(value) => { setQuickAdd({ kind: "drivers", value }); setActive("Drivers"); }} />
          ) : active === "Records" ? (
            <RecordsView canManage={user.role !== "Data Clerk"} actorName={user.name} onContinueEntry={(id) => { localStorage.setItem("buyala.local.resumeEntryId", id); setActive("Daily Operations"); }} />
          ) : active === "Vehicles" || active === "Drivers" ? (
            <MasterDataView kind={active === "Vehicles" ? "vehicles" : "drivers"} autoOpen={quickAdd?.kind === (active === "Vehicles" ? "vehicles" : "drivers")} initialValue={quickAdd?.value ?? ""} onQuickAddClosed={() => setQuickAdd(null)} onSaved={() => { setQuickAdd(null); setActive("Daily Operations"); }} />
          ) : active === "Reports" ? (
            <ReportsView />
          ) : active === "Audit Log" ? (
            <AuditLogView />
          ) : active === "App Settings" ? (
            <AppSettingsView />
          ) : active === "User Accounts" ? (
            <AccountManagementView engineerName={user.name} />
          ) : active === "My Account" ? (
            <MyAccountView user={user} onPasswordChanged={passwordChanged} />
          ) : <DashboardView onRecordVehicle={() => setActive("Daily Operations")} onViewRecords={() => setActive("Records")} />}
        </section>
        {showMobileMore && <><button className="mobile-more-scrim" aria-label="Close more menu" onClick={() => setShowMobileMore(false)} /><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"><div className="mobile-more-heading"><div><p>{user.role}</p><h2 id="mobile-more-title">More</h2></div><button aria-label="Close menu" onClick={() => setShowMobileMore(false)}>×</button></div>{moreItems.map((item) => <button key={item} className={active === item ? "selected" : ""} onClick={() => { setActive(item); setShowMobileMore(false); }}><span className="more-icon" aria-hidden="true">{item.charAt(0)}</span><span><strong>{item}</strong><small>{item === "Reports" ? "Daily and date-range summaries" : item === "Vehicles" ? "Vehicle database and defaults" : item === "Drivers" ? "Driver names and telephone numbers" : item === "User Accounts" ? "Firebase staff accounts and access" : item === "App Settings" ? "Installation, synchronization and offline tools" : item === "My Account" ? "Change your own password" : "Account and operational activity"}</small></span><b aria-hidden="true">›</b></button>)}<button className="mobile-sign-out" onClick={signOut}><span className="more-icon">S</span><span><strong>Sign out</strong><small>End this local session</small></span><b>›</b></button></section></>}
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {["Dashboard", "Daily Operations", "Records"].map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => { setActive(item); setShowMobileMore(false); }}><span>{item.charAt(0)}</span>{item === "Daily Operations" ? "Operations" : item}</button>)}
          <button className={showMobileMore || moreItems.includes(active) ? "active" : ""} onClick={() => setShowMobileMore(true)} aria-haspopup="dialog" aria-expanded={showMobileMore}><span>•••</span>More</button>
        </nav>
      </main>
      <ConnectionStatus notice />
    </div>
  );
}
