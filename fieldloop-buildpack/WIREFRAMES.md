# FieldLoop v0.1 — End-to-End Application Wireframe Suite

The 12 screens below are the canonical UI contract. The implementation renders
these verbatim, styled per [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). Text in
`[brackets]` is an interactive control; `•` lines are content; `(n)` are counts.

### Screen 1 — Multi-entity scheduler (office web)

```
┌────────────────────────────────────────────────────────────────────────┐
│ CHATSWORTH GROUP | Entity: [ Caulfield South Plumbing  ▾ ]             │
├──────────────┬─────────────────────────────┬───────────────────────────┤
│ UNASSIGNED   │ DISPATCH CANVAS (MELBOURNE) │ TECHNICIAN STATUS         │
│ • #J-1042    │ 08:00 - Dave M. [Roof Dist] │ (green) Dave M. On-Site   │
│   Insurance  │ 10:30 - Liam T. [Plumbing]  │ (red)   Sam K. In Transit │
│ • #J-1043    │ 13:00 - Mark P. [Majon Kit] │ (grey)  Chris P. Off Duty │
│   Body Corp  │                             │                           │
├──────────────┴─────────────────────────────┴───────────────────────────┤
│ [ + CREATE NEW JOB ] [ DIVISION REVENUE ] [ XERO/MYOB BATCH SYNC ]      │
└────────────────────────────────────────────────────────────────────────┘
```

### Screen 2 — JSA / SWMS pre-start checklist (mobile)

```
[←] MANDATORY SITE SAFETY CHECK              JOB #14502
────────────────────────────────────────────────────
HIGH-RISK CONSTRUCTION WORK (HRCW) CHECKS
[ YES ] [ NO ]  Gas line isolation required?
[ YES ] [ NO ]  Working at height > 2 m / roof cavity?
[ YES ] [ NO ]  Trenching or excavation > 1.5 m?

PPE VERIFICATION
[✓] Steel Caps   [✓] Eye Protection   [✓] Gas Sniffer
────────────────────────────────────────────────────
[  SIGN & UNLOCK JOB CLOCK-IN  (PRIMARY · MACHINED CHROME) ]
```

### Screen 3 — Vehicle inspection & hazard log (mobile)

```
VEHICLE CHECK & HAZARD LOG
────────────────────────────────────────────────────
VEHICLE: VW Amarok Van 01 (VIC-PLMB)
• Ladder racks & straps            [ PASS ] [ FAIL ]
• Press tool calibration date      [ PASS ] [ FAIL ]

LOG NEAR-MISS / HAZARD
[  PHOTO FAULTY EQUIPMENT  ]
Note: "Damaged extension lead tagged out of service."
────────────────────────────────────────────────────
[  SUBMIT OHS REPORT  ]
```

### Screen 4 — Active work order & voice capture (mobile)

```
[←] WORK ORDER #14502              (timer) 01:42:10 ACTIVE
────────────────────────────────────────────────────
DIAGNOSTIC NOTES
[  TAP TO TALK  ]  "Riser leak feeding Unit 6."

TRUCK INVENTORY & PARTS
[  SCAN BARCODE / RECEIPT  ]
• 2x 25 mm KemPress Copper Elbows ($18.00)

EVIDENCE GATE (1 before + 1 after required)
[  Before Photo (1)  ]   [  After Photo (1)  ]
────────────────────────────────────────────────────
[  COMPLETE JOB & PROCEED TO SIGNOFF  (PRIMARY · MACHINED CHROME) ]
```

### Screen 5 — Body corporate & insurance cause of loss (mobile)

```
SPECIALTY CONTEXT                              JOB #14502
────────────────────────────────────────────────────
JOB TYPE: [ Body Corporate ]  [ Insurance Repair ]

INSURANCE DETAILS
Insurer: RACV | Claim #: CLM-992014
Cause of Loss: [ Burst Flexi Hose ▾ ]

BODY CORPORATE METADATA
Plan #: OC-4021 | Strata Manager: agent@strata.com.au
────────────────────────────────────────────────────
[  SAVE & ATTACH TO INVOICE PACKAGE  ]
```

### Screen 6 — Cross-trade internal referral (mobile)

```
CROSS-TRADE INTERNAL REFERRAL
────────────────────────────────────────────────────
TARGET DIVISION
[  ] Roof Distributors  (Roofing / Guttering)
[✓] Majon Kitchens     (Cabinetry Repair)

REASON FOR HANDOFF
"Water damage to under-sink vanity carcass."
[  ATTACH SITE DAMAGE PHOTOS (3)  ]
────────────────────────────────────────────────────
[  DISPATCH LINKED LEAD TO MAJON KITCHENS  ]
```

### Screen 7 — VBA compliance certificate & gas test (mobile)

```
VBA COMPLIANCE CERTIFICATE                  VIC PIC: 118492
────────────────────────────────────────────────────
JOB VALUE: $1,250.00 (Exceeds $750 threshold → COES)
WORK CLASS: [✓] Gasfitting  [✓] Sanitary  [ ] Roofing

GAS SOUNDNESS TEST
• Static Pressure: 5.0 kPa
• Test Duration: 5 mins | Pressure Drop: 0.0 kPa

DECLARATION
"I certify work complies with AS/NZS 5601 & 3500."
────────────────────────────────────────────────────
[  LODGE CERTIFICATE TO VBA360  (APERTURE RED · DESTRUCTIVE) ]
```

### Screen 8 — Backflow & TMV service certification (mobile)

```
ANNUAL BACKFLOW / TMV TEST REPORT
────────────────────────────────────────────────────
DEVICE: RPZD-4421 | LOCATION: Plant Room B
• Line Pressure: 550 kPa
• Relief Valve Opening Pressure: 14 kPa (Pass > 14 kPa)

TMV TEMPERATURE CHECK
• Hot Supply: 68 °C  | Mixed Outlet: 43.5 °C
STATUS: [ GREEN BADGE: CERTIFIED COMPLIANT ]
────────────────────────────────────────────────────
[  GENERATE PDF & PUSH TO WATER AUTHORITY  ]
```

### Screen 9 — Client signature & dispute shield (mobile)

```
CLIENT SIGNOFF & DISPUTE SHIELD
────────────────────────────────────────────────────
SUMMARY: 1.7 hrs Labour + Materials | Total: $351.45
EVIDENCE: 2 Photos Attached | JSA Completed

CLIENT SIGNATURE CANVAS
┌────────────────────────────────────────────────────┐
│ Marlene Cho                                        │
└────────────────────────────────────────────────────┘
HASH: SHA256:<64-hex chars>
────────────────────────────────────────────────────
[  LOCK JOB & GENERATE FINAL INVOICE  ]
```

### Screen 10 — Quotation & scope variation (mobile)

```
[←] QUOTE & VARIATION                          Q-2091
────────────────────────────────────────────────────
CLIENT: Marlene Cho | 9 Booran Rd, Caulfield
MODE: [ Standard Quote ]  [ Scope Variation ]

LINE ITEMS
• Caroma Cleanflush Toilet Suite            $450.00
• 3.5 hrs Labour @ $145/hr                  $507.50
• Callout & Disposal Fee                    $120.00

[ + ADD LINE ITEM ]  [  VOICE DRAFT SCOPE  ]
────────────────────────────────────────────────────
SUB-TOTAL: $1,077.50 | GST (10%): $107.75
TOTAL INC GST: $1,185.25
────────────────────────────────────────────────────
[  SIGN & APPROVE QUOTE  (PRIMARY · MACHINED CHROME) ]
```

### Screen 11 — Supplier PO & award timesheet (mobile)

```
PURCHASE ORDER (PO) & TIMESHEET
────────────────────────────────────────────────────
SUPPLIER: Reece Caulfield
JOB LINK: #J-1043 (Glen Eira Rd Riser)
ITEM: 1x Rinnai B26 Continuous Flow HWU ($1,120.00)
[ GENERATE PO #2024-88 ]
────────────────────────────────────────────────────
TODAY'S TIMESHEET (FAIR WORK AWARD)
Clock-In: 07:00 | Smoko: 10:00 (15 m) | Clock-Out: 16:30
Billable Labour: 8.75 hrs | Travel Allowance: 1.0 hr
────────────────────────────────────────────────────
[  APPROVE TIMESHEET  ]
```

### Screen 12 — Tax invoice & MYOB sync (mobile)

```
[←] TAX INVOICE DRAFT                            INV-1042
────────────────────────────────────────────────────
ABN: 90 056 106 855 | Licence / PIC: 118492
BRAND: Caulfield South Plumbing

CHARGES BREAKDOWN
• Site Callout Fee                           $85.00
• Labour (1.7 hrs @ $145/hr)               $246.50
• Parts Installed                            $88.00
• Less Deposit Paid                        -$100.00

TOTAL DUE (INC GST): $351.45
────────────────────────────────────────────────────
[  TAP TO PAY (SQUARE)  ] [  SYNC TO MYOB / XERO  ]
```

## Screen→feature traceability

| Screen | Feature | Backing tables / modules |
|--------|---------|--------------------------|
| 1 | Scheduler canvas | `jobs`, `entities`, drag-and-drop |
| 2 | JSA/SWMS | `jsa_checklists`, `jobs.swms_required` |
| 3 | Vehicle/hazard | `vehicle_inspections`, `hazards`, `photos` |
| 4 | Work order + voice | `jobs`, `job_notes`, `job_line_items`, `photos` |
| 5 | Specialty context | `jobs.body_corp_meta`, `jobs.insurance_meta` |
| 6 | Cross-trade referral | `jobs` + Slack webhook |
| 7 | VBA cert + gas test | `vba_certificates`, `gas-test.ts` |
| 8 | Backflow/TMV | `backflow_tests`, `gas-test.ts` |
| 9 | Signoff + shield | `signatures`, `hasher.ts` |
| 10 | Quote/variation | `quotes`, `quote_line_items` |
| 11 | PO + timesheet | `purchase_orders`, `timesheets` |
| 12 | Invoice + sync | `jobs`, `accounting-sync/*` |
