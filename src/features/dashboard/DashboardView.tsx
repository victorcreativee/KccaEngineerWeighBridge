"use client";

import { useMemo, useState } from "react";

type Entry = { id: string; registration: string; vehicleMatched: boolean; division?: string; concessionaire?: string; driverName: string; driverMatched: boolean; routeSource: string; arrivalTime: string; netKg: number; status: "OPEN" | "COMPLETED" | "VOIDED"; operationDate: string; completedAt: string };
const entriesKey = "buyala.local.entries.v1";
function readEntries(): Entry[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(entriesKey) ?? "[]") as Entry[]; } catch { return []; } }

export function DashboardView({ onRecordVehicle, onViewRecords }: { onRecordVehicle: () => void; onViewRecords: () => void }) {
  const [entries] = useState<Entry[]>(readEntries);
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = useMemo(() => entries.filter((entry) => entry.operationDate === today && entry.status !== "VOIDED"), [entries, today]);
  const completed = todayEntries.filter((entry) => entry.status === "COMPLETED");
  const totalNet = completed.reduce((sum, entry) => sum + entry.netKg, 0);
  const concessionaires = completed.filter((entry) => entry.concessionaire === "Yes").length;
  const open = todayEntries.filter((entry) => entry.status === "OPEN").length;
  const needsAttention = todayEntries.filter((entry) => !entry.vehicleMatched || !entry.driverMatched).length;
  const recent = [...todayEntries].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 5);
  const groups = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of completed) { const name = entry.division?.trim() || "Other / unconfirmed"; totals.set(name, (totals.get(name) ?? 0) + entry.netKg); }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [completed]);
  const maxGroup = Math.max(...groups.map(([, kg]) => kg), 1);
  const displayDate = new Intl.DateTimeFormat("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return <div className="live-dashboard">
    <div className="intro-row"><div><h2>Today at Buyala</h2><p>{displayDate}</p></div><button className="primary-action" onClick={onRecordVehicle}><span aria-hidden="true">＋</span> Record Vehicle</button></div>
    <div className="live-data-note" role="status"><span aria-hidden="true">●</span><div><strong>Local pilot data</strong><p>Dashboard figures now come from transactions saved on this device. No sample figures are included.</p></div></div>
    <div className="metrics">
      <article className="metric primary"><p>Today&apos;s Waste</p><strong>{(totalNet / 1000).toFixed(2)} <small>tonnes</small></strong><span>{completed.length ? "Across completed transactions" : "No completed transactions yet"}</span></article>
      <article className="metric"><p>Vehicles Today</p><strong>{todayEntries.length}</strong><span>{completed.length} completed · {open} open</span></article>
      <article className="metric"><p>Concessionaires</p><strong>{concessionaires}</strong><span>{completed.length ? `${Math.round(concessionaires / completed.length * 100)}% of completed vehicles` : "No confirmed entries yet"}</span></article>
      <article className={`metric ${needsAttention ? "attention" : ""}`}><p>Needs Attention</p><strong>{needsAttention}</strong><span>Unmatched vehicle or driver records</span></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel division-panel"><div className="panel-heading"><div><h3>Tonnage by division</h3><p>Based on confirmed transaction snapshots</p></div><span>{(totalNet / 1000).toFixed(2)} t total</span></div>{groups.length ? <div className="bars">{groups.map(([name, kg]) => <div className="bar-row" key={name}><span>{name}</span><div className="track"><div style={{ width: `${kg / maxGroup * 100}%` }} /></div><strong>{(kg / 1000).toFixed(2)} t</strong></div>)}</div> : <DashboardEmpty label="No division activity today" detail="Complete a transaction to see the breakdown." />}</section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Latest local transactions today</p></div><button onClick={onViewRecords}>View records</button></div>{recent.length ? <div className="activity-list">{recent.map((entry) => <article key={entry.id}><div className="truck-mark" aria-hidden="true">▰</div><div className="activity-main"><strong>{entry.registration}</strong><span>{entry.division || entry.routeSource}</span></div><div className="activity-value"><strong>{entry.netKg.toLocaleString()} kg</strong><span>{entry.status === "COMPLETED" ? "Completed ✓" : entry.status} · {entry.arrivalTime}</span></div></article>)}</div> : <DashboardEmpty label="No activity recorded today" detail="Start with Record Vehicle." />}</section>
    </div>
  </div>;
}

function DashboardEmpty({ label, detail }: { label: string; detail: string }) { return <div className="dashboard-empty"><span aria-hidden="true">—</span><strong>{label}</strong><p>{detail}</p></div>; }

export function ReportsPlaceholder() { return <div className="reports-placeholder"><span>R</span><p className="master-kicker">REPORTING</p><h2>Reports are next</h2><p>The reporting workspace will aggregate the same local transaction records. No report values will be invented.</p></div>; }
