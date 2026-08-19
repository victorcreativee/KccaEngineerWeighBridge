# Buyala Waste Operations

Pilot progressive web application for daily weighbridge work at Buyala Waste Management Facility.

## Current phase

Phase 1 establishes the responsive application shell, PWA metadata, core weighbridge domain types, registration normalization, and the unresolved-requirements register. Dashboard values are sample data and are labelled accordingly. Firebase authentication and live Firestore data are intentionally not connected yet.

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run test
```

## Product guardrail

The system is designed around the weighbridge operator rather than the workbook layout. Requirements marked `NEEDS CONFIRMATION` must remain unresolved until confirmed by an operator or KCCA stakeholder.
