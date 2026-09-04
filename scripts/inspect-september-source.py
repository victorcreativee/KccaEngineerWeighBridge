"""Read the supplied workbook only; emit validated rows for a scoped import."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import openpyxl

source = Path('/Users/Victorcreativee/Downloads/sept.xlsx')
workbook = openpyxl.load_workbook(source, data_only=True, read_only=True)
assert len(workbook.worksheets) == 1, 'Unexpected worksheets'
sheet = workbook.worksheets[0]
rows = []
for index, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if not any(value is not None for value in row):
        continue
    assert len(row) == 14, f'Unexpected columns at row {index}'
    unused, date, registration, division, flag, company, route, driver, phone, arrival, gross, tare, net, tonnes = row
    assert unused is None and driver is None and phone is None, f'Unexpected data at row {index}'
    assert isinstance(date, dt.datetime) and date.date().isoformat() in ('2026-09-01', '2026-09-02'), f'Unexpected date at row {index}'
    assert isinstance(arrival, dt.time) and arrival.second == 0 and arrival.microsecond == 0, f'Invalid arrival at row {index}'
    assert registration and division and company and route, f'Missing trip detail at row {index}'
    assert str(flag).strip().lower() in ('yes', 'no'), f'Invalid concessionaire flag at row {index}'
    assert all(isinstance(value, (int, float)) for value in (gross, tare, net, tonnes)), f'Non-numeric weight at row {index}'
    assert gross > tare >= 0 and net > 0 and abs(gross - tare - net) < 0.001 and abs(net / 1000 - tonnes) < 0.000001, f'Weight mismatch at row {index}'
    local_arrival = dt.datetime.combine(date.date(), arrival, dt.timezone(dt.timedelta(hours=3)))
    departure = local_arrival + dt.timedelta(minutes=8)
    rows.append(dict(sourceRow=index, operationDate=date.date().isoformat(), registration=str(registration).strip().upper(), division=str(division).strip(), concessionaire=str(flag).strip().title(), company=str(company).strip(), routeSource=str(route).strip(), arrivalTime=arrival.strftime('%H:%M'), departureTime=departure.strftime('%H:%M'), departureDate=departure.date().isoformat(), transactionAt=local_arrival.isoformat(), departureAt=departure.isoformat(), grossKg=gross, tareKg=tare, netKg=net, sourceTonnes=tonnes, validationErrors=['Zero tare requires confirmation'] if tare == 0 else []))
assert len(rows) == 338, f'Unexpected row count {len(rows)}'
print(json.dumps(dict(file=source.name, sheet=sheet.title, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), rows=rows)))
