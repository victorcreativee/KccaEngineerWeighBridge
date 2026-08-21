"use client";

import { FormEvent, useMemo, useState } from "react";
import { normalizeRegistration } from "../../utils/registration";

type Kind = "vehicles" | "drivers";
type VehicleRecord = { id: string; registration: string; normalizedRegistration: string; vehicleType: string; company: string; concessionaire: string; operatorCategory?: string; originArea?: string; division: string; route: string; tareKg?: number; active: boolean };
type DriverRecord = { id: string; fullName: string; telephone: string; notes: string; active: boolean };

const vehicleKey = "buyala.local.vehicles.v1";
const driverKey = "buyala.local.drivers.v1";

function readLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

export function MasterDataView({ kind, autoOpen = false, initialValue = "", onSaved, onQuickAddClosed }: { kind: Kind; autoOpen?: boolean; initialValue?: string; onSaved?: () => void; onQuickAddClosed?: () => void }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(() => readLocal<VehicleRecord>(vehicleKey));
  const [drivers, setDrivers] = useState<DriverRecord[]>(() => readLocal<DriverRecord>(driverKey));
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(autoOpen);
  const [error, setError] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);

  const query = search.trim().toLowerCase();
  const filteredVehicles = useMemo(() => vehicles.filter((v) => [v.registration, v.vehicleType, v.company, v.division, v.route].some((field) => field.toLowerCase().includes(query))), [vehicles, query]);
  const filteredDrivers = useMemo(() => drivers.filter((d) => [d.fullName, d.telephone, d.notes].some((field) => field.toLowerCase().includes(query))), [drivers, query]);

  function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget); const registration = String(data.get("registration") ?? "").trim(); const normalizedRegistration = normalizeRegistration(registration);
    if (!normalizedRegistration) return setError("Enter a vehicle registration number.");
    if (vehicles.some((vehicle) => vehicle.normalizedRegistration === normalizedRegistration && vehicle.id !== editingVehicle?.id)) return setError("This registration is already in the vehicle database.");
    const tareText = String(data.get("tareKg") ?? "").trim();
    const operatorCategory = String(data.get("operatorCategory") ?? "");
    const next: VehicleRecord = { id: editingVehicle?.id ?? crypto.randomUUID(), registration: registration.toUpperCase(), normalizedRegistration, vehicleType: String(data.get("vehicleType") ?? ""), company: String(data.get("company") ?? ""), concessionaire: operatorCategory === "Concessionaire" ? "Yes" : operatorCategory === "Non-concessionaire" ? "No" : "", operatorCategory, originArea: String(data.get("originArea") ?? ""), division: String(data.get("division") ?? ""), route: String(data.get("route") ?? ""), tareKg: tareText ? Number(tareText) : undefined, active: editingVehicle?.active ?? true };
    const updated = editingVehicle ? vehicles.map((vehicle) => vehicle.id === editingVehicle.id ? next : vehicle) : [...vehicles, next]; setVehicles(updated); localStorage.setItem(vehicleKey, JSON.stringify(updated)); closeForm(); onSaved?.();
  }

  function saveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget); const fullName = String(data.get("fullName") ?? "").trim();
    if (!fullName) return setError("Enter the driver's full name.");
    const next: DriverRecord = { id: editingDriver?.id ?? crypto.randomUUID(), fullName, telephone: String(data.get("telephone") ?? "").trim(), notes: String(data.get("notes") ?? "").trim(), active: editingDriver?.active ?? true };
    const updated = editingDriver ? drivers.map((driver) => driver.id === editingDriver.id ? next : driver) : [...drivers, next]; setDrivers(updated); localStorage.setItem(driverKey, JSON.stringify(updated)); closeForm(); onSaved?.();
  }

  function openNew() { setEditingVehicle(null); setEditingDriver(null); setError(""); setShowForm(true); }
  function editVehicle(vehicle: VehicleRecord) { setEditingVehicle(vehicle); setEditingDriver(null); setError(""); setShowForm(true); }
  function editDriver(driver: DriverRecord) { setEditingDriver(driver); setEditingVehicle(null); setError(""); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingVehicle(null); setEditingDriver(null); setError(""); if (autoOpen) onQuickAddClosed?.(); }

  function toggleVehicle(id: string) { const updated = vehicles.map((vehicle) => vehicle.id === id ? { ...vehicle, active: vehicle.active === false } : vehicle); setVehicles(updated); localStorage.setItem(vehicleKey, JSON.stringify(updated)); }
  function toggleDriver(id: string) { const updated = drivers.map((driver) => driver.id === id ? { ...driver, active: driver.active === false } : driver); setDrivers(updated); localStorage.setItem(driverKey, JSON.stringify(updated)); }

  const isVehicles = kind === "vehicles";
  const count = isVehicles ? vehicles.length : drivers.length;
  const activeCount = isVehicles ? vehicles.filter((vehicle) => vehicle.active !== false).length : drivers.filter((driver) => driver.active !== false).length;
  const shown = isVehicles ? filteredVehicles.length : filteredDrivers.length;

  return <div className="master-page">
    <div className="master-heading"><div><p className="master-kicker">MASTER DATA</p><h2>{isVehicles ? "Vehicles" : "Drivers"}</h2><p>{isVehicles ? "Manage vehicles used at the Buyala weighbridge." : "Manage drivers available during vehicle entry."}</p></div><button className="primary-action" onClick={openNew}>＋ Add {isVehicles ? "vehicle" : "driver"}</button></div>
    <div className="local-store-banner"><span aria-hidden="true">●</span><div><strong>Saved on this device</strong><p>These pilot records stay in this browser for now. Firestore will become the operational source of truth later.</p></div></div>
    <div className="master-stats"><article><strong>{count}</strong><span>Total {kind}</span></article><article><strong>{activeCount}</strong><span>Active</span></article><article><strong>{shown}</strong><span>Matching search</span></article></div>
    <section className="master-table-card">
      <div className="master-toolbar"><label><span className="sr-only">Search {kind}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isVehicles ? "Search registration, company or route" : "Search name or telephone"} /></label><span>{shown} result{shown === 1 ? "" : "s"}</span></div>
      {shown === 0 ? <div className="empty-state"><span aria-hidden="true">{isVehicles ? "V" : "D"}</span><h3>{query ? `No ${kind} match your search` : `No ${kind} added yet`}</h3><p>{query ? "Try a different search term." : `Add the first ${isVehicles ? "vehicle" : "driver"} when you are ready.`}</p>{!query && <button onClick={openNew}>Add {isVehicles ? "vehicle" : "driver"}</button>}</div> : isVehicles ? <div className="data-table lifecycle"><div className="data-row header"><span>Registration</span><span>Type</span><span>Company</span><span>Division</span><span>Status</span><span>Actions</span></div>{filteredVehicles.map((vehicle) => <div className={vehicle.active === false ? "data-row inactive" : "data-row"} key={vehicle.id}><strong>{vehicle.registration}</strong><span>{vehicle.vehicleType || "—"}</span><span>{vehicle.company || "—"}</span><span>{vehicle.division || "—"}</span><span className={vehicle.active === false ? "inactive-pill" : "active-pill"}>{vehicle.active === false ? "Inactive" : "Active ✓"}</span><div className="master-row-actions"><button onClick={() => editVehicle(vehicle)}>Edit</button><button className="lifecycle-action" onClick={() => toggleVehicle(vehicle.id)}>{vehicle.active === false ? "Reactivate" : "Deactivate"}</button></div></div>)}</div> : <div className="data-table drivers lifecycle"><div className="data-row header"><span>Driver name</span><span>Telephone</span><span>Notes / company</span><span>Status</span><span>Actions</span></div>{filteredDrivers.map((driver) => <div className={driver.active === false ? "data-row inactive" : "data-row"} key={driver.id}><strong>{driver.fullName}</strong><span>{driver.telephone || "—"}</span><span>{driver.notes || "—"}</span><span className={driver.active === false ? "inactive-pill" : "active-pill"}>{driver.active === false ? "Inactive" : "Active ✓"}</span><div className="master-row-actions"><button onClick={() => editDriver(driver)}>Edit</button><button className="lifecycle-action" onClick={() => toggleDriver(driver.id)}>{driver.active === false ? "Reactivate" : "Deactivate"}</button></div></div>)}</div>}
    </section>
    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><section className="master-modal" role="dialog" aria-modal="true" aria-labelledby="master-form-title"><div className="modal-heading"><div><p className="master-kicker">{editingVehicle || editingDriver ? "EDIT RECORD" : "NEW RECORD"}</p><h3 id="master-form-title">{editingVehicle || editingDriver ? "Edit" : "Add"} {isVehicles ? "vehicle" : "driver"}</h3></div><button aria-label="Close form" onClick={closeForm}>×</button></div>{isVehicles ? <VehicleForm initial={editingVehicle} suggestedRegistration={initialValue} onSubmit={saveVehicle} onCancel={closeForm} error={error} /> : <DriverForm initial={editingDriver} suggestedName={initialValue} onSubmit={saveDriver} onCancel={closeForm} error={error} />}</section></div>}
  </div>;
}

function VehicleForm({ initial, suggestedRegistration, onSubmit, onCancel, error }: { initial: VehicleRecord | null; suggestedRegistration: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; error: string }) {
  const legacyCategory = initial?.operatorCategory ?? (initial?.concessionaire === "Yes" ? "Concessionaire" : initial?.concessionaire === "No" ? "Non-concessionaire" : "");
  return <form className="master-form" onSubmit={onSubmit}><label>Registration number *<input name="registration" defaultValue={initial?.registration ?? suggestedRegistration} placeholder="e.g. UBM 845Z" /></label><div className="form-grid"><label>Vehicle type<input name="vehicleType" defaultValue={initial?.vehicleType} placeholder="e.g. Compactor" /></label><label>Origin area<select name="originArea" defaultValue={initial?.originArea ?? ""}><option value="">Needs confirmation</option><option value="Kampala city">Kampala city</option><option value="Nearby suburbs / outside Kampala">Nearby suburbs / outside Kampala</option></select></label><label>Operator category<select name="operatorCategory" defaultValue={legacyCategory}><option value="">Needs confirmation</option><option value="KCCA direct">KCCA directly managed</option><option value="Concessionaire">Concessionaire</option><option value="Non-concessionaire">Non-concessionaire</option></select></label><label>Company / owner<input name="company" defaultValue={initial?.company} placeholder="e.g. Homeklin or NUJV" /></label><label>Kampala division<input name="division" list="kampala-divisions" defaultValue={initial?.division} placeholder="Only if collected in Kampala" /><datalist id="kampala-divisions"><option value="Central" /><option value="Nakawa" /><option value="Makindye" /><option value="Kawempe" /><option value="Rubaga / Lubaga" /></datalist></label></div><label>Usual route / collection source<input name="route" defaultValue={initial?.route} placeholder="Suggested default only" /></label><label>Default tare (kg)<input name="tareKg" type="number" min="1" inputMode="numeric" defaultValue={initial?.tareKg} placeholder="Leave blank until tare workflow is confirmed" /></label><p className="form-note">Origin, division and operator category are separate. Nabugabo/NUJV belongs under company, not division. Historical entries keep their original snapshot.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">{initial ? "Update" : "Save"} vehicle</button></div></form>;
}

function DriverForm({ initial, suggestedName, onSubmit, onCancel, error }: { initial: DriverRecord | null; suggestedName: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; error: string }) {
  return <form className="master-form" onSubmit={onSubmit}><label>Full name *<input name="fullName" defaultValue={initial?.fullName ?? suggestedName} /></label><label>Telephone<input name="telephone" type="tel" inputMode="tel" defaultValue={initial?.telephone} placeholder="e.g. 0772 000 000" /></label><label>Company / notes<textarea name="notes" rows={3} defaultValue={initial?.notes} /></label><p className="form-note">Changes affect future transactions only. Historical entries retain the original driver details.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">{initial ? "Update" : "Save"} driver</button></div></form>;
}
