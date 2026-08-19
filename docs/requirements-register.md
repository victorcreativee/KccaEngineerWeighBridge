# Buyala pilot — unresolved requirements

These questions remain **NEEDS CONFIRMATION**. They must not become product rules without an operator or KCCA stakeholder answer.

1. Is tare stored per vehicle, or measured after dumping?
2. Can the same vehicle use different collection routes?
3. Can the same vehicle operate under different divisions?
4. What exactly does `Nabugabo` represent?
5. Are there multiple daily shifts?
6. Who enters weighbridge records?
7. Are records reviewed or approved by another person?
8. Are trucks ever rejected?
9. Is waste type/category recorded?
10. Are payments or fees involved?
11. Are receipts generated?
12. Does the engineer prepare weekly reports?
13. What monthly reports are submitted?
14. Who receives reports?
15. What is the correction process for an incorrect weight?
16. What is the policy for an unregistered vehicle?
17. What is the policy for an unregistered driver?
18. How reliable is weighbridge internet connectivity?
19. How many people will use the pilot?
20. Which devices will operators use?

## Safe architectural defaults

- Preserve `facilityId` without building multi-facility screens.
- Store transaction snapshots so historical records do not change with master data.
- Represent tare capture as an explicit mode whose initial value is `UNCONFIRMED`.
- Normalize registrations for matching while retaining the entered display value.
- Preserve unmatched vehicle and driver flags after manual details are entered.
- Retain completed transactions; corrections and voids must remain auditable.
