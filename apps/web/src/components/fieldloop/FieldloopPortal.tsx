"use client";

/**
 * Fieldloop customer portal — ported 1:1 from the uploaded mockup
 * (fieldloop_customer_portal.html, Caulfield South Plumbing).
 *
 * Two layered screens with a fade/slide transition:
 *   1. Access — enter a mobile number or email, request a one-tap link
 *      (demo: the "link sent" state becomes the continue affordance).
 *   2. Account — service reminder, most-recent job with status track,
 *      a quote found during the visit (approve / decline), the invoice
 *      (pay), service history, and a toast for every action.
 *
 * Data is demo fixture data from the mockup — the screen is a design
 * reference; wiring it to the real Fieldloop API is the follow-up.
 */

import { useEffect, useRef, useState } from "react";
import s from "./fieldloop.module.css";

export interface FieldloopPortalProps {
  /** next/font variable class names for the page fonts. */
  fontVars?: string;
}

const STATUS_STEPS = ["Booked", "On the way", "In progress", "Complete"] as const;
type QuoteStatus = "pending" | "approved" | "declined";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function FieldloopPortal({ fontVars }: FieldloopPortalProps) {
  const [view, setView] = useState<"access" | "portal">("access");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("pending");
  const [invoicePaid, setInvoicePaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const sendAccessLink = () => {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 900);
  };

  const approveQuote = () => {
    setQuoteStatus("approved");
    showToast("Quote approved — we'll be in touch to schedule");
  };

  const declineQuote = () => {
    setQuoteStatus("declined");
    showToast("Quote declined");
  };

  const payInvoice = () => {
    setPaying(true);
    window.setTimeout(() => {
      setPaying(false);
      setInvoicePaid(true);
      showToast("Payment received — receipt emailed to you");
    }, 1000);
  };

  return (
    <div className={`${s.root} ${fontVars ?? ""}`}>
      <div className={s.phoneFrame}>
        <div className={s.phoneScreen}>
          {/* ---- Access screen ---- */}
          <div
            className={`${s.layer} ${s.accessScreen} ${view === "access" ? s.layerActive : s.layerHidden}`}
          >
            <div className={s.accessBrand}>
              CAULFIELD SOUTH <span>PLUMBING</span>
            </div>
            <div className={s.accessSub}>
              Track your visit, view invoices, and book your next service.
            </div>
            <div className={s.accessField}>
              <label htmlFor="accessContact">Mobile number or email</label>
              <input
                id="accessContact"
                type="text"
                value={contact}
                placeholder="e.g. sarah.w@email.com"
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={s.accessBtn}
              disabled={!contact.trim() || sending}
              onClick={() => (sent ? setView("portal") : sendAccessLink())}
            >
              {sending
                ? "Sending…"
                : sent
                  ? "Continue to your account"
                  : "Send me a secure link"}
            </button>
            <div className={`${s.accessSent} ${sent ? s.accessSentVisible : ""}`}>
              Link sent — for this demo, tap below to continue.
            </div>
            <div className={s.accessNote}>
              No password needed. We&apos;ll text or email a one-tap link that&apos;s
              valid for 15 minutes.
            </div>
          </div>

          {/* ---- Portal screen ---- */}
          <div
            className={`${s.layer} ${view === "portal" ? s.layerActive : s.layerHidden}`}
          >
            <header className={s.portalHeader}>
              <div>
                <div className={s.portalBrand}>CAULFIELD SOUTH PLUMBING</div>
                <div className={s.portalGreeting}>Hi, S. Whitfield</div>
              </div>
              <div className={s.portalAvatar}>SW</div>
            </header>

            <div className={s.portalScroll}>
              {/* Service reminder */}
              <div className={`${s.card} ${s.reminderCard}`}>
                <div className={s.cardLabel}>Service reminder</div>
                <div className={s.reminderTitle}>
                  Annual Gas Safety Check due soon
                </div>
                <div className={s.reminderDesc}>
                  Your last check was 15 Sep 2025. It&apos;s due again by 15 Sep
                  2026 — book now to lock in a time that suits you.
                </div>
                <button
                  type="button"
                  className={s.reminderBtn}
                  onClick={() =>
                    showToast(
                      "Booking request sent — we'll confirm a time shortly",
                    )
                  }
                >
                  <CalendarIcon />
                  Book now
                </button>
              </div>

              {/* Most recent visit */}
              <div className={s.card}>
                <div className={s.cardLabel}>Most recent visit</div>
                <div className={s.jobTitle}>Gas leak inspection</div>
                <div className={s.jobMeta}>
                  Sat 29 Aug 2026 · 42 Kooyong Rd, Armadale
                </div>
                <div className={s.statusTrack}>
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className={`${s.statusStep} ${s.statusDone}`}>
                      {i > 0 ? <span className={s.statusLine} /> : null}
                      <span className={s.statusDot} />
                      <span className={s.statusLabel}>{step}</span>
                    </div>
                  ))}
                </div>
                <div className={s.jobSummaryLine}>
                  &quot;Inspected and cleared — no leak detected, fitting
                  re-sealed as a precaution.&quot;
                </div>
                <div className={s.jobTechRow}>
                  <div className={s.jobTechAvatar}>DM</div>
                  <span>Dave Mitchell attended this visit</span>
                </div>
              </div>

              {/* Quote found during the visit */}
              <div className={`${s.card} ${s.quoteCard}`}>
                <div className={s.cardLabel}>Quote — found during your visit</div>
                <div className={s.quoteTitle}>
                  Pressure relief valve replacement
                </div>
                {quoteStatus === "pending" ? (
                  <>
                    <div className={s.quoteDesc}>
                      While inspecting your gas system, Dave noticed the pressure
                      relief valve is past its service life and recommends
                      replacing it. Separate from today&apos;s invoice — this needs
                      your OK before any work happens.
                    </div>
                    <div className={s.quotePriceRow}>
                      <span className={s.quotePriceLabel}>
                        Quoted price (inc. GST)
                      </span>
                      <span className={s.quotePriceNum}>$71.50</span>
                    </div>
                    <div className={s.quoteActions}>
                      <button
                        type="button"
                        className={s.quoteDecline}
                        onClick={declineQuote}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className={s.quoteApprove}
                        onClick={approveQuote}
                      >
                        Approve
                      </button>
                    </div>
                  </>
                ) : quoteStatus === "approved" ? (
                  <div className={`${s.quoteResolved} ${s.quoteApproved}`}>
                    <CheckIcon />
                    Approved — $71.50 · we&apos;ll be in touch to schedule
                  </div>
                ) : (
                  <div className={`${s.quoteResolved} ${s.quoteDeclined}`}>
                    Declined — let us know if you change your mind
                  </div>
                )}
              </div>

              {/* Invoice */}
              <div className={`${s.card} ${s.invoiceCard}`}>
                <div
                  className={`${s.invoiceStamp} ${invoicePaid ? s.invoiceStampPaid : s.invoiceStampDue}`}
                >
                  {invoicePaid ? "Paid" : "Due"}
                </div>
                <div className={s.cardLabel}>Invoice</div>
                <div className={s.invoiceNum}>
                  INV-2026-0142 · Issued 29 Aug 2026
                </div>
                <div className={s.invoiceLines}>
                  <div className={s.invoiceLine}>
                    <span>Callout fee</span>
                    <span>$85.00</span>
                  </div>
                  <div className={s.invoiceLine}>
                    <span>Labour (1 hr)</span>
                    <span>$110.00</span>
                  </div>
                  <div className={s.invoiceLine}>
                    <span>GST (10%)</span>
                    <span>$19.50</span>
                  </div>
                </div>
                <div className={s.invoiceDivider} />
                <div className={s.invoiceTotalRow}>
                  <span className={s.invoiceTotalLabel}>Total</span>
                  <span className={s.invoiceTotalNum}>$214.50</span>
                </div>
                <button
                  type="button"
                  className={`${s.payBtn} ${invoicePaid ? s.payBtnPaid : ""}`}
                  disabled={invoicePaid || paying}
                  onClick={payInvoice}
                >
                  {paying
                    ? "Processing…"
                    : invoicePaid
                      ? (
                          <>
                            <CheckIcon />
                            Paid — thank you
                          </>
                        )
                      : "Pay $214.50"}
                </button>
              </div>

              {/* Service history */}
              <div className={s.card}>
                <div className={s.cardLabel}>Service history</div>
                <div className={s.historyRow}>
                  <span className={s.historyDot} />
                  <span className={s.historyTitle}>Gas leak inspection</span>
                  <span className={s.historyDate}>29 Aug 2026</span>
                </div>
              </div>

              <div className={s.portalFooter}>
                Questions?{" "}
                <a href="tel:0350001234">Call (03) 5000 1234</a>
              </div>
            </div>

            <div className={`${s.toast} ${toast ? s.toastVisible : ""}`} role="status" aria-live="polite">
              {toast}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
