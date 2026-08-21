// FieldLoop v0.1 — integrations/gmail.ts
// Gmail both directions: inbound booking intake + outbound confirmations/dispatch.
// Deps: googleapis, google-auth-library.
// Auth: Google Cloud service account with domain-wide delegation to the
// bookings@chatsworthconstructions.com.au mailbox (see integrations/google-workspace.md).

import { google, gmail_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface GmailConfig {
  clientEmail: string;    // service account email
  privateKey: string;     // PEM private key (env: GOOGLE_PRIVATE_KEY)
  bookingMailbox: string; // bookings@chatsworthconstructions.com.au
}

export function buildGmailClient(cfg: GmailConfig): gmail_v1.Gmail {
  const auth = new JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    subject: cfg.bookingMailbox, // domain-wide delegation
  });
  return google.gmail({ version: 'v1', auth });
}

export async function sendEmail(
  gmail: gmail_v1.Gmail,
  opts: { to: string; subject: string; text: string },
): Promise<string> {
  const raw = Buffer.from(
    `To: ${opts.to}\r\nSubject: ${opts.subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${opts.text}`,
  ).toString('base64url');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return res.data.id ?? '';
}

export interface ParsedBooking {
  clientName: string;
  address: string;
  phone: string;
  jobType: 'standard' | 'body_corporate' | 'insurance_repair';
  notes: string;
}

/** Conservative parser: extract the obvious fields from a booking email. */
export function parseBookingEmail(subject: string, body: string): ParsedBooking {
  const joined = `${subject}\n${body}`;
  const phone =
    joined.match(/(?:\+?61|0)[\s.-]?4\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/)?.[0] ?? '';
  const address =
    joined
      .match(
        /\d{1,5}\s[^\n,]{3,60}(?:st|rd|th|ave|avenue|road|rd|street|st|close|crescent|parade|highway|dr|drive|lane|place|pl|court)[^\n]{0,40}/i,
      )?.[0]
      ?.trim() ?? '';
  const clientName =
    joined.match(/^(?:name|client|contact|customer)\s*:\s*(.+)$/im)?.[1]?.trim() ?? '';

  let jobType: ParsedBooking['jobType'] = 'standard';
  if (/(body corp|strata|owners corp)/i.test(joined)) jobType = 'body_corporate';
  else if (/(insurance|claim|insurer)/i.test(joined)) jobType = 'insurance_repair';

  return { clientName, address, phone, jobType, notes: body.trim() };
}

/** Pull unprocessed booking emails and mark them processed (idempotent). */
export async function pullNewBookings(
  gmail: gmail_v1.Gmail,
): Promise<Array<{ id: string; parsed: ParsedBooking }>> {
  const listed = await gmail.users.messages.list({
    userId: 'me',
    q: 'label:FieldLoop/New',
    maxResults: 50,
  });
  const ids =
    listed.data.messages?.map((m) => m.id).filter((x): x is string => !!x) ?? [];

  const out: Array<{ id: string; parsed: ParsedBooking }> = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const subject =
      msg.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'subject')
        ?.value ?? '';
    const body = extractPlainBody(msg.data.payload);
    out.push({ id, parsed: parseBookingEmail(subject, body) });
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        addLabelIds: ['FieldLoop/Processed'],
        removeLabelIds: ['FieldLoop/New'],
      },
    });
  }
  return out;
}

function extractPlainBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  if (payload.parts) {
    return payload.parts.map((p) => extractPlainBody(p)).join('\n');
  }
  return '';
}
