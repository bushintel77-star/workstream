"use client";

import { useState, useTransition } from "react";
import type { PublicSharePayload } from "@workstream/contracts";
import { submitShareDecision } from "../../lib/share-api";
import { ClientShareTwin } from "./ClientShareTwin";
import { KitButton } from "../ui/kit";
import css from "./clientShare.module.css";

const DISCLAIMER =
  "Incl. GST from the live preemptive BOM on this working drawing. Not a formal tender — promote from Share when the client is ready.";

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

type Props = {
  token: string;
  initial: PublicSharePayload;
};

export function ClientShareDecision({ token, initial }: Props) {
  const [payload, setPayload] = useState(initial);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [superseded, setSuperseded] = useState(false);

  if (superseded) {
    return (
      <div className={css.card} data-testid="share-superseded">
        <h2 className={css.title}>A newer version exists</h2>
        <p className={css.lead}>
          A newer version of this design exists — contact Curtis &amp; Co.
        </p>
      </div>
    );
  }

  if (payload.status === "accepted" || payload.status === "declined") {
    const when = payload.decision
      ? new Date(payload.decision.decidedAt).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      : null;
    return (
      <div className={css.card} data-testid="share-decision-done">
        <p className={css.kicker}>
          Rev {payload.revision} ·{" "}
          {payload.status === "accepted" ? "Accepted" : "Declined"}
        </p>
        <h2 className={css.title}>
          {payload.status === "accepted"
            ? "Thank you — we have your acceptance"
            : "Thanks for letting us know"}
        </h2>
        <p className={css.lead}>
          {payload.decision
            ? `${payload.decision.clientName}${when ? ` · ${when}` : ""}`
            : null}
        </p>
        {payload.status === "accepted" ? (
          <p className={css.lead} data-testid="share-accept-followup">
            Curtis &amp; Co will be in touch.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={css.root} data-testid="share-client-page">
      <header className={css.masthead}>
        <div>
          <p className={css.brand}>Curtis &amp; Co</p>
          <p className={css.brandSub}>Landscape design</p>
        </div>
        <p className={css.rev}>Rev {payload.revision}</p>
      </header>

      <h1 className={css.address}>{payload.snapshot.address}</h1>

      <ClientShareTwin snapshot={payload.snapshot} />

      <section className={css.quote} aria-label="Indicative quote">
        <p className={css.kicker}>Indicative quote</p>
        <p className={css.total} data-testid="share-total">
          {aud(payload.snapshot.totalInclGst)}
        </p>
        <p className={css.gst}>Incl. GST</p>
        <ul className={css.lines}>
          {payload.snapshot.quoteLines.map((line) => (
            <li key={line.id}>
              <span>
                {line.label}
                {line.qty > 0 ? (
                  <small>
                    {" "}
                    · {line.qty} {line.unit}
                  </small>
                ) : null}
              </span>
              <span>{aud(line.total)}</span>
            </li>
          ))}
        </ul>
        <p className={css.disclaimer} data-testid="share-disclaimer">
          {DISCLAIMER}
        </p>
      </section>

      {mode === "idle" ? (
        <div className={css.actions}>
          <KitButton
            variant="default"
            size="lg"
            fullWidth
            data-testid="share-accept"
            onClick={() => {
              setMode("accept");
              setError(null);
            }}
          >
            Accept
          </KitButton>
          <KitButton
            variant="secondary"
            size="lg"
            fullWidth
            data-testid="share-decline"
            onClick={() => {
              setMode("decline");
              setError(null);
            }}
          >
            Decline
          </KitButton>
        </div>
      ) : null}

      {mode === "accept" ? (
        <form
          className={css.form}
          data-testid="share-accept-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await submitShareDecision(token, {
                kind: "accepted",
                clientName: name,
              });
              if (!res.ok) {
                if (res.status === 410) {
                  setSuperseded(true);
                  return;
                }
                setError(res.error);
                return;
              }
              setPayload(res.payload);
            });
          }}
        >
          <label className={css.label} htmlFor="share-client-name">
            Full name
          </label>
          <input
            id="share-client-name"
            className={css.input}
            data-testid="share-client-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            required
            placeholder="Type your full name"
          />
          <div className={css.formActions}>
            <KitButton
              type="submit"
              variant="default"
              data-testid="share-accept-confirm"
              loading={pending}
              disabled={name.trim().length < 2}
            >
              {pending ? "Saving…" : "Confirm acceptance"}
            </KitButton>
            <KitButton
              variant="ghost"
              onClick={() => setMode("idle")}
            >
              Cancel
            </KitButton>
          </div>
        </form>
      ) : null}

      {mode === "decline" ? (
        <form
          className={css.form}
          data-testid="share-decline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await submitShareDecision(token, {
                kind: "declined",
                clientName: name.trim() || "Client",
                note: note.trim() || undefined,
              });
              if (!res.ok) {
                if (res.status === 410) {
                  setSuperseded(true);
                  return;
                }
                setError(res.error);
                return;
              }
              setPayload(res.payload);
            });
          }}
        >
          <label className={css.label} htmlFor="share-decline-name">
            Your name
          </label>
          <input
            id="share-decline-name"
            className={css.input}
            data-testid="share-decline-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
          <label className={css.label} htmlFor="share-decline-note">
            Reason (optional)
          </label>
          <textarea
            id="share-decline-note"
            className={css.textarea}
            data-testid="share-decline-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <div className={css.formActions}>
            <KitButton
              type="submit"
              variant="secondary"
              data-testid="share-decline-confirm"
              loading={pending}
              disabled={name.trim().length < 2}
            >
              {pending ? "Saving…" : "Confirm decline"}
            </KitButton>
            <KitButton
              variant="ghost"
              onClick={() => setMode("idle")}
            >
              Cancel
            </KitButton>
          </div>
        </form>
      ) : null}

      {error ? <p className={css.error}>{error}</p> : null}
    </div>
  );
}
