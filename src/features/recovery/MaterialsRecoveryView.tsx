"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveSharedData, sharedKeys } from "../../services/firebase/sharedData";
import { logAudit } from "../../utils/localAudit";
import { Pagination, pageItems } from "../../components/Pagination";
import { buyalaDate } from "../../utils/localDateTime";

export const recoveredMaterials = ["PET (Rwenzori)", "HD Polythenes", "Boxes / Papers", "Soft Plastics", "Scraps / Metals", "Electric Waste", "PVC Pipes", "Food Waste", "Sacks (Old)", "Glass Bottles", "Rubber", "Hard Plastics"] as const;
type RecoveryEntry = { id: string; recoveryDate: string; material: string; quantityKg: number; trader: string; notes: string; recordedAt: string; recordedBy: string };

function readEntries(): RecoveryEntry[] { if (typeof window === "undefined") return []; try { const value = JSON.parse(localStorage.getItem(sharedKeys.recoveryEntries) ?? "[]") as RecoveryEntry[]; return Array.isArray(value) ? value : []; } catch { return []; } }
function csvCell(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export function MaterialsRecoveryView({ operatorName }: { operatorName: string }) {
  const today = buyalaDate();
  const [entries, setEntries] = useState<RecoveryEntry[]>(readEntries);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const refresh = (event: Event) => { if ((event as CustomEvent<{ key?: string }>).detail?.key === sharedKeys.recoveryEntries) setEntries(readEntries()); }; window.addEventListener("buyala:shared-data", refresh); return () => window.removeEventListener("buyala:shared-data", refresh); }, []);
  const monthEntries = useMemo(() => entries.filter((entry) => entry.recoveryDate.startsWith(month)).sort((a, b) => b.recoveryDate.localeCompare(a.recoveryDate) || b.recordedAt.localeCompare(a.recordedAt)), [entries, month]);
  const totals = useMemo(() => recoveredMaterials.map((material) => [material, monthEntries.filter((entry) => entry.material === material).reduce((sum, entry) => sum + entry.quantityKg, 0)] as const), [monthEntries]);
  const monthTotal = totals.reduce((sum, [, value]) => sum + value, 0);
  const paged = pageItems(monthEntries, page);

  function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const quantityKg = Number(data.get("quantityKg"));
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) return setMessage("Enter a recovered quantity greater than 0 kg.");
    const entry: RecoveryEntry = { id: crypto.randomUUID(), recoveryDate: String(data.get("recoveryDate")), material: String(data.get("material")), quantityKg, trader: String(data.get("trader") ?? "").trim(), notes: String(data.get("notes") ?? "").trim(), recordedAt: new Date().toISOString(), recordedBy: operatorName };
    const next = [...entries, entry]; setEntries(next); saveSharedData(sharedKeys.recoveryEntries, next); logAudit(operatorName, "Staff", "RECOVERY_RECORDED", `Recorded ${quantityKg.toLocaleString()} kg of ${entry.material}${entry.trader ? ` for ${entry.trader}` : ""}`, entry.id); setMonth(entry.recoveryDate.slice(0, 7)); setPage(1); setMessage(`${entry.material}: ${quantityKg.toLocaleString()} kg saved and queued for synchronization.`); form.reset(); (form.elements.namedItem("recoveryDate") as HTMLInputElement).value = today;
  }

  function downloadMonthlyCsv() {
    const dates = [...new Set(monthEntries.map((entry) => entry.recoveryDate))].sort();
    const rows = [["Date", ...recoveredMaterials, "Grand Total"], ...dates.map((date) => { const daily = recoveredMaterials.map((material) => monthEntries.filter((entry) => entry.recoveryDate === date && entry.material === material).reduce((sum, entry) => sum + entry.quantityKg, 0)); return [date, ...daily, daily.reduce((sum, value) => sum + value, 0)]; }), ["Grand Total", ...totals.map(([, value]) => value), monthTotal]];
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `buyala-materials-recovered-${month}.csv`; link.click(); URL.revokeObjectURL(url); setMessage("Monthly materials recovery CSV downloaded in the same date-by-material layout as the existing sheet.");
  }

  return <div className="recovery-page">
    <header className="recovery-heading"><div><p className="master-kicker">MATERIALS RECOVERED OUT OF BUYALA LANDFILL</p><h2>Materials Recovery</h2><p>Record recovered material separately from incoming vehicle and weighbridge transactions.</p></div><div className="recovery-total"><span>{month}</span><strong>{monthTotal.toLocaleString()} kg</strong><small>{(monthTotal / 1000).toFixed(2)} tonnes recovered</small></div></header>
    <section className="recovery-note"><b>Separate daily process</b><p>Choose the material recovered, enter its measured quantity in kilograms and identify the trader or recipient when known. This does not change gross, tare or net waste figures.</p></section>
    <section className="recovery-entry"><div><p className="master-kicker">NEW DAILY ENTRY</p><h3>Record recovered material</h3><p>Each material can be entered more than once per day. Monthly reports combine the entries automatically.</p></div><form onSubmit={record}><label>Date<input name="recoveryDate" type="date" defaultValue={today} required /></label><label>Material<select name="material" required>{recoveredMaterials.map((material) => <option key={material}>{material}</option>)}</select></label><label>Quantity recovered (kg)<input name="quantityKg" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="e.g. 4000" required /></label><label>Trader / recipient<input name="trader" placeholder="Company or trader name" /></label><label className="wide">Notes (optional)<input name="notes" placeholder="Reference, collection details or remarks" /></label><button type="submit">Save recovery entry</button></form></section>
    {message && <p className="recovery-message" role="status">{message}</p>}
    <section className="recovery-report"><div className="recovery-report-heading"><div><p className="master-kicker">MONTHLY RECOVERY SUMMARY</p><h3>Material totals</h3></div><div><label>Month<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} /></label><button onClick={downloadMonthlyCsv} disabled={!monthEntries.length}>Download monthly CSV</button></div></div><div className="recovery-material-grid">{totals.map(([material, value]) => <article key={material} className={value ? "has-value" : ""}><span>{material}</span><strong>{value.toLocaleString()} <small>kg</small></strong></article>)}</div></section>
    <section className="recovery-log"><div><h3>Entries for {month}</h3><span>{monthEntries.length} entr{monthEntries.length === 1 ? "y" : "ies"}</span></div>{monthEntries.length ? <><div className="recovery-table"><div className="recovery-row header"><span>Date</span><span>Material</span><span>Trader / recipient</span><span>Recorded by</span><span>Quantity</span></div>{paged.items.map((entry) => <div className="recovery-row" key={entry.id}><span>{entry.recoveryDate}</span><strong>{entry.material}</strong><span>{entry.trader || "Not specified"}{entry.notes && <small>{entry.notes}</small>}</span><span>{entry.recordedBy}</span><strong>{entry.quantityKg.toLocaleString()} kg</strong></div>)}</div><Pagination page={paged.currentPage} totalItems={monthEntries.length} onChange={setPage} label="recovery entries" /></> : <div className="recovery-empty"><b>No recovery entries in this month</b><p>Use the form above when recovered material is weighed and handed to a trader or recipient.</p></div>}</section>
  </div>;
}
