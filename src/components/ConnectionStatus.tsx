"use client";

import { useEffect, useState } from "react";
import { getPendingSyncCount } from "../services/firebase/sharedData";

export function ConnectionStatus({ compact = false, notice = false }: { compact?: boolean; notice?: boolean }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(getPendingSyncCount);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const syncChanged = () => setPending(getPendingSyncCount());
    window.addEventListener("buyala:sync-status", syncChanged);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); window.removeEventListener("buyala:sync-status", syncChanged); };
  }, []);
  if (notice) return online ? null : <div className="offline-notice" role="status"><span aria-hidden="true">○</span><div><strong>Offline mode</strong><p>Keep working normally. {pending ? `${pending} save${pending === 1 ? " is" : "s are"} waiting to synchronize.` : "New saves will synchronize automatically when internet returns."}</p></div></div>;
  const label = !online ? "Offline" : pending ? `${pending} pending` : "Synced";
  if (compact) return <span className={online && !pending ? "connection-compact online" : "connection-compact offline"}><i />{label}</span>;
  return <div className="connection-status"><span className={online && !pending ? "connection-dot online" : "connection-dot offline"} /><span>{label}</span><small>{!online ? "Working from the offline database" : pending ? "Uploading to Firebase" : "Device and Firebase are up to date"}</small></div>;
}
