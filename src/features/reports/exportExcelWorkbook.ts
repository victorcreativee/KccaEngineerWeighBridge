import type { Row, Worksheet } from "exceljs";
import { divisionLabel } from "../../utils/divisions";

type Correction = { correctedAt: string; correctedBy?: string; reason: string; before: Record<string, string>; after: Record<string, string> };
type Entry = { id: string; localTicket?: string; createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string; operationDate: string; registration: string; division?: string; originArea?: string; operatorCategory?: string; concessionaire?: string; company?: string; routeSource: string; driverName: string; driverPhone: string; arrivalTime: string; departureTime?: string; grossKg: number; tareKg: number; netKg: number; status: "OPEN" | "COMPLETED" | "VOIDED"; completedAt: string; voidReason?: string; voidedAt?: string; voidedBy?: string; correctionHistory?: Correction[] };
type Vehicle = { registration: string; division?: string; originArea?: string; operatorCategory?: string; concessionaire?: string; company?: string; route?: string; vehicleType?: string; tareKg?: number; active?: boolean };
type Driver = { fullName: string; telephone?: string; notes?: string; active?: boolean };
type RecoveryEntry = { recoveryDate: string; material: string; quantityKg: number; trader?: string; notes?: string; recordedBy?: string };
const recoveryMaterials = ["PET (Rwenzori)", "HD Polythenes", "Boxes / Papers", "Soft Plastics", "Scraps / Metals", "Electric Waste", "PVC Pipes", "Food Waste", "Sacks (Old)", "Glass Bottles", "Rubber", "Hard Plastics"];

const green = "176B43";
const darkGreen = "10372C";
const paleGreen = "E8F3ED";
const paleBlue = "DDEBF7";
const palePurple = "E4DFEC";
const paleAmber = "FFF2CC";
const white = "FFFFFF";

function title(sheet: Worksheet, text: string, columns: number, note?: string) {
  sheet.mergeCells(1, 1, 1, columns);
  const cell = sheet.getCell(1, 1); cell.value = text; cell.font = { name: "Arial", size: 16, bold: true, color: { argb: white } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } }; cell.alignment = { vertical: "middle", horizontal: "left" }; sheet.getRow(1).height = 28;
  if (note) { sheet.mergeCells(2, 1, 2, columns); const noteCell = sheet.getCell(2, 1); noteCell.value = note; noteCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "53635B" } }; noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: paleGreen } }; noteCell.alignment = { vertical: "middle", wrapText: true }; sheet.getRow(2).height = 28; }
}

function header(row: Row) {
  row.height = 34;
  row.eachCell((cell) => { cell.font = { name: "Arial", size: 9, bold: true, color: { argb: white } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "AABBB2" } } }; });
}

function body(sheet: Worksheet, startRow: number, endRow: number, numericColumns: number[] = []) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber); row.height = 22;
    row.eachCell((cell, column) => { cell.font = { name: "Arial", size: 9, color: { argb: "18251F" } }; cell.alignment = { vertical: "middle", horizontal: numericColumns.includes(column) ? "right" : "left", wrapText: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? "F6F8F7" : white } }; cell.border = { bottom: { style: "hair", color: { argb: "DDE5E0" } } }; });
  }
}

function jsonArray<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; } }
function ticket(entry: Entry) { return entry.localTicket ?? entry.id.slice(0, 8).toUpperCase(); }
function latestCorrection(entry: Entry) { return entry.correctionHistory?.at(-1); }
function createdAt(entry: Entry) { return entry.createdAt ?? entry.completedAt; }
function updatedAt(entry: Entry) { return entry.updatedAt ?? entry.voidedAt ?? latestCorrection(entry)?.correctedAt ?? entry.completedAt; }
function updatedBy(entry: Entry) { return entry.updatedBy ?? entry.voidedBy ?? latestCorrection(entry)?.correctedBy ?? entry.createdBy ?? "Not recorded"; }
function changes(values: Record<string, string>) { return Object.entries(values).map(([field, value]) => `${field}: ${value || "(blank)"}`).join("; "); }

export async function exportExcelWorkbook(entries: Entry[], fromDate: string, toDate: string) {
  const category = (item: Entry | Vehicle) => item.operatorCategory || (item.concessionaire === "Yes" ? "Concessionaire" : item.concessionaire === "No" ? "Non-concessionaire" : "Unconfirmed");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Buyala Waste Operations"; workbook.created = new Date();
  const selected = entries.filter((entry) => entry.status === "COMPLETED" && entry.operationDate >= fromDate && entry.operationDate <= toDate).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const selectedAll = entries.filter((entry) => entry.operationDate >= fromDate && entry.operationDate <= toDate).sort((a, b) => createdAt(a).localeCompare(createdAt(b)));
  const allCompleted = entries.filter((entry) => entry.status === "COMPLETED").sort((a, b) => a.operationDate.localeCompare(b.operationDate) || a.completedAt.localeCompare(b.completedAt));
  const vehicles = jsonArray<Vehicle>("buyala.local.vehicles.v1");
  const drivers = jsonArray<Driver>("buyala.local.drivers.v1");
  const recovery = jsonArray<RecoveryEntry>("buyala.local.recovery.v1").filter((entry) => entry.recoveryDate >= fromDate && entry.recoveryDate <= toDate);

  const log = workbook.addWorksheet("Daily_Log", { views: [{ state: "frozen", ySplit: 4 }] });
  title(log, "BUYALA LANDFILL — DAILY WEIGHBRIDGE LOG", 16, `Completed transactions from ${fromDate} to ${toDate}. Origin, division and operator category are separate reporting fields.`);
  log.addRow([]); log.addRow(["Ticket No.", "Date", "Reg. No.", "Origin Area", "Kampala Division", "Operator Category", "Company", "Collection Site\n/ Route", "Driver Name", "Tel.", "Arrival\nTime", "Gross Wt\n(kg)", "Tare Wt\n(kg)", "Net Wt\n(kg)", "Departure\nTime", "Status"]); header(log.getRow(4));
  selected.forEach((entry) => log.addRow([ticket(entry), entry.operationDate, entry.registration, entry.originArea ?? "", entry.division ?? "", category(entry), entry.company ?? "", entry.routeSource, entry.driverName, entry.driverPhone, entry.arrivalTime, entry.grossKg, entry.tareKg, entry.netKg, entry.departureTime ?? "", entry.status]));
  body(log, 5, log.rowCount, [12, 13, 14]);
  [4, 5, 6, 7, 8].forEach((column) => { log.getColumn(column).eachCell((cell, row) => { if (row >= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: paleBlue } }; }); });
  [9, 10].forEach((column) => { log.getColumn(column).eachCell((cell, row) => { if (row >= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palePurple } }; }); });
  [12, 13, 14].forEach((column) => { log.getColumn(column).numFmt = "#,##0"; });
  log.columns.forEach((column, index) => { column.width = [18, 13, 15, 25, 18, 22, 22, 28, 20, 16, 12, 14, 14, 14, 13, 12][index]; }); log.autoFilter = "A4:P4";

  const summary = workbook.addWorksheet("Daily_Summary", { views: [{ state: "frozen", ySplit: 3 }] });
  title(summary, "BUYALA LANDFILL — OPERATIONAL SUMMARY", 5, `Calculated from completed transactions between ${fromDate} and ${toDate}.`);
  const totalGross = selected.reduce((sum, entry) => sum + entry.grossKg, 0); const totalTare = selected.reduce((sum, entry) => sum + entry.tareKg, 0); const totalNet = selected.reduce((sum, entry) => sum + entry.netKg, 0);
  summary.addRow([]); summary.addRow(["OVERALL TOTALS"]); summary.mergeCells("A4:E4"); summary.getCell("A4").font = { bold: true, color: { argb: white } }; summary.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
  const days = Math.max(1, Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000) + 1);
  [["Total vehicles logged", selected.length], ["KCCA direct", selected.filter((entry) => category(entry) === "KCCA direct").length], ["KCCA/INDIVIDUAL", selected.filter((entry) => category(entry) === "KCCA/INDIVIDUAL").length], ["Concessionaires", selected.filter((entry) => category(entry) === "Concessionaire").length], ["Non-Concessionaires", selected.filter((entry) => category(entry) === "Non-concessionaire").length], ["Total gross weight (kg)", totalGross], ["Total tare weight (kg)", totalTare], ["Total net weight (kg)", totalNet], ["Total net tonnes", totalNet / 1000], ["Average tonnes per trip", selected.length ? totalNet / 1000 / selected.length : 0], ["Daily average tonnes", totalNet / 1000 / days]].forEach(([label, value]) => summary.addRow([label, "", "", value]));
  summary.addRow([]); summary.addRow(["BREAKDOWN BY DIVISION"]); summary.mergeCells(`A${summary.rowCount}:E${summary.rowCount}`); summary.getCell(`A${summary.rowCount}`).font = { bold: true, color: { argb: white } }; summary.getCell(`A${summary.rowCount}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
  summary.addRow(["Division", "Vehicles", "Net Weight (kg)", "Net Weight (T)", "% of Total"]); header(summary.getRow(summary.rowCount));
  const divisionMap = new Map<string, { count: number; net: number }>(); selected.forEach((entry) => { const name = divisionLabel(entry.division); const value = divisionMap.get(name) ?? { count: 0, net: 0 }; divisionMap.set(name, { count: value.count + 1, net: value.net + entry.netKg }); });
  divisionMap.forEach((value, name) => summary.addRow([name, value.count, value.net, value.net / 1000, totalNet ? value.net / totalNet : 0])); body(summary, 5, summary.rowCount, [2, 3, 4, 5]); summary.getColumn(4).numFmt = "#,##0.000"; summary.getColumn(5).numFmt = "0.0%"; summary.columns.forEach((column, index) => { column.width = [28, 14, 20, 18, 16][index]; });
  function addSummaryBreakdown(section: string, firstColumn: string, label: (entry: Entry) => string) {
    summary.addRow([]); const sectionRow = summary.addRow([section]); summary.mergeCells(`A${sectionRow.number}:E${sectionRow.number}`); sectionRow.getCell(1).font = { bold: true, color: { argb: white } }; sectionRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
    const headings = summary.addRow([firstColumn, "Trips", "Net Weight (kg)", "Net Weight (T)", "% of Total"]); header(headings);
    const map = new Map<string, { count: number; net: number }>(); selected.forEach((entry) => { const name = label(entry) || "Unconfirmed"; const value = map.get(name) ?? { count: 0, net: 0 }; map.set(name, { count: value.count + 1, net: value.net + entry.netKg }); });
    [...map.entries()].sort((a, b) => b[1].net - a[1].net).forEach(([name, value]) => summary.addRow([name, value.count, value.net, value.net / 1000, totalNet ? value.net / totalNet : 0]));
  }
  addSummaryBreakdown("BREAKDOWN BY ORIGIN AREA", "Origin Area", (entry) => entry.originArea || "Unconfirmed origin");
  addSummaryBreakdown("BREAKDOWN BY OPERATOR CATEGORY", "Operator Category", category);
  addSummaryBreakdown("BREAKDOWN BY PRIVATE COMPANY", "Private Company", (entry) => category(entry) === "KCCA direct" ? "KCCA direct (not private)" : entry.company || "Other / unconfirmed private company");
  body(summary, 5, summary.rowCount, [2, 3, 4, 5]); summary.getColumn(4).numFmt = "#,##0.000"; summary.getColumn(5).numFmt = "0.0%";
  summary.eachRow((row) => { const first = String(row.getCell(1).value ?? ""); const second = String(row.getCell(2).value ?? ""); if (first.startsWith("BREAKDOWN")) { row.getCell(1).font = { bold: true, color: { argb: white } }; row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; } else if (first === "Division" || second === "Trips") header(row); });

  const vehicleSheet = workbook.addWorksheet("Vehicle_DB", { views: [{ state: "frozen", ySplit: 3 }] }); title(vehicleSheet, "BUYALA LANDFILL — VEHICLE MASTER DATABASE", 9, "Origin, Kampala division and operator category are stored separately."); vehicleSheet.addRow(["Reg. No.", "Origin Area", "Kampala Division", "Operator Category", "Company / Owner", "Collection Site / Route", "Vehicle Type", "Tare Weight (kg)", "Status"]); header(vehicleSheet.getRow(3)); vehicles.forEach((vehicle) => vehicleSheet.addRow([vehicle.registration, vehicle.originArea ?? "", vehicle.division ?? "", category(vehicle), vehicle.company ?? "", vehicle.route ?? "", vehicle.vehicleType ?? "", vehicle.tareKg ?? "", vehicle.active === false ? "Inactive" : "Active"])); body(vehicleSheet, 4, vehicleSheet.rowCount, [8]); vehicleSheet.getColumn(8).numFmt = "#,##0"; vehicleSheet.columns.forEach((column, index) => { column.width = [16, 25, 18, 22, 24, 32, 18, 18, 12][index]; }); vehicleSheet.autoFilter = `A3:I${Math.max(3, vehicleSheet.rowCount)}`;

  const driverSheet = workbook.addWorksheet("Driver_DB", { views: [{ state: "frozen", ySplit: 3 }] }); title(driverSheet, "BUYALA LANDFILL — DRIVER DATABASE", 4, "Driver names and telephone numbers used during weighbridge entry."); driverSheet.addRow(["Driver Name", "Phone Number", "Notes / Company", "Status"]); header(driverSheet.getRow(3)); drivers.forEach((driver) => driverSheet.addRow([driver.fullName, driver.telephone ?? "", driver.notes ?? "", driver.active === false ? "Inactive" : "Active"])); body(driverSheet, 4, driverSheet.rowCount); driverSheet.columns.forEach((column, index) => { column.width = [25, 18, 35, 12][index]; }); driverSheet.autoFilter = `A3:D${Math.max(3, driverSheet.rowCount)}`;

  const archive = workbook.addWorksheet("Monthly_Archive", { views: [{ state: "frozen", ySplit: 3 }] }); title(archive, "MONTHLY ARCHIVE — COMPLETED TRANSACTIONS", 16, "Automatically assembled from all locally completed records. No manual copying is required."); archive.addRow(["Ticket No.", "Date", "Reg. No.", "Origin Area", "Kampala Division", "Operator Category", "Company", "Collection Site / Route", "Driver", "Tel.", "Arrival", "Gross kg", "Tare kg", "Net kg", "Departure", "Status"]); header(archive.getRow(3)); allCompleted.forEach((entry) => archive.addRow([ticket(entry), entry.operationDate, entry.registration, entry.originArea ?? "", entry.division ?? "", category(entry), entry.company ?? "", entry.routeSource, entry.driverName, entry.driverPhone, entry.arrivalTime, entry.grossKg, entry.tareKg, entry.netKg, entry.departureTime ?? "", entry.status])); body(archive, 4, archive.rowCount, [12, 13, 14]); [12, 13, 14].forEach((column) => { archive.getColumn(column).numFmt = "#,##0"; }); archive.columns.forEach((column, index) => { column.width = [18, 13, 15, 25, 18, 22, 24, 30, 22, 16, 12, 14, 14, 14, 13, 12][index]; }); archive.autoFilter = `A3:P${Math.max(3, archive.rowCount)}`;

  const audit = workbook.addWorksheet("Audit_Log", { views: [{ state: "frozen", ySplit: 3 }] });
  title(audit, "BUYALA LANDFILL — TRANSACTION AUDIT LOG", 12, `All open, completed and voided records dated ${fromDate} to ${toDate}. Older records may show “Not recorded” where accountability fields did not yet exist.`);
  audit.addRow(["Ticket No.", "Date", "Registration", "Record Status", "Created By", "Created At", "Last Updated By", "Last Updated At", "Corrections", "Voided By", "Voided At", "Void Reason"]); header(audit.getRow(3));
  selectedAll.forEach((entry) => audit.addRow([ticket(entry), entry.operationDate, entry.registration, entry.status, entry.createdBy ?? "Not recorded", createdAt(entry), updatedBy(entry), updatedAt(entry), entry.correctionHistory?.length ?? 0, entry.voidedBy ?? "", entry.voidedAt ?? "", entry.voidReason ?? ""]));
  body(audit, 4, audit.rowCount, [9]); audit.columns.forEach((column, index) => { column.width = [18, 13, 16, 15, 22, 24, 22, 24, 13, 22, 24, 45][index]; }); audit.autoFilter = `A3:L${Math.max(3, audit.rowCount)}`;

  const correctionSheet = workbook.addWorksheet("Correction_History", { views: [{ state: "frozen", ySplit: 3 }] });
  title(correctionSheet, "BUYALA LANDFILL — CORRECTION HISTORY", 8, `Immutable before-and-after correction details for transactions dated ${fromDate} to ${toDate}.`);
  correctionSheet.addRow(["Ticket No.", "Registration", "Transaction Date", "Corrected At", "Corrected By", "Reason", "Values Before", "Values After"]); header(correctionSheet.getRow(3));
  selectedAll.forEach((entry) => (entry.correctionHistory ?? []).forEach((correction) => correctionSheet.addRow([ticket(entry), entry.registration, entry.operationDate, correction.correctedAt, correction.correctedBy ?? "Not recorded", correction.reason, changes(correction.before), changes(correction.after)])));
  body(correctionSheet, 4, correctionSheet.rowCount); correctionSheet.columns.forEach((column, index) => { column.width = [18, 16, 16, 24, 22, 38, 70, 70][index]; }); correctionSheet.autoFilter = `A3:H${Math.max(3, correctionSheet.rowCount)}`;

  const recoverySheet = workbook.addWorksheet("Materials_Recovered", { views: [{ state: "frozen", ySplit: 3, xSplit: 1 }] });
  title(recoverySheet, "MATERIALS RECOVERED OUT OF BUYALA LANDFILL", recoveryMaterials.length + 2, `Daily quantities in kilograms from ${fromDate} to ${toDate}. This recovery record is separate from incoming weighbridge net waste.`);
  recoverySheet.addRow(["Date", ...recoveryMaterials, "Grand Total"]); header(recoverySheet.getRow(3));
  const recoveryDates = [...new Set(recovery.map((entry) => entry.recoveryDate))].sort();
  recoveryDates.forEach((date) => { const values = recoveryMaterials.map((material) => recovery.filter((entry) => entry.recoveryDate === date && entry.material === material).reduce((sum, entry) => sum + entry.quantityKg, 0)); recoverySheet.addRow([date, ...values, values.reduce((sum, value) => sum + value, 0)]); });
  const grandValues = recoveryMaterials.map((material) => recovery.filter((entry) => entry.material === material).reduce((sum, entry) => sum + entry.quantityKg, 0)); const grandRow = recoverySheet.addRow(["Grand Total", ...grandValues, grandValues.reduce((sum, value) => sum + value, 0)]);
  body(recoverySheet, 4, recoverySheet.rowCount, Array.from({ length: recoveryMaterials.length + 1 }, (_, index) => index + 2)); grandRow.eachCell((cell) => { cell.font = { name: "Arial", size: 9, bold: true, color: { argb: white } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } }; }); recoverySheet.columns.forEach((column, index) => { column.width = index === 0 ? 14 : index === recoveryMaterials.length + 1 ? 16 : 18; }); recoverySheet.autoFilter = `A3:N${Math.max(3, recoverySheet.rowCount)}`;

  const guide = workbook.addWorksheet("How_To_Use"); title(guide, "BUYALA WASTE OPERATIONS — EXCEL EXPORT GUIDE", 2, "This workbook is generated from locally saved application data."); guide.addRow(["Section", "Guidance"]); header(guide.getRow(3)); [["Daily_Log", "Completed transactions for the selected report period with origin, division, operator and company kept separate."], ["Daily_Summary", "Totals plus division, origin, operator-category and private-company contributions."], ["Vehicle_DB", "Current locally saved vehicle master records."], ["Driver_DB", "Current locally saved driver master records."], ["Monthly_Archive", "All locally completed transactions; no manual copy-and-paste required."], ["Audit_Log", "All transaction states in the selected period, including who created and last updated each record, correction counts and void details."], ["Correction_History", "One row per audited correction, retaining the reason and before-and-after values."], ["Materials_Recovered", "Daily recovered kilograms arranged by material, with row and column totals matching the existing monthly spreadsheet style."], ["Important", "Recovered-material quantities are separate from incoming vehicle gross, tare and net waste figures."]].forEach((row) => guide.addRow(row)); body(guide, 4, guide.rowCount); const importantRow = guide.rowCount; guide.getCell(`A${importantRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: paleAmber } }; guide.getCell(`B${importantRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: paleAmber } }; guide.columns = [{ width: 24 }, { width: 90 }];

  const output = await workbook.xlsx.writeBuffer();
  const blob = new Blob([output as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `buyala-weighbridge-${fromDate}-to-${toDate}.xlsx`; anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
