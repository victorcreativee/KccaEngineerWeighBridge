# Weighbridge workbook findings

These notes record what `Weighbridge_v3.xlsx` currently does. They describe the workbook; they do not silently convert workbook assumptions into confirmed KCCA policy.

## Observed workflow

- The workbook contains `Vehicle_DB`, `Driver_DB`, `Daily_Log`, `Daily_Summary`, `Monthly_Archive`, and `How_To_Use`.
- `Daily_Log` records ticket number, date, registration, division, concessionaire Yes/No, company, route, driver, telephone, arrival, gross, tare, net, and departure.
- Vehicle details are looked up from `Vehicle_DB` by exact registration.
- Driver telephone is looked up from `Driver_DB` by driver name.
- Net weight is calculated as gross weight minus tare weight.
- The daily summary counts concessionaire and non-concessionaire vehicles, unknown vehicles and drivers, weights, and division contributions.
- End-of-day data is manually copied into `Monthly_Archive`.

## Important workbook assumptions that remain unconfirmed

- The workbook instructs staff to enter a default tare once per vehicle and then looks it up automatically. The original product plan still marks the true tare workflow as `NEEDS CONFIRMATION`, so the app must continue to support both stored tare and a second weighing.
- The workbook assigns a usual route and division to each vehicle. The app treats these as suggestions/snapshots because vehicles may operate on different routes or divisions.
- `Nabugabo` appears alongside KCCA divisions in the workbook, but later supplied 2021 and 2026 reports identify Nabugabo/NUJV as a private operator. Future UI must therefore stop treating it as a division while preserving legacy records unchanged.
- The workbook includes a Day shift field, but multiple-shift requirements remain unconfirmed.

## Product implications

- Normalize vehicle registration matching instead of requiring exact punctuation and spacing.
- Preserve vehicle, company, division, concessionaire, route, and driver snapshots on each transaction.
- Record arrival and departure separately so turnaround time can be reported.
- Replace manual monthly copying with date-range reports and exports.
- Keep `tareCaptureMode` explicitly `UNCONFIRMED` until KCCA confirms the operating procedure.
