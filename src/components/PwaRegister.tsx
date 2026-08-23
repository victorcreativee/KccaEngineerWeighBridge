"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let availableInstallPrompt: InstallPrompt | null = null;
export function canInstallApp() { return availableInstallPrompt !== null; }
export async function requestAppInstall() {
  if (!availableInstallPrompt) return false;
  await availableInstallPrompt.prompt();
  const choice = await availableInstallPrompt.userChoice;
  if (choice.outcome === "accepted") { availableInstallPrompt = null; window.dispatchEvent(new Event("buyala:install-status")); return true; }
  return false;
}

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateExpanded, setUpdateExpanded] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const captureInstall = (event: Event) => { event.preventDefault(); availableInstallPrompt = event as InstallPrompt; setInstallPrompt(availableInstallPrompt); window.dispatchEvent(new Event("buyala:install-status")); };
    const installed = () => { availableInstallPrompt = null; setInstallPrompt(null); window.dispatchEvent(new Event("buyala:install-status")); };
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", installed);
    if (!("serviceWorker" in navigator)) return () => { window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); };
    let controllerChanged = false;
    const reloadForUpdate = () => {
      if (controllerChanged) return;
      controllerChanged = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadForUpdate);
    let registration: ServiceWorkerRegistration | undefined;
    function inspect(worker: ServiceWorker | null) {
      if (!worker) return;
      if (worker.state === "installed" && navigator.serviceWorker.controller) { setWaiting(worker); setUpdateExpanded(false); }
      worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) { setWaiting(worker); setUpdateExpanded(false); } });
    }
    navigator.serviceWorker.register("/sw.js").then((registered) => {
      registration = registered;
      if (registered.waiting) setWaiting(registered.waiting);
      registered.addEventListener("updatefound", () => inspect(registered.installing));
    }).catch(() => undefined);
    const check = () => registration?.update().catch(() => undefined);
    const interval = window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", check); window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); navigator.serviceWorker.removeEventListener("controllerchange", reloadForUpdate); };
  }, []);
  function applyUpdate() {
    if (!waiting) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; window.location.reload(); } });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }
  async function installApp() { if (await requestAppInstall()) setInstallPrompt(null); }
  if (waiting) return <><button className="mobile-update-chip" aria-label="A newer app version is ready" aria-expanded={updateExpanded} onClick={() => setUpdateExpanded(true)}><span aria-hidden="true">↑</span><b>Update ready</b></button><aside className={updateExpanded ? "app-update-notice" : "app-update-notice collapsed-on-mobile"} role="status"><div><strong>A newer app version is ready</strong><p>Your offline records, pending synchronization and unfinished draft will remain safe.</p></div><div className="update-actions"><button className="update-later" onClick={() => setUpdateExpanded(false)}>Later</button><button onClick={applyUpdate}>Refresh app</button></div></aside></>;
  return installPrompt ? <aside className="app-update-notice install-app" role="status"><div><strong>Install Buyala on this computer</strong><p>Open it like a desktop application and continue working without internet after the first sign-in.</p></div><button onClick={installApp}>Install app</button></aside> : null;
}
