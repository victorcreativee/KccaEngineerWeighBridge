"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let availableInstallPrompt: InstallPrompt | null = null;
let activeRegistration: ServiceWorkerRegistration | null = null;
let availableUpdateWorker: ServiceWorker | null = null;
export type AppUpdateResult = "available" | "current" | "offline" | "unsupported" | "failed";
export function canInstallApp() { return availableInstallPrompt !== null; }
export async function requestAppInstall() {
  if (!availableInstallPrompt) return false;
  await availableInstallPrompt.prompt();
  const choice = await availableInstallPrompt.userChoice;
  if (choice.outcome === "accepted") { availableInstallPrompt = null; window.dispatchEvent(new Event("buyala:install-status")); return true; }
  return false;
}

function announceUpdateStatus() { window.dispatchEvent(new Event("buyala:update-status")); }

export async function checkForAppUpdate(): Promise<AppUpdateResult> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!navigator.onLine) return "offline";
  try {
    const registration = activeRegistration ?? await navigator.serviceWorker.getRegistration();
    if (!registration) return "unsupported";
    activeRegistration = registration;
    await registration.update();
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        const worker = registration.installing;
        const timeout = window.setTimeout(resolve, 15000);
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" || worker.state === "redundant") {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
    availableUpdateWorker = registration.waiting;
    announceUpdateStatus();
    return availableUpdateWorker ? "available" : "current";
  } catch {
    return "failed";
  }
}

export async function applyAvailableAppUpdate() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = activeRegistration ?? await navigator.serviceWorker.getRegistration();
  const worker = availableUpdateWorker ?? registration?.waiting ?? null;
  if (!worker) return false;
  availableUpdateWorker = worker;
  worker.postMessage({ type: "SKIP_WAITING" });
  window.setTimeout(() => window.location.reload(), 3000);
  return true;
}

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateExpanded, setUpdateExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
      availableUpdateWorker = null;
      setWaiting(null);
      setDismissed(true);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadForUpdate);
    let registration: ServiceWorkerRegistration | undefined;
    function inspect(worker: ServiceWorker | null) {
      if (!worker) return;
      if (worker.state === "installed" && navigator.serviceWorker.controller) { availableUpdateWorker = worker; setWaiting(worker); setDismissed(false); setUpdateExpanded(false); announceUpdateStatus(); }
      worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) { availableUpdateWorker = worker; setWaiting(worker); setDismissed(false); setUpdateExpanded(false); announceUpdateStatus(); } });
    }
    navigator.serviceWorker.register("/sw.js").then((registered) => {
      registration = registered;
      activeRegistration = registered;
      if (registered.waiting) { availableUpdateWorker = registered.waiting; setWaiting(registered.waiting); announceUpdateStatus(); }
      registered.addEventListener("updatefound", () => inspect(registered.installing));
    }).catch(() => undefined);
    const check = () => registration?.update().catch(() => undefined);
    const interval = window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", check); window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); navigator.serviceWorker.removeEventListener("controllerchange", reloadForUpdate); };
  }, []);
  function applyUpdate() {
    if (!waiting) return;
    setWaiting(null);
    setDismissed(true);
    void applyAvailableAppUpdate();
  }
  async function installApp() { if (await requestAppInstall()) setInstallPrompt(null); }
  if (waiting && !dismissed) return <><button className="mobile-update-chip" aria-label="A newer app version is ready" aria-expanded={updateExpanded} onClick={() => setUpdateExpanded(true)}><span aria-hidden="true">↑</span><b>Update ready</b></button><aside className={updateExpanded ? "app-update-notice" : "app-update-notice collapsed-on-mobile"} role="status"><div><strong>A newer app version is ready</strong><p>Your offline records, pending synchronization and unfinished draft will remain safe.</p></div><div className="update-actions"><button className="update-later" onClick={() => { setDismissed(true); setUpdateExpanded(false); }}>Later</button><button onClick={applyUpdate}>Refresh app</button></div></aside></>;
  return installPrompt ? <aside className="app-update-notice install-app" role="status"><div><strong>Install Buyala on this computer</strong><p>Open it like a desktop application and continue working without internet after the first sign-in.</p></div><button onClick={installApp}>Install app</button></aside> : null;
}
