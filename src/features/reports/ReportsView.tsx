"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { exportExcelWorkbook } from "./exportExcelWorkbook";
import { saveSharedData, sharedKeys } from "../../services/firebase/sharedData";

type Correction = { correctedAt: string; correctedBy?: string; reason: string; before: Record<string, string>; after: Record<string, string> };
type Entry = { id: string; facilityId?: string; localTicket?: string; createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string; registration: string; vehicleMatched: boolean; vehicleType?: string; division?: string; originArea?: string; operatorCategory?: string; company?: string; concessionaire?: string; driverName: string; driverMatched: boolean; driverPhone: string; routeSource: string; arrivalTime: string; departureTime?: string; grossKg: number; tareKg: number; netKg: number; tareCaptureMode?: "UNCONFIRMED"; status: "OPEN" | "COMPLETED" | "VOIDED"; operationDate: string; completedAt: string; voidReason?: string; voidedAt?: string; voidedBy?: string; correctionHistory?: Correction[] };
const entriesKey = "buyala.local.entries.v1";
const vehiclesKey = "buyala.local.vehicles.v1";
const driversKey = "buyala.local.drivers.v1";
function readEntries(): Entry[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(entriesKey) ?? "[]") as Entry[]; } catch { return []; } }
function displayDate(value: string) { return new Intl.DateTimeFormat("en-UG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function downloadFile(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 2000); }
function operatorCategory(entry: Entry) { return entry.operatorCategory || (entry.concessionaire === "Yes" ? "Concessionaire" : entry.concessionaire === "No" ? "Non-concessionaire" : "Unconfirmed"); }
function summarize(entries: Entry[], label: (entry: Entry) => string) {
  const map = new Map<string, { vehicles: number; netKg: number }>();
  entries.forEach((entry) => { const name = label(entry).trim() || "Unconfirmed"; const current = map.get(name) ?? { vehicles: 0, netKg: 0 }; map.set(name, { vehicles: current.vehicles + 1, netKg: current.netKg + entry.netKg }); });
  return [...map.entries()].sort((a, b) => b[1].netKg - a[1].netKg);
}
function minutesBetween(start: string, end?: string) { if (!end) return null; const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); const minutes = eh * 60 + em - (sh * 60 + sm); return minutes >= 0 ? minutes : minutes + 1440; }
function inclusiveDays(from: string, to: string) { return Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1); }
function shiftDate(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function percentageChange(current: number, previous: number) { if (!previous) return null; return ((current - previous) / previous) * 100; }

export function ReportsView() {
  const [entries] = useState<Entry[]>(readEntries);
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [backupMessage, setBackupMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const completed = useMemo(() => entries.filter((entry) => entry.status === "COMPLETED" && entry.operationDate >= fromDate && entry.operationDate <= toDate).sort((a, b) => a.completedAt.localeCompare(b.completedAt)), [entries, fromDate, toDate]);
  const periodEntries = useMemo(() => entries.filter((entry) => entry.operationDate >= fromDate && entry.operationDate <= toDate), [entries, fromDate, toDate]);
  const totalGross = completed.reduce((sum, entry) => sum + entry.grossKg, 0);
  const totalTare = completed.reduce((sum, entry) => sum + entry.tareKg, 0);
  const totalNet = completed.reduce((sum, entry) => sum + entry.netKg, 0);
  const kccaDirect = completed.filter((entry) => operatorCategory(entry) === "KCCA direct").length;
  const concessionaires = completed.filter((entry) => operatorCategory(entry) === "Concessionaire").length;
  const nonConcessionaires = completed.filter((entry) => operatorCategory(entry) === "Non-concessionaire").length;
  const unknownVehicles = completed.filter((entry) => !entry.vehicleMatched).length;
  const unknownDrivers = completed.filter((entry) => !entry.driverMatched).length;
  const days = inclusiveDays(fromDate, toDate);
  const previousTo = shiftDate(fromDate, -1);
  const previousFrom = shiftDate(fromDate, -days);
  const previousCompleted = useMemo(() => entries.filter((entry) => entry.status === "COMPLETED" && entry.operationDate >= previousFrom && entry.operationDate <= previousTo), [entries, previousFrom, previousTo]);
  const previousNet = previousCompleted.reduce((sum, entry) => sum + entry.netKg, 0);
  const netChange = percentageChange(totalNet, previousNet);
  const tripChange = percentageChange(completed.length, previousCompleted.length);
  const activeDays = new Set(completed.map((entry) => entry.operationDate)).size;
  const turnaroundValues = completed.map((entry) => minutesBetween(entry.arrivalTime, entry.departureTime)).filter((value): value is number => value !== null);
  const averageTurnaround = turnaroundValues.length ? turnaroundValues.reduce((sum, value) => sum + value, 0) / turnaroundValues.length : null;
  const quality = {
    origin: completed.filter((entry) => !entry.originArea).length,
    division: completed.filter((entry) => entry.originArea === "Kampala city" && !entry.division).length,
    operator: completed.filter((entry) => operatorCategory(entry) === "Unconfirmed").length,
    company: completed.filter((entry) => (operatorCategory(entry) === "Concessionaire" || operatorCategory(entry) === "Non-concessionaire") && !entry.company).length,
    departure: completed.filter((entry) => !entry.departureTime).length,
    unmatched: completed.filter((entry) => !entry.vehicleMatched || !entry.driverMatched).length,
  };
  const qualityIssues = Object.values(quality).reduce((sum, value) => sum + value, 0);
  const divisions = useMemo(() => {
    return summarize(completed, (entry) => entry.division || "Other / unconfirmed");
  }, [completed]);
  const origins = useMemo(() => summarize(completed, (entry) => entry.originArea || "Unconfirmed origin"), [completed]);
  const operators = useMemo(() => summarize(completed, operatorCategory), [completed]);
  const privateCompanies = useMemo(() => summarize(completed.filter((entry) => operatorCategory(entry) === "Concessionaire" || operatorCategory(entry) === "Non-concessionaire"), (entry) => entry.company || "Other / unconfirmed private company"), [completed]);

  function applyPreset(preset: "today" | "week" | "month" | "all") {
    if (preset === "today") { setFromDate(today); setToDate(today); return; }
    if (preset === "month") { setFromDate(`${today.slice(0, 8)}01`); setToDate(today); return; }
    if (preset === "all") { const dates = entries.map((entry) => entry.operationDate).sort(); setFromDate(dates[0] ?? today); setToDate(dates.at(-1) ?? today); return; }
    const start = new Date(`${today}T00:00:00`); start.setDate(start.getDate() - 6); setFromDate(start.toISOString().slice(0, 10)); setToDate(today);
  }

  async function downloadExcel() { setExportMessage("Preparing styled Excel workbook…"); try { await exportExcelWorkbook(entries, fromDate, toDate); setExportMessage(`Excel workbook downloaded with 8 sheets, ${completed.length} completed transaction${completed.length === 1 ? "" : "s"}, and the selected period's audit history.`); } catch { setExportMessage("The Excel workbook could not be created. Your saved data was not changed."); } }

  function printReport() { setExportMessage("Opening the print dialog. Choose ‘Save as PDF’ in the printer destination to save a PDF copy."); window.setTimeout(() => window.print(), 150); }

  function downloadBackup() {
    const backup = { schemaVersion: 1, application: "Buyala Waste Operations", exportedAt: new Date().toISOString(), vehicles: JSON.parse(localStorage.getItem(vehiclesKey) ?? "[]"), drivers: JSON.parse(localStorage.getItem(driversKey) ?? "[]"), entries: JSON.parse(localStorage.getItem(entriesKey) ?? "[]") };
    downloadFile(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `buyala-local-backup-${today}.json`); setBackupMessage("Backup downloaded. Store the file in your KccaEngineer folder or another safe location.");
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as { schemaVersion?: number; application?: string; vehicles?: unknown; drivers?: unknown; entries?: unknown };
      if (backup.schemaVersion !== 1 || backup.application !== "Buyala Waste Operations" || !Array.isArray(backup.vehicles) || !Array.isArray(backup.drivers) || !Array.isArray(backup.entries)) throw new Error("invalid");
      const approved = window.confirm(`Restore this backup?\n\n${backup.vehicles.length} vehicles\n${backup.drivers.length} drivers\n${backup.entries.length} transactions\n\nThis will replace the data currently saved in this browser.`);
      if (!approved) return setBackupMessage("Restore cancelled. Current local data was not changed.");
      saveSharedData(sharedKeys.vehicles, backup.vehicles as { id: string }[]); saveSharedData(sharedKeys.drivers, backup.drivers as { id: string }[]); saveSharedData(sharedKeys.entries, backup.entries as { id: string }[]); window.setTimeout(() => window.location.reload(), 500);
    } catch { setBackupMessage("This file is not a valid Buyala local backup. No data was changed."); }
  }

  return <div className="reports-page">
    <div className="reports-heading"><div><p className="master-kicker">OPERATIONAL REPORTING</p><h2>Reports</h2><p>Calculated from completed transactions saved on this device.</p></div><div className="report-actions"><button onClick={downloadExcel} disabled={!completed.length}>Download styled Excel</button><button onClick={printReport} disabled={!completed.length}>Print / Save PDF</button></div></div>
    {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    <nav className="report-presets" aria-label="Report period shortcuts"><button onClick={() => applyPreset("today")}>Today</button><button onClick={() => applyPreset("week")}>Last 7 days</button><button onClick={() => applyPreset("month")}>This month</button><button onClick={() => applyPreset("all")}>All records</button></nav>
    <section className="report-period"><div><label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label></div><p>{fromDate === toDate ? `Daily summary · ${displayDate(fromDate)}` : `${displayDate(fromDate)} – ${displayDate(toDate)}`}</p></section>
    <header className="print-report-header"><p>BUYALA WASTE MANAGEMENT FACILITY</p><h1>Weighbridge Operations Report</h1><span>{fromDate === toDate ? displayDate(fromDate) : `${displayDate(fromDate)} – ${displayDate(toDate)}`}</span></header>
    <div className="report-kpis"><article><span>Total vehicles</span><strong>{completed.length}</strong></article><article><span>Net waste</span><strong>{(totalNet / 1000).toFixed(2)} <small>t</small></strong></article><article><span>KCCA direct</span><strong>{kccaDirect}</strong></article><article><span>Concessionaires</span><strong>{concessionaires}</strong></article><article><span>Non-concessionaires</span><strong>{nonConcessionaires}</strong></article><article className={unknownVehicles + unknownDrivers ? "warning" : ""}><span>Unknown records</span><strong>{unknownVehicles + unknownDrivers}</strong><small>{unknownVehicles} vehicles · {unknownDrivers} drivers</small></article></div>
    <section className="efficiency-strip" aria-label="Operational efficiency"><article><span>Tonnes per trip</span><strong>{completed.length ? (totalNet / 1000 / completed.length).toFixed(2) : "0.00"}</strong><small>Average completed load</small></article><article><span>Daily average</span><strong>{(totalNet / 1000 / days).toFixed(2)} t</strong><small>{days} calendar day{days === 1 ? "" : "s"} selected</small></article><article><span>Active-day average</span><strong>{activeDays ? (totalNet / 1000 / activeDays).toFixed(2) : "0.00"} t</strong><small>{activeDays} day{activeDays === 1 ? "" : "s"} with completed trips</small></article><article><span>Average turnaround</span><strong>{averageTurnaround === null ? "—" : `${Math.round(averageTurnaround)} min`}</strong><small>{turnaroundValues.length} timed trip{turnaroundValues.length === 1 ? "" : "s"}</small></article></section>
    <section className="period-comparison"><div><p className="master-kicker">PERIOD COMPARISON</p><h3>Compared with the previous {days === 1 ? "day" : `${days} days`}</h3><small>{displayDate(previousFrom)} – {displayDate(previousTo)}</small></div>{previousCompleted.length ? <div className="comparison-values"><ComparisonMetric label="Net waste" current={`${(totalNet / 1000).toFixed(2)} t`} previous={`${(previousNet / 1000).toFixed(2)} t previously`} change={netChange} /><ComparisonMetric label="Completed trips" current={String(completed.length)} previous={`${previousCompleted.length} previously`} change={tripChange} /><ComparisonMetric label="Daily average" current={`${(totalNet / 1000 / days).toFixed(2)} t`} previous={`${(previousNet / 1000 / days).toFixed(2)} t previously`} change={percentageChange(totalNet / days, previousNet / days)} /></div> : <div className="comparison-empty"><strong>No earlier completed records</strong><p>Comparison will appear automatically when the preceding period contains data.</p></div>}</section>
    <section className="status-strip"><span><b>{periodEntries.filter((entry) => entry.status === "COMPLETED").length}</b> Completed</span><span><b>{periodEntries.filter((entry) => entry.status === "OPEN").length}</b> Open</span><span><b>{periodEntries.filter((entry) => entry.status === "VOIDED").length}</b> Voided</span><small>Transaction status for the selected period</small></section>
    <section className={qualityIssues ? "quality-panel attention" : "quality-panel"}><div><p className="master-kicker">DATA QUALITY</p><h3>{qualityIssues ? `${qualityIssues} details need review` : "All reporting details are complete"}</h3><small>Counts apply to completed transactions in the selected period.</small></div><div className="quality-grid"><span><b>{quality.origin}</b> Missing origin</span><span><b>{quality.division}</b> Missing Kampala division</span><span><b>{quality.operator}</b> Missing operator category</span><span><b>{quality.company}</b> Missing private company</span><span><b>{quality.departure}</b> Missing departure</span><span><b>{quality.unmatched}</b> Unmatched vehicle/driver</span></div></section>
    {!completed.length ? <div className="report-empty"><span>R</span><h3>No completed transactions in this period</h3><p>Choose another date range or complete a transaction in Daily Operations.</p></div> : <>
      <SummaryTable title="Origin summary" description="Kampala city versus nearby suburbs / outside Kampala" rows={origins} totalNet={totalNet} />
      <SummaryTable title="Operator category summary" description="KCCA direct, concessionaire and non-concessionaire contribution" rows={operators} totalNet={totalNet} />
      <section className="report-section"><div className="report-section-heading"><div><h3>Division summary</h3><p>Vehicle count and net waste contribution</p></div><strong>{(totalNet / 1000).toFixed(2)} tonnes</strong></div><div className="division-report-table"><div className="division-report-row header"><span>Division</span><span>Vehicles</span><span>Net kg</span><span>Tonnes</span><span>% of total</span></div>{divisions.map(([division, values]) => <div className="division-report-row" key={division}><strong>{division}</strong><span>{values.vehicles}</span><span>{values.netKg.toLocaleString()}</span><span>{(values.netKg / 1000).toFixed(2)}</span><span>{totalNet ? `${(values.netKg / totalNet * 100).toFixed(1)}%` : "0.0%"}</span></div>)}</div></section>
      {privateCompanies.length > 0 && <SummaryTable title="Private company summary" description="Concessionaire and non-concessionaire operators only" rows={privateCompanies} totalNet={privateCompanies.reduce((sum, [, values]) => sum + values.netKg, 0)} />}
      <section className="report-section"><div className="report-section-heading"><div><h3>Weight totals</h3><p>Reconciliation for selected period</p></div></div><div className="weight-totals"><div><span>Total gross</span><strong>{totalGross.toLocaleString()} kg</strong></div><i>−</i><div><span>Total tare</span><strong>{totalTare.toLocaleString()} kg</strong></div><i>=</i><div className="net"><span>Total net</span><strong>{totalNet.toLocaleString()} kg</strong><small>{(totalNet / 1000).toFixed(2)} tonnes</small></div></div></section>
      <section className="report-section detailed-log"><div className="report-section-heading"><div><h3>Detailed transaction log</h3><p>{completed.length} completed transaction{completed.length === 1 ? "" : "s"}</p></div></div><div className="report-log-table"><div className="report-log-row header"><span>Date</span><span>Registration</span><span>Division</span><span>Driver</span><span>Route</span><span>Gross</span><span>Tare</span><span>Net</span></div>{completed.map((entry) => <div className="report-log-row" key={entry.id}><span>{displayDate(entry.operationDate)}<small>{entry.arrivalTime}</small></span><strong>{entry.registration}</strong><span>{entry.division || "Unconfirmed"}</span><span>{entry.driverName}{!entry.driverMatched && <small>Unmatched</small>}</span><span>{entry.routeSource}</span><span>{entry.grossKg.toLocaleString()}</span><span>{entry.tareKg.toLocaleString()}</span><strong>{entry.netKg.toLocaleString()}</strong></div>)}</div></section>
    </>}
    <section className="local-backup-panel"><div><p className="master-kicker">LOCAL DATA PROTECTION</p><h3>Backup and restore</h3><p>Download vehicles, drivers and transactions as one file. Keep it in the KccaEngineer folder or another safe location.</p></div><div className="backup-actions"><button onClick={downloadBackup}>Download full backup</button><label>Restore backup<input type="file" accept="application/json,.json" onChange={restoreBackup} /></label></div>{backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}<small>Restoring requires confirmation and replaces the records currently stored in this browser. It does not affect project source files.</small></section>
    <footer className="print-report-footer">Generated locally by Buyala Waste Operations · Figures include completed transactions only.</footer>
  </div>;
}

function SummaryTable({ title, description, rows, totalNet }: { title: string; description: string; rows: [string, { vehicles: number; netKg: number }][]; totalNet: number }) {
  return <section className="report-section"><div className="report-section-heading"><div><h3>{title}</h3><p>{description}</p></div><strong>{(totalNet / 1000).toFixed(2)} tonnes</strong></div><div className="division-report-table"><div className="division-report-row header"><span>Category</span><span>Trips</span><span>Tonnes</span><span>Tonnes / trip</span><span>% contribution</span></div>{rows.map(([name, values]) => <div className="division-report-row" key={name}><strong>{name}</strong><span>{values.vehicles}</span><span>{(values.netKg / 1000).toFixed(2)}</span><span>{values.vehicles ? (values.netKg / 1000 / values.vehicles).toFixed(2) : "0.00"}</span><span>{totalNet ? `${(values.netKg / totalNet * 100).toFixed(1)}%` : "0.0%"}</span></div>)}</div></section>;
}

function ComparisonMetric({ label, current, previous, change }: { label: string; current: string; previous: string; change: number | null }) {
  const direction = change === null || Math.abs(change) < 0.05 ? "same" : change > 0 ? "up" : "down";
  return <article><span>{label}</span><strong>{current}</strong><small>{previous}</small><b className={direction}>{change === null ? "No baseline" : `${change > 0 ? "↑" : change < 0 ? "↓" : ""} ${Math.abs(change).toFixed(1)}%`}</b></article>;
}
