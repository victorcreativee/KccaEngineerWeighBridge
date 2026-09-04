"use client";

import { useEffect, useState } from "react";
import { auditKey, readAudit } from "../../utils/localAudit";
import { Pagination, pageItems } from "../../components/Pagination";
import { buyalaDate } from "../../utils/localDateTime";
import { getPendingSyncSummary, sharedKeys } from "../../services/firebase/sharedData";

export function AuditLogView() {
  const [events, setEvents] = useState(readAudit);
  const [pendingAudit, setPendingAudit] = useState(() => getPendingSyncSummary().find((item) => item.key === sharedKeys.auditEvents)?.count ?? 0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const actions = [...new Set(events.map((event) => event.action))].sort();
  const query = search.trim().toLowerCase();
  const filtered = [...events].filter((event) => (action === "all" || event.action === action) && (!query || [event.actor, event.role, event.action, event.details, event.reference ?? ""].some((value) => value.toLowerCase().includes(query)))).sort((a, b) => b.at.localeCompare(a.at));
  const paged = pageItems(filtered, page);
  const today = buyalaDate();
  const todayCount = events.filter((event) => buyalaDate(new Date(event.at)) === today).length;
  useEffect(() => {
    const refresh = (event?: Event) => {
      if (!event || !(event instanceof CustomEvent) || event.detail?.key === auditKey) setEvents(readAudit());
      setPendingAudit(getPendingSyncSummary().find((item) => item.key === sharedKeys.auditEvents)?.count ?? 0);
    };
    window.addEventListener("buyala:shared-data", refresh);
    window.addEventListener("buyala:sync-status", refresh);
    return () => { window.removeEventListener("buyala:shared-data", refresh); window.removeEventListener("buyala:sync-status", refresh); };
  }, []);

  return <div className="audit-page"><div className="audit-heading"><div><p className="master-kicker">SYSTEM ADMIN OVERSIGHT</p><h2>Audit log</h2><p>Review important account, transaction and data-management actions.</p></div><span>{pendingAudit ? `${pendingAudit} audit event${pendingAudit === 1 ? "" : "s"} pending` : "Audit synchronized"}</span></div><div className="audit-stats"><article><strong>{events.length}</strong><span>Events retained</span></article><article><strong>{todayCount}</strong><span>Events today</span></article><article><strong>{new Set(events.map((event) => event.actor)).size}</strong><span>Accounts observed</span></article></div><section className="audit-card"><div className="audit-filters"><input aria-label="Search audit events" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search account, action, ticket or details" /><select aria-label="Audit action filter" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}><option value="all">All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></div>{filtered.length ? <><div className="audit-list">{paged.items.map((event) => <article key={event.id}><span className="audit-action">{event.action}</span><div><strong>{event.details}</strong><p>{event.actor} · {event.role}{event.reference ? ` · ${event.reference}` : ""}</p></div><time dateTime={event.at}>{new Date(event.at).toLocaleString("en-UG")}</time></article>)}</div><Pagination page={paged.currentPage} totalItems={filtered.length} onChange={setPage} label="audit events" /></> : <div className="audit-empty"><strong>No audit events match</strong><p>Important actions will appear here as staff use the application.</p></div>}</section><p className="audit-note">The latest 1,000 events are retained on this device and synchronized with Firebase for System Admin review.</p></div>;
}
