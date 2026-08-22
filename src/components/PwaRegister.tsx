"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
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
    return () => { window.clearInterval(interval); window.removeEventListener("focus", check); };
  }, []);
  function applyUpdate() {
    if (!waiting) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; window.location.reload(); } });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }
  return waiting ? <aside className="app-update-notice" role="status"><div><strong>A newer app version is ready</strong><p>Your locally saved records and unfinished draft will remain safe.</p></div><button onClick={applyUpdate}>Refresh app</button></aside> : null;
}
