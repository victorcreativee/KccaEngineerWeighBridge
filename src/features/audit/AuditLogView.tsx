"use client";

import { useState } from "react";
import { readAudit } from "../../utils/localAudit";

export function AuditLogView() {
  const [events] = useState(readAudit);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const actions = [...new Set(events.map((event) => event.action))].sort();
  const query = search.trim().toLowerCase();
  const filtered = [...events].filter((event) => (action === "all" || event.action === action) && (!query || [event.actor, event.role, event.action, event.details, event.reference ?? ""].some((value) => value.toLowerCase().includes(query)))).sort((a, b) => b.at.localeCompare(a.at));
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = events.filter((event) => event.at.slice(0, 10) === today).length;

  return <div className="audit-page"><div className="audit-heading"><div><p className="master-kicker">ENGINEER OVERSIGHT</p><h2>Audit log</h2><p>Review important actions performed during this local pilot.</p></div><span>Engineer only</span></div><div className="audit-stats"><article><strong>{events.length}</strong><span>Events retained</span></article><article><strong>{todayCount}</strong><span>Events today</span></article><article><strong>{new Set(events.map((event) => event.actor)).size}</strong><span>Accounts observed</span></article></div><section className="audit-card"><div className="audit-filters"><input aria-label="Search audit events" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account, action, ticket or details" /><select aria-label="Audit action filter" value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></div>{filtered.length ? <div className="audit-list">{filtered.map((event) => <article key={event.id}><span className="audit-action">{event.action}</span><div><strong>{event.details}</strong><p>{event.actor} · {event.role}{event.reference ? ` · ${event.reference}` : ""}</p></div><time dateTime={event.at}>{new Date(event.at).toLocaleString("en-UG")}</time></article>)}</div> : <div className="audit-empty"><strong>No audit events match</strong><p>Actions will appear here as the two local accounts use the application.</p></div>}</section><p className="audit-note">The local pilot retains the latest 1,000 events on this device. Firebase will provide the authoritative server-side audit trail.</p></div>;
}
