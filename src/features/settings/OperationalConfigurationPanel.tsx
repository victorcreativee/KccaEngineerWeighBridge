"use client";

import { FormEvent, useEffect, useState } from "react";
import { getOperationalConfig, saveOperationalConfig, type OperationalConfig } from "../../services/firebase/operationalConfig";
import { logAudit } from "../../utils/localAudit";

function lines(value: string) {
  return [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))];
}

export function OperationalConfigurationPanel({ adminName }: { adminName: string }) {
  const [config, setConfig] = useState<OperationalConfig>(getOperationalConfig);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const refresh = () => setConfig(getOperationalConfig());
    window.addEventListener("buyala:operational-config", refresh);
    return () => window.removeEventListener("buyala:operational-config", refresh);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const facilityName = String(data.get("facilityName") ?? "").trim();
    const ticketPrefix = String(data.get("ticketPrefix") ?? "").trim().toUpperCase();
    const divisions = lines(String(data.get("divisions") ?? ""));
    const vehicleTypes = lines(String(data.get("vehicleTypes") ?? ""));
    if (!facilityName || !ticketPrefix || !divisions.length || !vehicleTypes.length) return setMessage("Complete every required configuration field before saving.");
    setSaving(true); setMessage("");
    try {
      const next = await saveOperationalConfig({ ...config, facilityName, facilityCode: String(data.get("facilityCode") ?? "").trim().toUpperCase(), ticketPrefix, divisions, vehicleTypes, updatedAt: new Date().toISOString(), updatedBy: adminName });
      setConfig(next);
      logAudit(adminName, "System Admin", "CONFIGURATION_UPDATED", `Updated facility configuration, ${next.divisions.length} divisions and ${next.vehicleTypes.length} vehicle types`, next.facilityCode);
      setMessage("Operational configuration saved. New forms and connected devices will use it automatically.");
    } catch {
      setMessage("Saved on this device, but Firebase could not confirm the update. Reconnect and save again.");
    } finally { setSaving(false); }
  }

  return <section className="operational-config-card">
    <div className="config-card-heading"><div><p className="master-kicker">OPERATIONAL CONFIGURATION</p><h3>Facility and reference data</h3><p>Control the standard choices used for future vehicle records. Existing transactions keep their original values.</p></div><span>System Admin only</span></div>
    <form onSubmit={submit} key={`${config.updatedAt ?? "default"}:${config.divisions.join("|")}`}>
      <div className="config-fields">
        <label>Facility name *<input name="facilityName" defaultValue={config.facilityName} required /></label>
        <label>Facility code<input name="facilityCode" defaultValue={config.facilityCode} maxLength={12} /></label>
        <label>Ticket prefix *<input name="ticketPrefix" defaultValue={config.ticketPrefix} maxLength={6} required /><small>Used for new local ticket numbers, for example BUY-20260829-001.</small></label>
        <label>Timezone<input value={config.timezone} disabled /><small>Fixed to Uganda time for consistent reports.</small></label>
        <label className="config-list">Kampala divisions *<textarea name="divisions" rows={6} defaultValue={config.divisions.join("\n")} required /><small>One division per line. Lubaga is included in the official default list.</small></label>
        <label className="config-list">Vehicle types *<textarea name="vehicleTypes" rows={6} defaultValue={config.vehicleTypes.join("\n")} required /><small>One vehicle type per line. Operators can still enter a different value when necessary.</small></label>
      </div>
      <div className="config-footer"><p>Reporting categories remain protected: KCCA direct, KCCA/INDIVIDUAL, Concessionaire and Non-concessionaire.</p><button type="submit" disabled={saving}>{saving ? "Saving configuration…" : "Save operational configuration"}</button></div>
      {message && <p className="config-message" role="status">{message}</p>}
    </form>
  </section>;
}
