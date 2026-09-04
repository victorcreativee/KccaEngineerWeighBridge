# Buyala reporting foundation

This foundation combines the original product brief, `Weighbridge_v3.xlsx`, the supplied June 2021 narrative, and `sample for app development.doc`. Historical statements help define report structure; they are not live pilot records.

## Reporting dimensions that must remain separate

### Geographic origin

- Kampala city
- Nearby suburbs / outside Kampala

This answers where the waste originated at the broadest level.

### Kampala division

The supplied reports identify:

- Central
- Rubaga / Lubaga — spelling needs confirmation
- Nakawa
- Makindye
- Kawempe

`Nabugabo` must not be offered as a division. A free-text or `Other / outside Kampala` path is still needed for nearby-suburb waste until geographic reference data is confirmed.

### Operator category

The June 2021 narrative distinguishes:

- KCCA directly managed
- Concessionaire
- Non-concessionaire

The June 2026 document groups delivery more broadly as KCCA directly managed versus private companies. The transaction model should preserve the three-category detail and allow reports to aggregate the two private categories when required.

### Private company / operator

Named private operators in the supplied material include:

- Nabugabo Updeal Joint Venture (NUJV)
- Homeklin (U) Limited
- Kampala Solid Waste Management Consortium — the supplied materials use both `KSMC` and `KSWMC`; canonical spelling needs confirmation
- Other private companies

The company/operator is not the same thing as a division or route.

### Collection source / route

The actual collection site or route belongs to the trip. A vehicle's usual route may be suggested but must not overwrite the recorded trip source.

## Required measures

- Vehicle/trip count
- Gross, tare, and net kilograms
- Net tonnes
- Tonnes per trip (`net tonnes / completed trips`)
- Percentage contribution by geographic origin, division, operator category, and private company
- Daily average tonnes for a selected period
- Month-over-month tonnage change when both complete periods exist
- Unknown vehicle and driver counts
- Open, completed, and voided transaction counts
- Arrival, departure, and turnaround time

## Data-quality cautions in the supplied material

- The narrative says `1st–31st June 2021`, but June has 30 days.
- The attached `.doc` identifies its source as June 2026, so it must not be merged with the June 2021 figures.
- The June 2026 document states 214 maximum collector trucks in prose but its table totals 227 vehicles.
- The listed division trip counts sum to 13,009, while the stated KCCA total is 6,032 trips.
- `Rubaga` and `Lubaga`, and `KSMC` and `KSWMC`, appear as competing spellings.

These discrepancies must remain visible as source issues. The application must calculate reports from transaction records rather than hard-code any supplied percentage or total.

## Next implementation sequence

1. Separate `originArea`, `division`, `operatorCategory`, and `company` in vehicle and transaction data.
2. Preserve backward compatibility for existing local `concessionaire: Yes/No` records.
3. Update Daily Operations snapshots and Records filters.
4. Add operator-category, private-company, and tonnes-per-trip report sections.
5. Add month-over-month comparison only after date-range completeness rules are confirmed.
