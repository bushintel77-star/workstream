# FieldLoop v0.1 — Victorian Statutory & Regulatory Compliance Framework

All system operations in Victoria comply with the **Building Act 1993**,
**Plumbing Regulations 2018**, and **Domestic Building Contracts Act 1995**.

## 1. VBA Compliance Certificate (COES)

**Automatic trigger** when **any** of the following is true for a job:

1. Total job value exceeds **$750 inc. GST**, or
2. Work class includes **gasfitting**, or
3. Work class includes **below-ground sanitary drainage**, or
4. Work class includes **cooling towers**.

**Lodgement window:** within **5 days** of job completion.

**Rendering rule:** invoices, quotes, and compliance forms render the VBA Plumbing
Identification Code (**PIC #118492**) alongside the parent ABN.

The trigger is implemented as a pure function in
[`compliance-engine/vba-triggers.ts`](compliance-engine/vba-triggers.ts).

## 2. Gas soundness & pressure test log (AS/NZS 5601)

Mandated before gas reconnection sign-off:

- **Static pressure** recorded.
- **Working pressure** recorded.
- **5-minute zero-drop** verification (pressure drop `0.0 kPa` over the test
  duration).

Validation logic lives in [`compliance-engine/gas-test.ts`](compliance-engine/gas-test.ts).

## 3. Backflow & TMV service certification

Annual backflow / TMV test report (Screen 8):

- Backflow: line pressure recorded; relief valve opening pressure must **exceed
  14 kPa** to pass.
- TMV: hot supply and mixed outlet temperatures recorded; mixed outlet must sit in
  the **AS 4032.3** acceptable band (typically 35–46 °C for washbasins; verify the
  exact range per the device's specification and applicable standard at build time).
- Output: green-badge "Certified compliant" status + generated PDF pushed to the
  water authority.

## 4. Domestic Building Insurance (DBI)

Required for domestic building or renovation contracts exceeding **$16,000** in value.

## 5. Major Domestic Building Contract (MDC)

Statutory contract required for consumer works exceeding **$10,000**:

- **Deposit cap:** 5% for contracts over $20,000; 10% for contracts under $20,000.
- **Cooling-off:** mandatory 5-day cooling-off disclosure.

## 6. Practitioner registration display

Every invoice, quote, and compliance form automatically renders:

- VBA Plumbing Identification Code **PIC #118492**
- Chatsworth parent ABN **90 056 106 855**

## 7. Compliance state machine

| Job condition | Required artefacts |
|---------------|-------------------|
| Any job | JSA pre-start checklist; evidence gate (1 before + 1 after photo) |
| SWMS-flagged work | SWMS + JSA; HRCW checks on the pre-start screen |
| Value > $750 or gasfitting / below-ground drainage / cooling towers | COES lodgement within 5 days |
| Gasfitting | Gas soundness & pressure test log (AS/NZS 5601) |
| Domestic contract > $16,000 | DBI certificate |
| Consumer work > $10,000 | MDC + capped deposit + 5-day cooling-off disclosure |
| Completion + client signoff | Dispute-Shield SHA-256 lock (see hasher module) |

## 8. Dispute-Shield signature lock

On client signoff, the system computes a deterministic SHA-256 over:

```
jobId | signatureBase64 | sortedPhotoIds | totalIncGst(2dp) | timestamp
```

The hash is stored on the job and rendered on the signoff screen. It is a tamper
evidence anchor, not a legal signature in itself — the captured signature image is
retained separately. Implementation: [`compliance-engine/hasher.ts`](compliance-engine/hasher.ts).

> Note: the `e3b0c44298fc1c149afbf4c8996fb92427ae41e…` hash in the original spec is
> the SHA-256 of the empty string (a placeholder). The canonical implementation uses
> the serialization above and never produces an empty-input hash for a real job.
