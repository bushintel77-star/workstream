/**
 * Twilio WhatsApp + SMS sender.
 *
 * Dev fallback: logs the message to stdout instead of sending. Use to verify
 * notification copy in development without a real Twilio account.
 */

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

export type Channel = "whatsapp" | "sms";

export type SendArgs = {
  channel: Channel;
  to: string; // E.164 ("+61400123456") — Twilio prepends "whatsapp:" automatically
  body: string;
};

export type SendResult = {
  sid: string;
  mode: "live" | "dev_fallback";
  channel: Channel;
};

export function isTwilioLive(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    (!!process.env.TWILIO_FROM_NUMBER ||
      !!process.env.TWILIO_WHATSAPP_FROM)
  );
}

function channelFrom(channel: Channel): string {
  if (channel === "whatsapp") {
    return process.env.TWILIO_WHATSAPP_FROM
      ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`
      : "";
  }
  return process.env.TWILIO_FROM_NUMBER ?? "";
}

function channelTo(channel: Channel, to: string): string {
  return channel === "whatsapp" ? `whatsapp:${to}` : to;
}

export async function send(args: SendArgs): Promise<SendResult> {
  if (!isTwilioLive()) {
    /* Never log full SMS/WhatsApp bodies or phone numbers in production —
     * the fallback path still runs when Twilio env is missing. */
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[notify:dev_fallback] (${args.channel}) → ${args.to}: ${args.body}`,
      );
    } else {
      console.warn(
        `[notify:dev_fallback] Twilio unset — dropped ${args.channel} (${args.body.length} chars)`,
      );
    }
    return {
      sid: `dev-msg-${Date.now()}`,
      mode: "dev_fallback",
      channel: args.channel,
    };
  }

  const from = channelFrom(args.channel);
  if (!from) {
    throw new Error(`Twilio ${args.channel} sender not configured`);
  }

  const body = new URLSearchParams({
    From: from,
    To: channelTo(args.channel, args.to),
    Body: args.body,
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );

  const res = await fetch(
    `${TWILIO_BASE}/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { sid: string };
  return { sid: json.sid, mode: "live", channel: args.channel };
}
