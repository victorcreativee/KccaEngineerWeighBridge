"use client";

import { useEffect, useState } from "react";
import { canInstallApp, requestAppInstall } from "../../components/PwaRegister";
import { firebaseAuth } from "../../services/firebase/client";
import { armOfflineTest, finishOfflineTest, getOfflineTestState, queueOfflineTest, resetOfflineTest, type OfflineTestState } from "../../services/firebase/offlineTest";
import { getLastSuccessfulSync, getPendingSyncCount, synchronizeNow } from "../../services/firebase/sharedData";

const dataKeys = ["buyala.local.vehicles.v1", "buyala.local.drivers.v1", "buyala.local.entries.v1", "buyala.local.audit.v1"];
function installed() { return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true); }
function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.hidden = true; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 2000); }
function backupData() { return { schemaVersion: 2, application: "Buyala Waste Operations", exportedAt: new Date().toISOString(), vehicles: JSON.parse(localStorage.getItem(dataKeys[0]) ?? "[]"), drivers: JSON.parse(localStorage.getItem(dataKeys[1]) ?? "[]"), entries: JSON.parse(localStorage.getItem(dataKeys[2]) ?? "[]"), auditEvents: JSON.parse(localStorage.getItem(dataKeys[3]) ?? "[]") }; }
type ReadinessItem = { label: string; ready: boolean; detail: string };
function readinessItems(): ReadinessItem[] {
  const controlled = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
  const signedIn = Boolean(firebaseAuth.currentUser);
  const pending = getPendingSyncCount();
  return [
    { label: "Offline app files", ready: controlled, detail: controlled ? "Saved on this computer" : "Reload once while online" },
    { label: "Offline database", ready: "indexedDB" in window, detail: "indexedDB" in window ? "Available" : "Not supported by this browser" },
    { label: "Assigned account", ready: signedIn, detail: signedIn ? "Signed in and retained" : "Sign in while online first" },
    { label: "Firebase synchronization", ready: pending === 0, detail: pending === 0 ? "No changes waiting" : `${pending} change${pending === 1 ? "" : "s"} waiting` },
  ];
}

export function AppSettingsView() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(getPendingSyncCount);
  const [lastSync, setLastSync] = useState(getLastSuccessfulSync);
  const [isInstalled, setInstalled] = useState(installed);
  const [installReady, setInstallReady] = useState(canInstallApp);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessItem[]>([]);
  const [offlineTest, setOfflineTest] = useState<OfflineTestState>(getOfflineTestState);
  const [finishingTest, setFinishingTest] = useState(false);
  useEffect(() => {
    const refresh = () => { setOnline(navigator.onLine); setPending(getPendingSyncCount()); setLastSync(getLastSuccessfulSync()); setInstalled(installed()); setInstallReady(canInstallApp()); };
    window.addEventListener("online", refresh); window.addEventListener("offline", refresh); window.addEventListener("buyala:sync-status", refresh); window.addEventListener("buyala:install-status", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); window.removeEventListener("buyala:sync-status", refresh); window.removeEventListener("buyala:install-status", refresh); };
  }, []);
  useEffect(() => {
    const refreshTest = () => setOfflineTest(getOfflineTestState());
    window.addEventListener("buyala:offline-test", refreshTest);
    return () => window.removeEventListener("buyala:offline-test", refreshTest);
  }, []);
  async function install() { if (await requestAppInstall()) { setInstalled(true); setMessage("Buyala was installed successfully."); } else setMessage("Use the browser menu and choose Install Buyala Waste Operations."); }
  async function sync() { setSyncing(true); setMessage(""); try { await synchronizeNow("Engineer"); setMessage("Device and Firebase are fully synchronized."); } catch { setMessage("Synchronization needs an internet connection. Offline records remain safe."); } finally { setSyncing(false); setPending(getPendingSyncCount()); setLastSync(getLastSuccessfulSync()); } }
  function backup() { download(new Blob([JSON.stringify(backupData(), null, 2)], { type: "application/json" }), `buyala-full-backup-${new Date().toISOString().slice(0, 10)}.json`); setMessage("Full local backup downloaded."); }
  function checkReadiness() { const result = readinessItems(); setReadiness(result); setMessage(result.every((item) => item.ready) ? "This computer is ready for a controlled offline field test." : "Complete the items marked Needs attention before going offline."); }
  async function prepareOfflineTest() { if (!online) return setMessage("Reconnect to the internet before preparing the test."); setSyncing(true); try { await synchronizeNow("Engineer"); setOfflineTest(armOfflineTest()); setMessage("Test prepared. Disconnect this computer from the internet, return here, then save the offline test record."); } catch { setMessage("Preparation could not synchronize. Keep the internet connected and try again."); } finally { setSyncing(false); } }
  function saveOfflineTest() { try { setOfflineTest(queueOfflineTest()); setMessage("Offline test record saved locally. Reconnect the internet, then verify synchronization."); } catch { setMessage("The computer must be offline and the Engineer must remain signed in."); } }
  async function verifyOfflineTest() { setFinishingTest(true); try { const state = await finishOfflineTest(); setOfflineTest(state); setMessage("Offline save synchronized successfully. This computer passed the controlled test."); } catch { setMessage("The test record is still waiting. Keep the app connected and try verification again."); } finally { setFinishingTest(false); } }
  return <div className="app-settings-page">
    <div className="settings-heading"><div><p className="master-kicker">ENGINEER SETTINGS</p><h2>App & offline settings</h2><p>Install, synchronize, back up and prepare Buyala for computer-based operation.</p></div><span>Version 0.2 · Firebase pilot</span></div>
    <section className="settings-status-grid"><article><span>Application</span><strong>{isInstalled ? "Installed" : "Browser version"}</strong><small>{isInstalled ? "Running as a desktop app" : "Install it for desktop access"}</small></article><article className={online ? "good" : "attention"}><span>Connection</span><strong>{online ? "Online" : "Offline"}</strong><small>{online ? "Firebase is reachable" : "Using the offline database"}</small></article><article className={pending ? "attention" : "good"}><span>Synchronization</span><strong>{pending ? `${pending} pending` : "Up to date"}</strong><small>{lastSync ? `Last successful: ${new Date(lastSync).toLocaleString("en-UG")}` : "No completed synchronization recorded"}</small></article></section>
    {message && <p className="settings-message" role="status">{message}</p>}
    <section className="settings-card recommended"><div><p className="master-kicker">RECOMMENDED</p><h3>Install from the browser</h3><p>Installs the same secure app on Windows or macOS. It receives updates automatically and works offline after the first online sign-in.</p><ul><li>Windows: use Microsoft Edge or Chrome</li><li>macOS: use Chrome</li><li>Wait for “Synced” before the first offline session</li></ul></div><button onClick={install} disabled={isInstalled}>{isInstalled ? "Already installed ✓" : installReady ? "Install desktop app" : "Show installation help"}</button></section>
    <section className="settings-card"><div><p className="master-kicker">DATA CONTROL</p><h3>Synchronization and backup</h3><p>Manual synchronization confirms all queued changes have reached Firebase. The backup contains the records retained on this computer.</p></div><div className="settings-actions"><button onClick={sync} disabled={syncing || !online}>{syncing ? "Synchronizing…" : "Sync now"}</button><button className="secondary" onClick={backup}>Download full backup</button></div></section>
    <section className="settings-card readiness-card"><div><p className="master-kicker">OFFLINE ACCEPTANCE</p><h3>Computer readiness check</h3><p>Run this check while connected, immediately before testing or operating without internet.</p>{readiness.length > 0 && <div className="readiness-results">{readiness.map((item) => <div className={item.ready ? "ready" : "not-ready"} key={item.label}><span aria-hidden="true">{item.ready ? "✓" : "!"}</span><p><strong>{item.label}</strong><small>{item.detail}</small></p></div>)}</div>}</div><button onClick={checkReadiness}>Run readiness check</button></section>
    <section className="offline-test-card"><div><p className="master-kicker">CONTROLLED FIELD TEST</p><h3>Prove that offline saving and synchronization work</h3><p>This diagnostic does not create a vehicle transaction and will not appear in operational reports.</p></div><div className="offline-test-progress"><span className={offlineTest.phase !== "idle" ? "done" : "active"}>1 <b>Prepare online</b></span><span className={offlineTest.phase === "queued" || offlineTest.phase === "passed" ? "done" : offlineTest.phase === "armed" && !online ? "active" : ""}>2 <b>Save while offline</b></span><span className={offlineTest.phase === "passed" ? "done" : offlineTest.phase === "queued" ? "active" : ""}>3 <b>Reconnect and verify</b></span></div><div className="offline-test-actions">{offlineTest.phase === "idle" && <button onClick={prepareOfflineTest} disabled={!online || syncing}>Prepare field test</button>}{offlineTest.phase === "armed" && <button onClick={saveOfflineTest} disabled={online}>Save offline test record</button>}{offlineTest.phase === "armed" && online && <small>Disconnect the internet to enable the next step.</small>}{offlineTest.phase === "queued" && !online && <strong>Saved offline ✓ Now reconnect the internet.</strong>}{offlineTest.phase === "queued" && online && <button onClick={verifyOfflineTest} disabled={finishingTest}>{finishingTest ? "Verifying synchronization…" : "Verify synchronization"}</button>}{offlineTest.phase === "passed" && <><strong className="test-passed">Offline test passed ✓</strong><small>{offlineTest.passedAt ? new Date(offlineTest.passedAt).toLocaleString("en-UG") : ""}</small><button className="secondary" onClick={() => setOfflineTest(resetOfflineTest())}>Run again</button></>}</div></section>
    <div className="settings-download-grid"><section><span>WINDOWS</span><h3>Windows installer</h3><p>The Windows `.exe` must be built and tested on the target Windows computer before distribution.</p><b>Awaiting Windows build</b></section><section className="download-ready"><span>MACOS · INTEL</span><h3>Mac pilot installer</h3><p>Unsigned version 0.2 for controlled testing on Intel Macs. The verified `.dmg` is stored in the project’s `desktop-release` folder.</p><b>Available in local project folder</b></section><section className="download-ready"><span>MAC RECOVERY</span><h3>Portable Mac archive</h3><p>The verified ZIP is stored beside the installer for backup or USB transfer. Complete the first sign-in while online.</p><b>Available in local project folder</b></section></div>
    <section className="offline-checklist"><h3>Before taking the computer offline</h3><ol><li>Open the installed Buyala app while internet is available.</li><li>Sign in and keep the assigned account signed in.</li><li>Confirm the synchronization status says “Up to date”.</li><li>Disconnect internet and record a controlled test transaction.</li><li>Reconnect and confirm pending changes return to zero.</li></ol></section>
  </div>;
}
