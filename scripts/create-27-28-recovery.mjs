import fs from "node:fs";
import path from "node:path";

const sourcePath = "/Users/Victorcreativee/Downloads/buyala-full-backup-2026-09-02.json";
const outputPath = path.resolve("deliverables/buyala-recovery-2026-08-27-to-2026-08-30.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const dates = new Set(["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"]);
const entries = (source.entries ?? []).filter((entry) => dates.has(entry.operationDate));
const recovery = {
  schemaVersion: 3,
  application: "Buyala Waste Operations",
  purpose: "Restore Buyala master data and transactions from 27–30 August 2026 before final reset",
  exportedAt: new Date().toISOString(),
  sourceBackup: path.basename(sourcePath),
  vehicles: source.vehicles ?? [],
  drivers: source.drivers ?? [],
  entries,
  auditEvents: [],
  recoveryEntries: [],
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(recovery, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, vehicles: recovery.vehicles.length, drivers: recovery.drivers.length, entries: entries.length, dates: Object.fromEntries([...dates].map((date) => [date, entries.filter((entry) => entry.operationDate === date).length])) }, null, 2));
