"use client";

import { useState } from "react";

const navItems = ["Dashboard", "Daily Operations", "Records", "Reports", "Vehicles", "Drivers"];
const recentEntries = [
  { registration: "UBM 845Z", division: "Nakawa", weight: "10,920 kg", time: "10:34" },
  { registration: "UG. 2337S", division: "Central", weight: "8,460 kg", time: "10:08" },
  { registration: "UBN 021J", division: "Makindye", weight: "12,180 kg", time: "09:42" },
];

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand"><span className="brand-mark" aria-hidden="true">B</span><div><strong>Buyala</strong><span>Waste Operations</span></div></div>
        <nav>{navItems.map((item) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => setActive(item)}><span className="nav-icon" aria-hidden="true">{item.charAt(0)}</span>{item}</button>)}</nav>
        <div className="sidebar-footer"><span className="status-dot" /> Online<small>All changes synced</small></div>
      </aside>
      <main>
        <header className="topbar">
          <div><p className="eyebrow">Buyala Waste Management Facility</p><h1>{active}</h1></div>
          <div className="operator"><span>VE</span><div><strong>Victor Engineer</strong><small>Operator</small></div></div>
        </header>
        <section className="content" aria-label="Dashboard overview">
          <div className="intro-row"><div><h2>Today at Buyala</h2><p>Wednesday, 19 August 2026</p></div><button className="primary-action"><span aria-hidden="true">＋</span> Record Vehicle</button></div>
          <div className="notice" role="status"><span className="notice-icon" aria-hidden="true">i</span><div><strong>Pilot foundation</strong><p>Live operational data is not connected yet. Figures below are clearly marked sample data for interface testing.</p></div><span className="sample-badge">SAMPLE DATA</span></div>
          <div className="metrics">
            <article className="metric primary"><p>Today&apos;s Waste</p><strong>148.4 <small>tonnes</small></strong><span>Across all completed entries</span></article>
            <article className="metric"><p>Vehicles Today</p><strong>57</strong><span>54 completed · 3 open</span></article>
            <article className="metric"><p>Concessionaires</p><strong>41</strong><span>72% of vehicles today</span></article>
            <article className="metric attention"><p>Needs Attention</p><strong>5</strong><span>3 open · 2 unmatched records</span></article>
          </div>
          <div className="dashboard-grid">
            <section className="panel division-panel">
              <div className="panel-heading"><div><h3>Tonnage by division</h3><p>Net waste received today</p></div><span>148.4 t total</span></div>
              <div className="bars">{[["Nakawa",48.2,100],["Central",37.4,78],["Makindye",31.8,66],["Nabugabo",24.6,51],["Other",6.4,13]].map(([name,value,width]) => <div className="bar-row" key={String(name)}><span>{name}</span><div className="track"><div style={{width:`${width}%`}} /></div><strong>{value} t</strong></div>)}</div>
            </section>
            <section className="panel activity-panel">
              <div className="panel-heading"><div><h3>Recent activity</h3><p>Latest completed entries</p></div><button>View records</button></div>
              <div className="activity-list">{recentEntries.map((entry) => <article key={entry.registration}><div className="truck-mark" aria-hidden="true">▰</div><div className="activity-main"><strong>{entry.registration}</strong><span>{entry.division}</span></div><div className="activity-value"><strong>{entry.weight}</strong><span>Completed ✓ · {entry.time}</span></div></article>)}</div>
            </section>
          </div>
        </section>
        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0,4).map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{item.charAt(0)}</span>{item === "Daily Operations" ? "Operations" : item}</button>)}</nav>
      </main>
    </div>
  );
}
