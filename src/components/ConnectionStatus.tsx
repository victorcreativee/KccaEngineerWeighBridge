"use client";

import { useEffect, useState } from "react";

export function ConnectionStatus({ compact = false, notice = false }: { compact?: boolean; notice?: boolean }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  if (notice) return online ? null : <div className="offline-notice" role="status"><span aria-hidden="true">○</span><div><strong>You are offline</strong><p>Records can still be saved on this device. Firebase synchronization will be added later.</p></div></div>;
  if (compact) return <span className={online ? "connection-compact online" : "connection-compact offline"}><i />{online ? "Online" : "Offline"}</span>;
  return <div className="connection-status"><span className={online ? "connection-dot online" : "connection-dot offline"} /><span>{online ? "Online" : "Offline"}</span><small>{online ? "Local records saved on device" : "Continue working on this device"}</small></div>;
}
