"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const captureInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", installed);
    if (!("serviceWorker" in navigator)) return () => { window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); };
    let registration: ServiceWorkerRegistration | undefined;
    function inspect(worker: ServiceWorker | null) {
      if (!worker) return;
      if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
      worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); });
    }
    navigator.serviceWorker.register("/sw.js").then((registered) => {
      registration = registered;
      if (registered.waiting) setWaiting(registered.waiting);
      registered.addEventListener("updatefound", () => inspect(registered.installing));
    }).catch(() => undefined);
    const check = () => registration?.update().catch(() => undefined);
    const interval = window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", check); window.removeEventListener("beforeinstallprompt", captureInstall); window.removeEventListener("appinstalled", installed); };
  }, []);
  function applyUpdate() {
    if (!waiting) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; window.location.reload(); } });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }
  async function installApp() { if (!installPrompt) return; await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === "accepted") setInstallPrompt(null); }
  if (waiting) return <aside className="app-update-notice" role="status"><div><strong>A newer app version is ready</strong><p>Your offline records, pending synchronization and unfinished draft will remain safe.</p></div><button onClick={applyUpdate}>Refresh app</button></aside>;
  return installPrompt ? <aside className="app-update-notice install-app" role="status"><div><strong>Install Buyala on this computer</strong><p>Open it like a desktop application and continue working without internet after the first sign-in.</p></div><button onClick={installApp}>Install app</button></aside> : null;
}
