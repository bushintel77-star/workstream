# FieldLoop v0.1 — Form Filling & Input Patterns (2026)

Normative guidance for how the 12 screens capture data. Goal: every piece of
wireframe content maps to a real schema field (see `database/`), and every input
is glove-friendly, offline-safe, and voice/camera-first where possible.

## 1. How forms are filled in 2026 — principles

1. **Native pickers, not custom dropdowns.** Date, time, and select fields use OS
   controls (Expo `DateTimePicker`, native select, document picker). No bespoke
   wheel/modal rebuilds.
2. **Voice is a first-class input.** Diagnostic notes and scope drafting are
   dictated ("Tap to talk", "Voice draft scope"); speech-to-text writes the
   transcript into the field, editable afterward.
3. **Camera and scanner are inputs.** Barcode/receipt scanning and the evidence
   gate (before/after photos) are primary capture, not attachments bolted on.
4. **Autosave, no Save button.** Every field persists to WatermelonDB immediately;
   the only explicit actions are *transitions* (clock-in, approve, lodge, lock),
   never "save this form".
5. **One decision per screen.** Long forms are chunked into a stepper (JSA → work →
   signoff). Progressive disclosure shows follow-ups only when triggered (e.g.
   "Working at height > 2 m?" YES → surface the SWMS requirement).
6. **Live inline validation.** Validate on change; show computed pass/fail badges
   immediately (gas pressure drop, backflow relief pressure, TMV band).
7. **Computed fields render live.** Totals, 10% GST, deposit caps, and COES
   triggers recompute as inputs change; the server remains authoritative for
   financial totals (see `database/sync-contract.md`).
8. **Thumb-zone ergonomics.** Primary action bottom-right (thumb zone); secondary
   and destructive top-left. All targets ≥56 px; 1 px aperture-red focus ring on active.
9. **Signature canvas → hash.** Signoff is a canvas capture; on commit the system
   computes the Dispute-Shield SHA-256 (`compliance-engine/hasher.ts`).
10. **Offline-first states.** Persistent offline banner, sync-queue count, and
    per-form "queued" state. No data loss on reconnect.
11. **Accessibility.** WCAG 2.2 AA; 16 px input font (kills iOS focus zoom);
    aperture red / amber status LEDs with high-contrast ink; screen-reader labels
    on every control; respect `prefers-reduced-motion` and `prefers-reduced-transparency`.

## 2. Input component inventory

| Component | Use | Screens |
|-----------|-----|---------|
| `YesNoToggle` | HRCW yes/no questions | 2 |
| `ChecklistCheckbox` | PPE verification, work class | 2, 7 |
| `PhotoCapture` | Evidence, hazard, referral, receipt | 3, 4, 6 |
| `BarcodeScanner` | Truck inventory / parts | 4, 11 |
| `VoiceNote` | Diagnostic notes, scope draft | 4, 10 |
| `TextField` / `TextArea` | Client name, notes, declarations | 4, 5, 6, 7 |
| `NativeSelect` | Cause of loss, work class, mode | 5, 7, 10 |
| `NumericField` (with unit) | Pressures, temps, totals, qty | 7, 8, 10, 11 |
| `SignatureCanvas` | Client signoff | 9 |
| `ClockControl` | Clock-in/out, smoko | 11 |
| `Stepper` | Multi-step wizard | 2 → 4 → 9 |
| `StatusBadge` | Pass/fail/on-site states | 1, 7, 8 |
| `EntitySwitcher` | Division selector | 1 (web) |
| `DragCard` | Scheduler dispatch | 1 (web) |

## 3. Screen → form fields → schema mapping

This is the "content lines up with the forms" contract. The implementation SHALL
render exactly these fields; anything in `WIREFRAMES.md` without a target here is
a defect.

| Screen | Form fields | Schema target |
|--------|-------------|---------------|
| 1 Scheduler | entity switcher, drag job → time/technician, create job | `entities.id`, `jobs.status`, `jobs.entity_id`, `timesheets.user_id` |
| 2 JSA/SWMS | 3 HRCW yes/no, 3 PPE checks, sign & unlock | `jsa_checklists.(checklist_item_key, response)`, `jobs.jsa_completed`, `jobs.swms_required`, `timesheets.clock_in` |
| 3 Vehicle/hazard | vehicle name, ladder-racks + press-tool pass/fail, hazard note, photo | `vehicle_inspections.(vehicle_name, item_key, result)`, `hazards.(description, photo_id)`, `photos` |
| 4 Work order | voice diagnostic note, scanned parts, before/after photos | `job_notes.(kind, body_text, transcript, audio_r2_key)`, `job_line_items`, `photos.(kind)` |
| 5 Specialty context | job type, insurer/claim #, cause of loss, plan #, strata manager | `jobs.job_type`, `jobs.insurance_meta`, `jobs.body_corp_meta` |
| 6 Referral | target division, reason, photos | new `jobs` row in target entity + `jobs.source_job_id`, `photos`, Slack webhook |
| 7 VBA cert | job value, work class, static/working pressure, duration, drop, declaration | `jobs.total_inc_gst`, `jobs.work_class`, `vba_certificates.(gas_test, declaration)` |
| 8 Backflow/TMV | device id, location, line/relief pressure, hot/mixed temps, status | `backflow_tests` |
| 9 Signoff | summary, signature canvas, hash | `signatures.(signature_base64, total_inc_gst, photo_ids, dispute_shield_hash)` |
| 10 Quote | mode, line items, voice scope | `quotes.(mode)`, `quote_line_items` |
| 11 PO/timesheet | supplier, item, PO #, clock in/out, smoko, travel | `purchase_orders`, `purchase_order_items`, `timesheets` |
| 12 Invoice | charges breakdown, tap to pay, sync | `jobs` + `job_line_items` (totals), `accounting-sync/*` |

## 4. Fields added to close mapping gaps

The initial schema lacked homes for three screen items; added in
`database/001_initial_schema.sql`:

- `job_notes` — voice/diagnostic/scope notes (Screen 4, 10).
- `vehicle_inspections` — vehicle check items (Screen 3).
- `jobs.source_job_id` — cross-trade referral provenance (Screen 6).
